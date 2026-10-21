import type { Prisma, PrismaClient } from '@prisma/client';

import { permissions } from '../access';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';
import { dayKeyForDate, dayRange, occupiedBufferMinutes } from '../utils/availability';
import { shopMinute } from '../../shared/shop-time';
import { lockBookingResources } from '../utils/bookingCapacity';
import { runSerializableTransaction } from '../utils/serializableTransaction';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { requireEffectivePractitionerAuthority } from '../utils/practitionerAuthority';
import { getWaiverRequirement } from '../utils/waiverEvidence';

const ACTIVE_APPOINTMENT_STATUSES = ['requested', 'confirmed', 'checked_in', 'in_chair'] as const;

type Args = { queueEntryId: string };
type Context = { session?: Parameters<typeof permissions.canManageQueue>[0]['session']; prisma: PrismaClient };

export default async function seatWalkInQueueEntry(_root: unknown, args: Args, context: Context) {
  if (!permissions.canManageQueue({ session: context.session })) {
    return { success: false, error: 'Not authorized to seat walk-ins.', seated: null };
  }

  const queueEntryId = args.queueEntryId?.trim();
  if (!queueEntryId) {
    return { success: false, error: 'Queue entry is required.', seated: null };
  }

  try {
    const seated = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client as Prisma.TransactionClient;
      // Authorize before reading any private queue/customer details.
      const shopId = await requireCurrentShopPermission(context.session, 'canManageQueue', transaction);
      await transaction.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
        'barbershop-walk-in',
        `queue:${queueEntryId}`
      );

      const entry = await transaction.walkInQueueEntry.findFirst({
        where: { id: queueEntryId, shopId },
        include: {
          shop: { select: { id: true, timezone: true } },
          requestedService: { include: { specialists: { select: { id: true } } } },
          requestedBarber: { include: { chair: { select: { id: true, shopId: true, status: true } } } },
          appointment: { select: { id: true } },
          customer: { select: { id: true } },
        },
      });
      if (!entry) throw new Error('Walk-in not found.');
      if (!entry.shopId || !entry.requestedService) throw new Error('Walk-in needs a shop and active requested service.');
      if (!['waiting', 'texted'].includes(entry.status || '') || entry.appointment) {
        throw new Error('Walk-in has already been seated or is no longer waiting.');
      }
      if (entry.requestedService.status !== 'active') throw new Error('Requested service is no longer active.');

      const specialistIds = entry.requestedService.specialists.map((barber) => barber.id);
      const requestedService = entry.requestedService;
      const shopIdForEntry = entry.shopId;
      // "Any barber" walk-ins try every eligible active barber, not only the first.
      const candidates = entry.requestedBarber ? [entry.requestedBarber] : await transaction.barber.findMany({
        where: {
          shopId: entry.shopId,
          status: 'active',
          bookingEnabled: true,
          ...(specialistIds.length > 0 ? { id: { in: specialistIds } } : {}),
        },
        orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
        take: 50,
        include: { chair: { select: { id: true, shopId: true, status: true } } },
      });
      if (!candidates.length) throw new Error('No active barber is available for this walk-in.');
      const evaluate = async (barber: (typeof candidates)[number]) => {
        if (!barber || barber.status !== 'active' || !barber.bookingEnabled || barber.shopId !== shopIdForEntry) {
          throw new Error('No active barber is available for this walk-in.');
        }
        if (!barber.chair) throw new Error('The requested barber does not have an assigned chair.');
        if (requestedService.shopId !== shopIdForEntry || barber.chair.shopId !== shopIdForEntry) {
          throw new Error('Walk-in service, barber, and chair must belong to the same shop.');
        }
        if (barber.chair.status !== 'active') throw new Error('The requested chair is unavailable.');
        if (specialistIds.length > 0 && !specialistIds.includes(barber.id)) {
          throw new Error('Requested barber does not provide this service.');
        }

        await lockBookingResources(transaction, {
          serviceId: requestedService.id,
          barberId: barber.id,
          chairNumber: `${shopIdForEntry}:${barber.chair.id}`,
        });

        const startsAt = new Date();
        const timeZone = entry.shop?.timezone || '';
        try { new Intl.DateTimeFormat('en', { timeZone }).format(startsAt); } catch { throw new Error('Shop timezone is unavailable.'); }
        const durationMinutes = requestedService.durationMinutes || 30;
        const bufferMinutes = occupiedBufferMinutes(barber.bufferMinutes, requestedService.bookingBufferMinutes);
        const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
        const capacityEndsAt = new Date(endsAt.getTime() + bufferMinutes * 60_000);
        const capacityStartsAt = new Date(startsAt.getTime() - bufferMinutes * 60_000);
        // Shop-local day, not the server timezone.
        const { start: shiftDayStart, end: shiftDayEnd } = dayRange(startsAt, timeZone);
        const [conflict, exceptions, shifts, weeklySchedule] = await Promise.all([
          transaction.appointment.findFirst({
            where: {
              shopId: shopIdForEntry,
              status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
              AND: [
                { OR: [{ barberId: barber.id }, { chairId: barber.chair.id }] },
                {
                  OR: [
                    // A guest still in the chair occupies it until the service is completed.
                    { status: 'in_chair' },
                    { startsAt: { lt: capacityEndsAt }, endsAt: { gt: capacityStartsAt } },
                    // Legacy rows without an end are never treated as free capacity.
                    { startsAt: { lt: capacityEndsAt }, endsAt: null },
                  ],
                },
              ],
            },
            select: { id: true },
          }),
          transaction.scheduleException.findMany({
            where: {
              shopId: shopIdForEntry, status: 'active', startsAt: { lt: capacityEndsAt }, endsAt: { gt: startsAt },
              OR: [
                { barberId: barber.id },
                { exceptionType: 'shop_closure', barberId: null, chairId: null },
                ...(barber.chair?.id ? [{ chairId: barber.chair.id }] : []),
              ],
            },
            select: { reason: true, exceptionType: true, startsAt: true, endsAt: true },
          }),
          transaction.staffShift.findMany({ where: { shopId: shopIdForEntry, barberId: barber.id, status: { in: ['scheduled', 'clocked_in'] }, scheduledStart: { lt: shiftDayEnd }, scheduledEnd: { gt: shiftDayStart } }, select: { scheduledStart: true, scheduledEnd: true } }),
          transaction.barberSchedule.findFirst({
            where: { barberId: barber.id, dayOfWeek: dayKeyForDate(startsAt, timeZone) as Prisma.EnumBarberScheduleDayOfWeekTypeFilter['equals'], isWorking: true },
            select: { startMinute: true, endMinute: true, breakStartMinute: true, breakEndMinute: true },
          }),
        ]);
        if (conflict) throw new Error('The requested barber or chair is currently occupied.');
        const blocking = exceptions.find((item) => item.exceptionType !== 'working_override');
        if (blocking) throw new Error(blocking.reason || 'The requested barber or chair is unavailable.');
        const override = exceptions.find((item) => item.exceptionType === 'working_override' && item.startsAt <= startsAt && item.endsAt >= capacityEndsAt);
        if (!override) {
          // Weekly working hours apply to walk-ins exactly as to online bookings.
          const startMinute = shopMinute(startsAt, timeZone);
          const endMinute = startMinute + durationMinutes + bufferMinutes;
          if (!weeklySchedule || startMinute < (weeklySchedule.startMinute ?? 0) || endMinute > (weeklySchedule.endMinute ?? 0)) {
            throw new Error('The barber is outside working hours for this service.');
          }
          const breakStart = weeklySchedule.breakStartMinute; const breakEnd = weeklySchedule.breakEndMinute;
          if (breakStart != null && breakEnd != null && startMinute < breakEnd && endMinute > breakStart) throw new Error('The barber is on a scheduled break.');
        }
        if (shifts.length && !shifts.some((shift) => startsAt >= shift.scheduledStart && capacityEndsAt <= shift.scheduledEnd)) throw new Error('The barber is outside the scheduled shift.');
        const [authority, waiver] = await Promise.all([
          requireEffectivePractitionerAuthority(transaction, { shopId: shopIdForEntry, barberId: barber.id, serviceId: requestedService.id, at: startsAt }),
          getWaiverRequirement(transaction, requestedService.id),
        ]);
        return { barber: { ...barber, chair: barber.chair }, startsAt, endsAt, durationMinutes, authority, waiver };
      };
      let chosen: Awaited<ReturnType<typeof evaluate>> | null = null;
      let lastError: unknown = null;
      for (const candidate of candidates) {
        try { chosen = await evaluate(candidate); break; } catch (error) { lastError = error; if (entry.requestedBarber) throw error; }
      }
      if (!chosen) throw (lastError instanceof Error ? lastError : new Error('No active barber is available for this walk-in.'));
      const { barber, startsAt, endsAt, durationMinutes, authority, waiver } = chosen;
      if (waiver.required) throw new Error('Waiver-required walk-ins must be booked and signed before seating.');

      const customerName = entry.customerName.trim() || 'Walk-in guest';
      const [firstName, ...lastName] = customerName.split(/\s+/);
      // Walk-in contact details are not identity proof: never attach the guest to
      // an existing customer (or their history and balances) by phone match.
      const customer = entry.customer ?? await transaction.customer.create({
          data: {
            shopId: entry.shopId,
            firstName,
            lastName: lastName.join(' '),
            phone: entry.phone || `walk-in-${entry.id}`,
            status: 'active',
          },
          select: { id: true },
        });

      const appointment = await transaction.appointment.create({
        data: {
          shopId: entry.shopId,
          chairId: barber.chair.id,
          customerId: customer.id,
          barberId: barber.id,
          serviceId: entry.requestedService.id,
          queueEntryId: entry.id,
          startsAt,
          endsAt,
          durationMinutes,
          serviceTitleSnapshot: entry.requestedService.name,
          serviceImagePathSnapshot: entry.requestedService.imagePath,
          serviceModifiersSnapshot: [],
          barberNameSnapshot: barber.displayName,
          barberChairNumberSnapshot: barber.chairNumber,
          status: 'in_chair',
          source: 'walk_in',
          paymentStatus: entry.requestedService.depositRequired ? 'deposit_due' : 'not_required',
          price: entry.requestedService.price,
          depositAmount: entry.requestedService.depositAmount || 0,
          customerNotes: entry.notes,
        },
      });
      await transaction.$executeRawUnsafe('UPDATE "Appointment" SET "bookingAuthoritySnapshot" = $2::jsonb, "executionAuthoritySnapshot" = $2::jsonb, "waiverRequirementSnapshot" = $3::jsonb, "serviceStartedAt" = $4 WHERE id = $1', appointment.id, JSON.stringify(authority), JSON.stringify(waiver), startsAt);
      const updatedQueue = await transaction.walkInQueueEntry.update({
        where: { id: entry.id },
        data: {
          status: 'in_chair',
          seatedAt: startsAt,
          customerId: customer.id,
          requestedBarberId: barber.id,
        },
      });

      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId,
        eventKey: `queue:${entry.id}:seated:${appointment.id}:v1`,
        eventType: 'queue.seated',
        aggregateType: 'walk_in_queue_entry',
        aggregateId: entry.id,
        shopId: entry.shopId,
        occurredAt: updatedQueue.updatedAt,
        data: {
          queueEntry: { id: entry.id, status: updatedQueue.status, actorId: context.session?.itemId ?? null },
          appointment: { id: appointment.id, barberId: barber.id, chairId: barber.chair.id, authority, waiverRequirement: waiver },
        },
      }));

      return {
        queueEntryId: entry.id,
        appointmentId: appointment.id,
        status: 'in_chair',
        startsAt: startsAt.toISOString(),
        barberId: barber.id,
        chairNumber: barber.chairNumber,
      };
    });

    return { success: true, error: null, seated };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to seat this walk-in.',
      seated: null,
    };
  }
}
