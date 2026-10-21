import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';

import { permissions, type Session } from '../access';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { runSerializableTransaction } from '../utils/serializableTransaction';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';

const SHIFT_ACTIONS = new Set(['schedule', 'clock_in', 'clock_out', 'cancel']);
const EXCEPTION_ACTIONS = new Set(['create', 'cancel']);
const EXCEPTION_TYPES = new Set(['time_off', 'shop_closure', 'chair_unavailable', 'working_override']);

type Context = { session?: Session; prisma: PrismaClient };

const ACCEPTED_APPOINTMENT_STATUSES = ['requested', 'confirmed', 'checked_in', 'in_chair'] as const;

/** Share the booking fence so availability changes and bookings serialize. */
async function lockResource(transaction: Prisma.TransactionClient, resource: string) {
  await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-booking', resource);
}

/** Accepted appointments that an availability change in this window would strand. */
async function acceptedAppointmentsInWindow(transaction: Prisma.TransactionClient, input: { shopId: string; startsAt: Date; endsAt: Date; barberId?: string | null; chairId?: string | null; wholeShop?: boolean }) {
  const resources = input.wholeShop ? [] : [
    ...(input.barberId ? [{ barberId: input.barberId }] : []),
    ...(input.chairId ? [{ chairId: input.chairId }] : []),
  ];
  if (!input.wholeShop && !resources.length) return 0;
  return transaction.appointment.count({ where: {
    shopId: input.shopId,
    status: { in: [...ACCEPTED_APPOINTMENT_STATUSES] },
    startsAt: { lt: input.endsAt },
    OR: [{ endsAt: { gt: input.startsAt } }, { endsAt: null, startsAt: { gte: input.startsAt } }],
    ...(resources.length ? { AND: [{ OR: resources }] } : {}),
  } });
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function date(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function manageStaffShift(_root: unknown, args: {
  action: string; shiftId?: string | null; barberId?: string | null; chairId?: string | null;
  scheduledStart?: string | null; scheduledEnd?: string | null; notes?: string | null; idempotencyKey: string;
}, context: Context) {
  if (!permissions.canManageSchedules({ session: context.session })) return { success: false, error: 'Not authorized to manage shifts.', shift: null };
  const action = args.action?.trim(); const key = args.idempotencyKey?.trim();
  if (!SHIFT_ACTIONS.has(action) || !key || key.length > 200) return { success: false, error: 'A valid shift action and idempotency key are required.', shift: null };
  try {
    const shopId = await requireCurrentShopPermission(context.session, 'canManageSchedules');
    const shift = await runSerializableTransaction(context.prisma, async (transactionValue) => {
      const transaction = transactionValue as Prisma.TransactionClient;
      await requireCurrentShopPermission(context.session, 'canManageSchedules', transaction);
      const commandHash = hash(key);
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-shift', args.shiftId || args.barberId || commandHash);
      if (action === 'schedule') {
        const startsAt = date(args.scheduledStart); const endsAt = date(args.scheduledEnd);
        const replay = await transaction.staffShift.findUnique({ where: { idempotencyKeyHash: commandHash } });
        if (replay) {
          if (replay.shopId !== shopId || replay.barberId !== args.barberId || (args.chairId && replay.chairId !== args.chairId) || !startsAt || !endsAt || replay.scheduledStart.getTime() !== startsAt.getTime() || replay.scheduledEnd.getTime() !== endsAt.getTime() || replay.notes !== (args.notes?.trim() || '')) throw new Error('Shift idempotency key was reused for different input.');
          return replay;
        }
        if (!args.barberId || !startsAt || !endsAt || endsAt <= startsAt) throw new Error('Barber and a valid shift window are required.');
        const barber = await transaction.barber.findUnique({ where: { id: args.barberId }, include: { chair: true } });
        if (!barber || barber.shopId !== shopId) throw new Error('Barber was not found in the active shop.');
        const chairId = args.chairId || barber.chairId;
        if (chairId) {
          const chair = await transaction.barberChair.findUnique({ where: { id: chairId } });
          if (!chair || chair.shopId !== shopId || chair.status !== 'active') throw new Error('Shift chair is unavailable in the active shop.');
          await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-shift-chair', chairId);
        }
        const overlap = await transaction.staffShift.findFirst({ where: {
          shopId, status: { in: ['scheduled', 'clocked_in'] }, scheduledStart: { lt: endsAt }, scheduledEnd: { gt: startsAt },
          OR: [{ barberId: barber.id }, ...(chairId ? [{ chairId }] : [])],
        } });
        if (overlap) throw new Error('This barber or chair already has an overlapping shift.');
        const created = await transaction.staffShift.create({ data: {
          shopId, barberId: barber.id, chairId, idempotencyKeyHash: commandHash, status: 'scheduled',
          scheduledStart: startsAt, scheduledEnd: endsAt, notes: args.notes?.trim() || '',
        } });
        await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId,
          eventKey: `shift:${created.id}:scheduled:v1`, eventType: 'shift.scheduled', aggregateType: 'staff_shift', aggregateId: created.id,
          shopId, occurredAt: created.createdAt, data: { shift: { id: created.id, barberId: barber.id, chairId, scheduledStart: startsAt.toISOString(), scheduledEnd: endsAt.toISOString() } },
        }));
        return created;
      }

      if (!args.shiftId) throw new Error('Shift is required.');
      const eventKey = `shift-command:${commandHash}:v1`;
      const replay = await transaction.lifecycleOutboxEvent.findUnique({ where: { eventKey } });
      if (replay) {
        const payload = replay.payload as { data?: { shift?: { id?: string; action?: string } } } | null;
        if (replay.shopId !== shopId || payload?.data?.shift?.id !== args.shiftId || payload.data.shift.action !== action) throw new Error('Shift idempotency key was reused for different input.');
        const replayShift = await transaction.staffShift.findUniqueOrThrow({ where: { id: args.shiftId } });
        if (replayShift.shopId !== shopId) throw new Error('Shift idempotency key belongs to another shop.');
        return replayShift;
      }
      const current = await transaction.staffShift.findUnique({ where: { id: args.shiftId } });
      if (!current || current.shopId !== shopId) throw new Error('Shift was not found in the active shop.');
      const now = new Date();
      const data = action === 'clock_in'
        ? (current.status === 'scheduled' ? { status: 'clocked_in' as const, clockedInAt: now } : null)
        : action === 'clock_out'
          ? (current.status === 'clocked_in' ? { status: 'completed' as const, clockedOutAt: now } : null)
          : (['scheduled', 'clocked_in'].includes(String(current.status)) ? { status: 'cancelled' as const, clockedOutAt: current.status === 'clocked_in' ? now : null } : null);
      if (!data) throw new Error(`Shift in ${current.status} state cannot ${action.replace('_', ' ')}.`);
      if (action === 'cancel' && current.barberId) {
        await lockResource(transaction, `staff:${current.barberId}`);
        const stranded = await acceptedAppointmentsInWindow(transaction, { shopId, startsAt: current.status === 'clocked_in' ? now : current.scheduledStart, endsAt: current.scheduledEnd, barberId: current.barberId });
        if (stranded) throw new Error(`${stranded} booked appointment(s) rely on this shift. Reschedule or reassign them before cancelling it.`);
      }
      const updated = await transaction.staffShift.update({ where: { id: current.id }, data });
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId,
        eventKey, eventType: `shift.${updated.status}`, aggregateType: 'staff_shift', aggregateId: updated.id, shopId,
        occurredAt: now, data: { shift: { id: updated.id, action, fromStatus: current.status, toStatus: updated.status } },
      }));
      return updated;
    });
    return { success: true, error: null, shift: { id: shift.id, status: shift.status, scheduledStart: shift.scheduledStart.toISOString(), scheduledEnd: shift.scheduledEnd.toISOString(), clockedInAt: shift.clockedInAt?.toISOString() || null, clockedOutAt: shift.clockedOutAt?.toISOString() || null } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to manage shift.', shift: null };
  }
}

