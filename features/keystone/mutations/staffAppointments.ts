import { createHash, randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

import { shopMinute } from '../../shared/shop-time';
import { permissions, type Session } from '../access';
import { dayKeyForDate, dayRange, isSlotAvailable } from '../utils/availability';
import {
  assertAppointmentCandidateSetComplete,
  lockBookingResources,
  MAX_BOOKING_CAPACITY_CANDIDATES,
  runSerializableBookingTransaction,
  shopDayAppointmentCandidateFilter,
} from '../utils/bookingCapacity';
import { appointmentChangeConsequences, requireEffectiveBookingPolicy, type BookingPolicySnapshot } from '../utils/bookingPolicy';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';
import { buildLifecycleEnvelope, canonicalJson, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { requireEffectivePractitionerAuthority } from '../utils/practitionerAuthority';
import { createPublicAccessToken } from '../utils/publicAccessToken';
import { getWaiverRequirement } from '../utils/waiverEvidence';

// Operator (front desk) appointment commands. They reuse the same capacity,
// practitioner-authority, policy and waiver evidence rules as public booking,
// but are authorized by the operator's current shop membership and role
// instead of a published storefront or a customer's private access token.

type Context = { session?: Session; prisma: PrismaClient };
type Result = { success: boolean; error: string | null; data: Record<string, unknown> | null };

const ACTIVE_STATUSES = ['requested', 'confirmed', 'checked_in', 'in_chair'] as const;
const SOURCES = new Set(['phone', 'staff', 'walk_in']);

function digest(value: string) { return createHash('sha256').update(value).digest('hex'); }
function fail(error: string): Result { return { success: false, error, data: null }; }
function clean(value?: string | null) { return value?.trim() || ''; }
function safeError(error: unknown, fallback: string) {
  return error instanceof Error && !error.message.includes('Invalid `') ? error.message : fallback;
}

type SlotInput = {
  shopId: string;
  serviceId: string;
  barberId: string;
  startsAt: Date;
  durationMinutes?: number | null;
  excludeAppointmentId?: string;
};

/** Locks and re-verifies the service/practitioner/chair interval inside the transaction. */
async function assertStaffSlot(transaction: Prisma.TransactionClient, input: SlotInput) {
  await lockBookingResources(transaction, { serviceId: input.serviceId, barberId: input.barberId });
  const [service, barber, shop] = await Promise.all([
    transaction.service.findUnique({ where: { id: input.serviceId }, include: { specialists: { select: { id: true } } } }),
    transaction.barber.findUnique({ where: { id: input.barberId }, include: { chair: { select: { id: true, shopId: true, status: true } } } }),
    transaction.shop.findUnique({ where: { id: input.shopId }, select: { id: true, status: true, timezone: true } }),
  ]);
  if (!shop || shop.status !== 'active') throw new Error('The active shop is unavailable.');
  if (!service || service.shopId !== input.shopId || service.status !== 'active') throw new Error('Selected service is not active in this shop.');
  if (!barber || barber.shopId !== input.shopId || barber.status !== 'active' || !barber.bookingEnabled) throw new Error('Selected barber is not bookable in this shop.');
  if (!barber.chair || barber.chair.shopId !== input.shopId) throw new Error('The selected barber does not have an assigned chair in this shop.');
  if (barber.chair.status !== 'active') throw new Error('The selected barber chair is unavailable.');
  if (service.specialists.length > 0 && !service.specialists.some((item) => item.id === barber.id)) throw new Error('Selected barber does not provide this service.');
  await lockBookingResources(transaction, { serviceId: service.id, barberId: barber.id, chairNumber: `${input.shopId}:${barber.chair.id}` });

  const timeZone = shop.timezone;
  if (!timeZone) throw new Error('Shop timezone is unavailable.');
  try { new Intl.DateTimeFormat('en', { timeZone }).format(input.startsAt); }
  catch { throw new Error('Shop timezone is unavailable.'); }
  const durationMinutes = input.durationMinutes || service.durationMinutes;
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1) throw new Error('Service duration is unavailable.');
  const startsAt = input.startsAt;
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const { start, end } = dayRange(startsAt, timeZone);
  const minute = (value: Date) => value <= start ? 0 : value >= end ? 1440 : shopMinute(value, timeZone);
  const bufferMinutes = Math.max(0, barber.bufferMinutes || 0);
  const chairId = barber.chair.id;
  const [schedule, exceptions, shifts, appointments] = await Promise.all([
    transaction.barberSchedule.findFirst({ where: { barberId: barber.id, dayOfWeek: dayKeyForDate(startsAt, timeZone) as Prisma.EnumBarberScheduleDayOfWeekTypeFilter['equals'], isWorking: true } }),
    transaction.scheduleException.findMany({ where: { shopId: input.shopId, status: 'active', startsAt: { lt: endsAt }, endsAt: { gt: startsAt }, OR: [{ barberId: barber.id }, { chairId }, { exceptionType: 'shop_closure', barberId: null, chairId: null }] } }),
    transaction.staffShift.findMany({ where: { shopId: input.shopId, barberId: barber.id, status: { in: ['scheduled', 'clocked_in'] }, scheduledStart: { lt: end }, scheduledEnd: { gt: start } } }),
    transaction.appointment.findMany({
      where: {
        ...(input.excludeAppointmentId ? { id: { not: input.excludeAppointmentId } } : {}),
        shopId: input.shopId, status: { in: [...ACTIVE_STATUSES] },
        ...shopDayAppointmentCandidateFilter(start, end, bufferMinutes),
        OR: [{ barberId: barber.id }, { chairId }],
      },
      select: { id: true, startsAt: true, endsAt: true, durationMinutes: true, barberId: true },
      take: MAX_BOOKING_CAPACITY_CANDIDATES + 1,
    }),
  ]);
  assertAppointmentCandidateSetComplete(appointments);
  const blocking = exceptions.filter((item) => item.exceptionType !== 'working_override');
  if (blocking.length) throw new Error(blocking[0].reason || 'That time is blocked by a schedule exception.');
  if (shifts.length && !shifts.some((shift) => startsAt >= shift.scheduledStart && endsAt <= shift.scheduledEnd)) throw new Error('That time is outside the barber’s scheduled shift.');
  const override = exceptions.find((item) => item.exceptionType === 'working_override');
  const effectiveSchedule = override ? {
    id: override.id, barberId: barber.id, dayOfWeek: dayKeyForDate(startsAt, timeZone), isWorking: true,
    startMinute: minute(override.startsAt), endMinute: minute(override.endsAt),
    breakStartMinute: null, breakEndMinute: null, notes: override.reason, createdAt: override.createdAt, updatedAt: override.updatedAt,
  } : schedule;
  if (!isSlotAvailable({
    startsAt, timeZone,
    serviceDuration: durationMinutes + bufferMinutes,
    schedule: effectiveSchedule ? { ...effectiveSchedule, dayOfWeek: String(effectiveSchedule.dayOfWeek), barber: { id: barber.id, displayName: barber.displayName } } : null,
    appointments: appointments.map((item) => ({
      id: item.id, startsAt: item.startsAt.toISOString(), endsAt: item.endsAt?.toISOString() || null,
      durationMinutes: item.durationMinutes || 30, barber: item.barberId ? { id: item.barberId } : null,
    })),
    occupiedAppointmentBufferMinutes: bufferMinutes,
    blockingWindows: blocking.map((item) => ({ startsAt: item.startsAt, endsAt: item.endsAt, reason: item.reason })),
  })) throw new Error('That slot is taken or outside the barber’s working hours. Choose another time.');
  const authority = await requireEffectivePractitionerAuthority(transaction, { shopId: input.shopId, barberId: barber.id, serviceId: service.id, at: startsAt });
  return { service, barber, chairId, endsAt, durationMinutes, authority, timeZone };
}

type StoredCommand = { request: string; appointmentId: string };

async function readReplay(transaction: Prisma.TransactionClient, eventKey: string, shopId: string, request: string) {
  const replay = await transaction.lifecycleOutboxEvent.findUnique({ where: { eventKey } });
  if (!replay) return null;
  const payload = replay.payload as { data?: { command?: StoredCommand } } | null;
  const saved = payload?.data?.command;
  if (replay.shopId !== shopId || !saved?.appointmentId || saved.request !== request) {
    throw new Error('This request key was already used for a different appointment command.');
  }
  return saved.appointmentId;
}

type CreateArgs = {
  customerId?: string | null;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  serviceId: string;
  barberId: string;
  startsAt: string;
  notes?: string | null;
  source?: string | null;
  waitlistEntryId?: string | null;
  idempotencyKey: string;
};

export async function createStaffAppointment(_root: unknown, args: CreateArgs, context: Context): Promise<Result> {
  if (!permissions.canManageAppointments({ session: context.session })) return fail('Not authorized to book appointments.');
  const key = clean(args.idempotencyKey);
  const serviceId = clean(args.serviceId);
  const barberId = clean(args.barberId);
  const customerId = clean(args.customerId);
  const firstName = clean(args.customerFirstName);
  const lastName = clean(args.customerLastName);
  const phone = clean(args.customerPhone);
  const email = clean(args.customerEmail);
  const notes = clean(args.notes).slice(0, 2000);
  const source = SOURCES.has(clean(args.source)) ? clean(args.source) : 'staff';
  const waitlistEntryId = clean(args.waitlistEntryId);
  const startsAt = new Date(args.startsAt || '');
  if (key.length < 8 || key.length > 200) return fail('A valid request key is required.');
  if (!serviceId || !barberId) return fail('Choose a service and a barber.');
  if (Number.isNaN(startsAt.getTime())) return fail('Choose a valid appointment time.');
  if (startsAt.getTime() <= Date.now()) return fail('Choose a future appointment time.');
  if (startsAt.getTime() > Date.now() + 365 * 86400_000) return fail('Choose a time within the next year.');
  if (!customerId) {
    if (firstName.length < 1 || firstName.length > 80 || lastName.length > 80) return fail('Enter the new customer’s first name.');
    if (phone.replace(/\D/g, '').length < 7 || phone.length > 40) return fail('Enter a valid phone number for the new customer.');
    if (email && (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return fail('Enter a valid email or leave it blank.');
  }

  let shopId: string;
  try { shopId = await requireCurrentShopPermission(context.session, 'canManageAppointments', context.prisma); }
  catch (error) { return fail(safeError(error, 'Not authorized to book appointments for this shop.')); }
  if (waitlistEntryId) {
    try { await requireCurrentShopPermission(context.session, 'canManageQueue', context.prisma); }
    catch { return fail('Waitlist promotion also requires queue access for this shop.'); }
  }

  const request = canonicalJson({ customerId: customerId || null, firstName: customerId ? null : firstName, lastName: customerId ? null : lastName, phone: customerId ? null : phone, email: customerId ? null : email, serviceId, barberId, startsAt: startsAt.toISOString(), notes, source, waitlistEntryId: waitlistEntryId || null });
  const eventKey = `staff-appointment-create:${digest(`${shopId}:${key}`)}:v1`;
  const access = createPublicAccessToken();
  try {
    const data = await runSerializableBookingTransaction(context.prisma, async (rawTransaction) => {
      const transaction = rawTransaction as Prisma.TransactionClient;
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-staff-appointment', eventKey);
      await requireCurrentShopPermission(context.session, 'canManageAppointments', transaction);
      const replayedId = await readReplay(transaction, eventKey, shopId, request);
      if (replayedId) {
        const prior = await transaction.appointment.findUnique({ where: { id: replayedId }, select: { id: true, status: true, startsAt: true, customerId: true } });
        return { appointmentId: replayedId, status: prior?.status || null, startsAt: prior?.startsAt.toISOString() || null, customerId: prior?.customerId || null, replayed: true, accessToken: null };
      }

      let waitlist: { id: string; status: string | null; metadata: Prisma.JsonValue } | null = null;
      if (waitlistEntryId) {
        await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-waitlist', waitlistEntryId);
        const entry = await transaction.waitlistEntry.findFirst({ where: { id: waitlistEntryId, shopId }, select: { id: true, status: true, metadata: true } });
        if (!entry) throw new Error('Waitlist entry was not found in the active shop.');
        if (!['waiting', 'notified'].includes(String(entry.status))) throw new Error(`A ${entry.status} waitlist entry cannot be booked.`);
        waitlist = entry;
      }

      let customer: { id: string; firstName: string; lastName: string } | null = null;
      if (customerId) {
        customer = await transaction.customer.findFirst({ where: { id: customerId, shopId }, select: { id: true, firstName: true, lastName: true } });
        if (!customer) throw new Error('Selected customer was not found in this shop.');
      }

      const slot = await assertStaffSlot(transaction, { shopId, serviceId, barberId, startsAt });
      const [bookingPolicy, waiverRequirement] = await Promise.all([
        requireEffectiveBookingPolicy(transaction, { shopId, at: new Date() }),
        getWaiverRequirement(transaction, slot.service.id),
      ]);

      // A new customer is created explicitly; contact details never attach this
      // booking to an existing profile.
      if (!customer) {
        customer = await transaction.customer.create({ data: { shopId, firstName, lastName, phone, email, status: 'active' }, select: { id: true, firstName: true, lastName: true } });
      }

      const appointment = await transaction.appointment.create({
        data: {
          shopId,
          chairId: slot.chairId,
          startsAt,
          endsAt: slot.endsAt,
          durationMinutes: slot.durationMinutes,
          serviceTitleSnapshot: slot.service.name || 'Barbershop service',
          serviceImagePathSnapshot: slot.service.imagePath || '',
          serviceModifiersSnapshot: [],
          barberNameSnapshot: slot.barber.displayName || '',
          barberChairNumberSnapshot: slot.barber.chairNumber || '',
          // Staff took the booking themselves, so it is confirmed on entry.
          status: 'confirmed',
          source: source as 'phone' | 'staff' | 'walk_in',
          paymentStatus: slot.service.depositRequired ? 'deposit_due' : 'not_required',
          price: slot.service.price || 0,
          depositAmount: slot.service.depositAmount || 0,
          internalNotes: notes,
          // The customer's status link greets them by the name staff entered.
          guestNameSnapshot: [customer.firstName, customer.lastName].filter(Boolean).join(' '),
          publicAccessTokenHash: access.hash,
          serviceId: slot.service.id,
          barberId: slot.barber.id,
          customerId: customer.id,
        },
        select: { id: true, status: true, startsAt: true, endsAt: true, createdAt: true },
      });
      await transaction.$executeRawUnsafe(`
        UPDATE "Appointment"
        SET "bookingAuthoritySnapshot" = $2::jsonb, "bookingPolicySnapshot" = $3::jsonb, "waiverRequirementSnapshot" = $4::jsonb
        WHERE id = $1
      `, appointment.id, JSON.stringify(slot.authority), JSON.stringify(bookingPolicy), JSON.stringify(waiverRequirement));

      if (waitlist) {
        const metadata = waitlist.metadata && typeof waitlist.metadata === 'object' && !Array.isArray(waitlist.metadata) ? waitlist.metadata as Record<string, unknown> : {};
        await transaction.waitlistEntry.update({ where: { id: waitlist.id }, data: { status: 'booked', customerId: customer.id, metadata: { ...metadata, appointmentId: appointment.id, bookedAt: appointment.createdAt.toISOString() } } });
      }

      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({
        eventKey, eventType: 'appointment.created', aggregateType: 'appointment', aggregateId: appointment.id, shopId, occurredAt: appointment.createdAt,
        data: {
          command: { request, appointmentId: appointment.id },
          appointment: {
            id: appointment.id, status: appointment.status, startsAt: appointment.startsAt.toISOString(), endsAt: appointment.endsAt?.toISOString() || null,
            customerId: customer.id, barberId: slot.barber.id, chairId: slot.chairId, serviceId: slot.service.id, price: slot.service.price || 0, source,
            bookingAuthority: slot.authority, bookingPolicy, waiverRequirement, waitlistEntryId: waitlist?.id || null,
          },
        },
      }));
      return { appointmentId: appointment.id, status: appointment.status, startsAt: appointment.startsAt.toISOString(), customerId: customer.id, waitlistEntryId: waitlist?.id || null, waiverRequired: waiverRequirement.required, replayed: false, accessToken: access.token };
    });
    return { success: true, error: null, data };
  } catch (error) {
    return fail(safeError(error, 'Unable to book this appointment. Refresh the booking board before retrying.'));
  }
}

type ManageArgs = { appointmentId: string; action: string; startsAt?: string | null; barberId?: string | null; reason: string; idempotencyKey: string };
type SnapshotRow = { bookingPolicySnapshot: BookingPolicySnapshot | null; bookingAuthoritySnapshot: Record<string, unknown> | null };
type EventRow = { appointmentId: string; action: string; reason: string; nextStartsAt: Date | null };

/**
 * Operator cancellation and reschedule/reassignment. Policy consequences are
 * computed from the appointment's accepted policy snapshot and recorded with the
 * change event; the original snapshots are not rewritten except for the
 * re-verified practitioner authority of a new barber/time.
 */
export async function manageStaffAppointment(_root: unknown, args: ManageArgs, context: Context): Promise<Result> {
  if (!permissions.canManageAppointments({ session: context.session })) return fail('Not authorized to change appointments.');
  const action = clean(args.action).toLowerCase();
  const appointmentId = clean(args.appointmentId);
  const reason = clean(args.reason);
  const key = clean(args.idempotencyKey);
  const nextBarberId = clean(args.barberId);
  if (!['cancel', 'reschedule'].includes(action)) return fail('Action must be cancel or reschedule.');
  if (!appointmentId || key.length < 8 || key.length > 200) return fail('Appointment and request key are required.');
  if (reason.length < 2 || reason.length > 1000) return fail('Enter a reason for this change.');
  const requestedStart = action === 'reschedule' && args.startsAt ? new Date(args.startsAt) : null;
  if (requestedStart && (Number.isNaN(requestedStart.getTime()) || requestedStart <= new Date())) return fail('Choose a future appointment time.');
  if (action === 'reschedule' && !requestedStart && !nextBarberId) return fail('Choose a new time or barber.');

  let shopId: string;
  try { shopId = await requireCurrentShopPermission(context.session, 'canManageAppointments', context.prisma); }
  catch (error) { return fail(safeError(error, 'Not authorized to change appointments for this shop.')); }
  const eventKey = `staff-appointment-change:${appointmentId}:${digest(`${shopId}:${key}`)}`;
  try {
    const data = await runSerializableBookingTransaction(context.prisma, async (rawTransaction) => {
      const transaction = rawTransaction as Prisma.TransactionClient;
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-appointment-transition', appointmentId);
      await requireCurrentShopPermission(context.session, 'canManageAppointments', transaction);
      const appointment = await transaction.appointment.findFirst({ where: { id: appointmentId, shopId } });
      if (!appointment) throw new Error('Appointment not found in the active shop.');
      const prior = (await transaction.$queryRawUnsafe<EventRow[]>('SELECT "appointment" AS "appointmentId", action, reason, "nextStartsAt" FROM "AppointmentChangeEvent" WHERE "eventKey" = $1 LIMIT 1', eventKey))[0];
      if (prior) {
        if (prior.appointmentId !== appointmentId || prior.action !== (action === 'cancel' ? 'cancelled' : 'rescheduled') || prior.reason !== reason) throw new Error('This request key was already used for a different appointment change.');
        return { appointmentId, action, status: appointment.status, startsAt: appointment.startsAt.toISOString(), barberId: appointment.barberId, replayed: true };
      }
      if (!['requested', 'confirmed'].includes(String(appointment.status))) throw new Error('Only requested or confirmed appointments can be cancelled or rescheduled. Use the board status actions for guests already in the shop.');
      if (appointment.paymentStatus === 'paid' || appointment.paymentStatus === 'refunded') throw new Error('Settled appointments cannot be changed here.');
      if (!appointment.serviceId || !appointment.barberId) throw new Error('This appointment is missing its service or barber.');
      const snapshot = (await transaction.$queryRawUnsafe<SnapshotRow[]>('SELECT "bookingPolicySnapshot", "bookingAuthoritySnapshot" FROM "Appointment" WHERE id = $1 FOR UPDATE', appointmentId))[0];
      const policy = snapshot?.bookingPolicySnapshot;
      const now = new Date();
      // Operator changes are not limited by the customer self-service reschedule count.
      const consequence = policy
        ? appointmentChangeConsequences({ action: action as 'cancel' | 'reschedule', startsAt: appointment.startsAt, now, paymentStatus: appointment.paymentStatus, depositAmount: appointment.depositAmount, policy, priorReschedules: 0 })
        : { feeAmount: 0, depositConsequence: appointment.paymentStatus === 'deposit_paid' && (appointment.depositAmount || 0) > 0 ? 'manual_review' : 'none' };

      let nextStartsAt: Date | null = null;
      let nextEndsAt: Date | null = null;
      let nextAuthority: unknown = snapshot?.bookingAuthoritySnapshot ?? null;
      let nextBarber: { id: string; displayName: string; chairNumber: string } | null = null;
      if (action === 'reschedule') {
        const startsAt = requestedStart || appointment.startsAt;
        const barberId = nextBarberId || appointment.barberId;
        const slot = await assertStaffSlot(transaction, { shopId, serviceId: appointment.serviceId, barberId, startsAt, durationMinutes: appointment.durationMinutes, excludeAppointmentId: appointment.id });
        nextStartsAt = startsAt; nextEndsAt = slot.endsAt; nextAuthority = slot.authority;
        nextBarber = { id: slot.barber.id, displayName: slot.barber.displayName || '', chairNumber: slot.barber.chairNumber || '' };
        await transaction.$executeRawUnsafe(
          'UPDATE "Appointment" SET "startsAt" = $2, "endsAt" = $3, "bookingAuthoritySnapshot" = $4::jsonb, "barber" = $5, "chair" = $6, "updatedAt" = $7 WHERE id = $1',
          appointmentId, nextStartsAt, nextEndsAt, JSON.stringify(nextAuthority), slot.barber.id, slot.chairId, now,
        );
      } else {
        await transaction.appointment.update({ where: { id: appointmentId }, data: { status: 'cancelled', cancellationReason: reason } });
      }
      await transaction.$executeRawUnsafe(`INSERT INTO "AppointmentChangeEvent" (id, "eventKey", action, "actorType", "actorReferenceHash", reason, "previousStartsAt", "previousEndsAt", "nextStartsAt", "nextEndsAt", "policySnapshot", "authoritySnapshot", "feeAmount", "depositConsequence", "occurredAt", "shop", "appointment", "createdAt", "updatedAt") VALUES ($1,$2,$3::"AppointmentChangeEventActionType",'operator',$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13::"AppointmentChangeEventDepositConsequenceType",$14,$15,$16,$14,$14)`,
        randomUUID(), eventKey, action === 'cancel' ? 'cancelled' : 'rescheduled', digest(context.session?.itemId || ''), reason,
        appointment.startsAt, appointment.endsAt, nextStartsAt, nextEndsAt, JSON.stringify(policy ?? null), JSON.stringify(nextAuthority ?? null),
        consequence.feeAmount, consequence.depositConsequence, now, shopId, appointment.id);
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({
        eventKey: `${eventKey}:outbox`, eventType: action === 'cancel' ? 'appointment.operator_cancelled' : 'appointment.operator_rescheduled',
        aggregateType: 'appointment', aggregateId: appointment.id, shopId, occurredAt: now,
        data: { appointmentId, action, reason, previousStartsAt: appointment.startsAt.toISOString(), nextStartsAt: nextStartsAt?.toISOString() || null, previousBarberId: appointment.barberId, nextBarberId: nextBarber?.id || null, feeAmount: consequence.feeAmount, depositConsequence: consequence.depositConsequence },
      }));
      return {
        appointmentId, action, status: action === 'cancel' ? 'cancelled' : appointment.status,
        startsAt: (nextStartsAt || appointment.startsAt).toISOString(), barberId: nextBarber?.id || appointment.barberId,
        feeAmount: consequence.feeAmount, depositConsequence: consequence.depositConsequence, replayed: false,
      };
    });
    return { success: true, error: null, data };
  } catch (error) {
    return fail(safeError(error, 'Unable to change this appointment. Refresh the booking board before retrying.'));
  }
}