export async function manageScheduleException(_root: unknown, args: {
  action: string; exceptionId?: string | null; exceptionType?: string | null; barberId?: string | null; chairId?: string | null;
  startsAt?: string | null; endsAt?: string | null; reason?: string | null; idempotencyKey: string;
}, context: Context) {
  if (!permissions.canManageSchedules({ session: context.session })) return { success: false, error: 'Not authorized to manage schedule exceptions.', exception: null };
  const action = args.action?.trim(); const key = args.idempotencyKey?.trim();
  if (!EXCEPTION_ACTIONS.has(action) || !key || key.length > 200) return { success: false, error: 'A valid exception action and idempotency key are required.', exception: null };
  try {
    const shopId = await requireCurrentShopPermission(context.session, 'canManageSchedules');
    const exception = await runSerializableTransaction(context.prisma, async (transactionValue) => {
      const transaction = transactionValue as Prisma.TransactionClient;
      await requireCurrentShopPermission(context.session, 'canManageSchedules', transaction);
      const commandHash = hash(key);
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-schedule-exception', args.exceptionId || commandHash);
      if (action === 'create') {
        const startsAt = date(args.startsAt); const endsAt = date(args.endsAt); const type = args.exceptionType?.trim() || '';
        const replay = await transaction.scheduleException.findUnique({ where: { idempotencyKeyHash: commandHash } });
        if (replay) {
          if (replay.shopId !== shopId || replay.exceptionType !== type || replay.barberId !== (args.barberId || null) || replay.chairId !== (args.chairId || null) || !startsAt || !endsAt || replay.startsAt.getTime() !== startsAt.getTime() || replay.endsAt.getTime() !== endsAt.getTime() || replay.reason !== (args.reason?.trim() || '')) throw new Error('Schedule-exception idempotency key was reused for different input.');
          return replay;
        }
        if (!EXCEPTION_TYPES.has(type) || !startsAt || !endsAt || endsAt <= startsAt || !args.reason?.trim()) throw new Error('Type, reason, and a valid exception window are required.');
        if (type === 'working_override' && !args.barberId) throw new Error('A working override requires a barber.');
        if (type === 'chair_unavailable' && !args.chairId) throw new Error('Chair unavailability requires a chair.');
        const [barber, chair] = await Promise.all([
          args.barberId ? transaction.barber.findUnique({ where: { id: args.barberId } }) : null,
          args.chairId ? transaction.barberChair.findUnique({ where: { id: args.chairId } }) : null,
        ]);
        if ((barber && barber.shopId !== shopId) || (chair && chair.shopId !== shopId)) throw new Error('Exception resources must belong to the active shop.');
        if (type !== 'working_override') {
          if (barber) await lockResource(transaction, `staff:${barber.id}`);
          if (chair) await lockResource(transaction, `chair:${shopId}:${chair.id}`);
          const stranded = await acceptedAppointmentsInWindow(transaction, { shopId, startsAt, endsAt, barberId: barber?.id, chairId: chair?.id, wholeShop: type === 'shop_closure' && !barber && !chair });
          if (stranded) throw new Error(`${stranded} booked appointment(s) fall in this window. Reschedule or cancel them before blocking this time.`);
        }
        const created = await transaction.scheduleException.create({ data: {
          shopId, barberId: barber?.id || null, chairId: chair?.id || null, idempotencyKeyHash: commandHash,
          exceptionType: type as never, status: 'active', startsAt, endsAt, reason: args.reason.trim(),
        } });
        await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId,
          eventKey: `schedule-exception:${created.id}:created:v1`, eventType: 'schedule_exception.created', aggregateType: 'schedule_exception', aggregateId: created.id,
          shopId, occurredAt: created.createdAt, data: { exception: { id: created.id, type, barberId: barber?.id || null, chairId: chair?.id || null, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() } },
        }));
        return created;
      }
      if (!args.exceptionId) throw new Error('Schedule exception is required.');
      const eventKey = `schedule-exception-command:${commandHash}:v1`;
      const replayEvent = await transaction.lifecycleOutboxEvent.findUnique({ where: { eventKey } });
      if (replayEvent) {
        const payload = replayEvent.payload as { data?: { exception?: { id?: string; action?: string } } } | null;
        if (replayEvent.shopId !== shopId || payload?.data?.exception?.id !== args.exceptionId || payload.data.exception.action !== 'cancel') throw new Error('Schedule-exception idempotency key was reused for different input.');
        return transaction.scheduleException.findFirstOrThrow({ where: { id: args.exceptionId, shopId } });
      }
      const current = await transaction.scheduleException.findUnique({ where: { id: args.exceptionId } });
      if (!current || current.shopId !== shopId) throw new Error('Schedule exception was not found in the active shop.');
      if (current.status === 'cancelled') return current;
      const updated = await transaction.scheduleException.update({ where: { id: current.id }, data: { status: 'cancelled' } });
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId,
        eventKey, eventType: 'schedule_exception.cancelled', aggregateType: 'schedule_exception', aggregateId: updated.id,
        shopId, occurredAt: updated.updatedAt, data: { exception: { id: updated.id, action: 'cancel', fromStatus: current.status, toStatus: updated.status } },
      }));
      return updated;
    });
    return { success: true, error: null, exception: { id: exception.id, status: exception.status, exceptionType: exception.exceptionType, startsAt: exception.startsAt.toISOString(), endsAt: exception.endsAt.toISOString() } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to manage schedule exception.', exception: null };
  }
}

/**
 * Links (or unlinks) a barber profile to a dashboard account. The account must
 * already hold an active membership in this shop, granted by an owner or
 * manager; nothing is matched by name, phone or email.
 */
export async function linkBarberAccount(_root: unknown, args: { barberId: string; userId?: string | null; idempotencyKey: string }, context: Context) {
  if (!permissions.canManageStaff({ session: context.session })) return { success: false, error: 'Not authorized to manage staff accounts.', barber: null };
  const key = args.idempotencyKey?.trim();
  if (!args.barberId || !key || key.length > 200) return { success: false, error: 'Barber and idempotency key are required.', barber: null };
  try {
    const barber = await runSerializableTransaction(context.prisma, async (transactionValue) => {
      const transaction = transactionValue as Prisma.TransactionClient;
      const shopId = await requireCurrentShopPermission(context.session, 'canManageStaff', transaction);
      const actor = await transaction.shopMembership.findFirst({ where: { shopId, userId: context.session!.itemId, status: 'active', membershipRole: { in: ['owner', 'manager'] } }, select: { id: true } });
      if (!actor) throw new Error('Only a shop owner or manager can link staff accounts.');
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-staff-identity', args.barberId);
      const current = await transaction.barber.findFirst({ where: { id: args.barberId, shopId } });
      if (!current) throw new Error('Barber was not found in the active shop.');
      const userId = args.userId || null;
      if (current.userId === userId) return current;
      if (userId) {
        const membership = await transaction.shopMembership.findFirst({ where: { shopId, userId, status: 'active' }, select: { id: true } });
        if (!membership) throw new Error('Invite this person to the shop first; only active shop members can be linked.');
        const linked = await transaction.barber.findFirst({ where: { userId }, select: { id: true } });
        if (linked) throw new Error('This account is already linked to another barber profile.');
      }
      const updated = await transaction.barber.update({ where: { id: current.id }, data: { userId } });
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId,
        eventKey: `barber-account:${hash(key)}:v1`, eventType: userId ? 'barber.account_linked' : 'barber.account_unlinked', aggregateType: 'barber', aggregateId: current.id,
        shopId, occurredAt: updated.updatedAt, data: { barberAccount: { barberId: current.id, previousUserId: current.userId, userId, actorId: context.session?.itemId ?? null } },
      }));
      return updated;
    });
    return { success: true, error: null, barber: { id: barber.id, userId: barber.userId } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to link staff account.', barber: null };
  }
}
