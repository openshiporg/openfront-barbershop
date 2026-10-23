import { createHash, randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

import { shopMinute } from '../../shared/shop-time';
import { dayKeyForDate, dayRange, isSlotAvailable, occupiedBufferMinutes } from '../utils/availability';
import { clipToPostedHours } from '../../shared/shop-hours';
import {
  assertAppointmentCandidateSetComplete,
  lockBookingResources,
  MAX_BOOKING_CAPACITY_CANDIDATES,
  runSerializableBookingTransaction,
  shopDayAppointmentCandidateFilter,
} from '../utils/bookingCapacity';
import { appointmentChangeConsequences, type BookingPolicySnapshot } from '../utils/bookingPolicy';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { requireEffectivePractitionerAuthority } from '../utils/practitionerAuthority';
import { assertAppointmentAccess } from '../utils/waiverEvidence';

const ACTIVE_STATUSES = ['requested', 'confirmed', 'checked_in', 'in_chair'] as const;

type Args = { appointmentId: string; accessToken?: string | null; action: string; startsAt?: string | null; reason: string; idempotencyKey: string; preview?: boolean | null; acceptedFeeAmount?: number | null };
type Result = { success: boolean; error: string | null; data: unknown | null };
// Trusted Keystone resolver context; never taken from GraphQL arguments.
type Context = { prisma: PrismaClient; session?: { itemId?: string } | null };

type SnapshotRow = { bookingPolicySnapshot: BookingPolicySnapshot | null; bookingAuthoritySnapshot: Record<string, unknown> | null; customerRescheduleCount: number };
type EventRow = { action: string; reason: string; nextStartsAt: Date | null; appointmentId: string; feeAmount: number | null; depositConsequence: string | null };

function digest(value: string) { return createHash('sha256').update(value).digest('hex'); }
function fail(error: string): Result { return { success: false, error, data: null }; }

async function assertRescheduleSlot(transaction: Prisma.TransactionClient, appointment: NonNullable<Awaited<ReturnType<Prisma.TransactionClient['appointment']['findUnique']>>>, startsAt: Date) {
  if (!appointment.serviceId || !appointment.barberId || !appointment.shopId || !appointment.chairId) throw new Error('This appointment is missing assigned capacity.');
  await lockBookingResources(transaction, { serviceId: appointment.serviceId, barberId: appointment.barberId, chairNumber: `${appointment.shopId}:${appointment.chairId}` });
  const [service, barber] = await Promise.all([
    transaction.service.findUnique({ where: { id: appointment.serviceId } }),
    transaction.barber.findUnique({ where: { id: appointment.barberId }, include: { chair: true } }),
  ]);
  if (!service || service.status !== 'active' || !barber || barber.status !== 'active' || !barber.bookingEnabled || barber.chairId !== appointment.chairId || barber.chair?.status !== 'active') {
    throw new Error('The assigned service, practitioner, or chair is no longer available.');
  }
  const durationMinutes = appointment.durationMinutes || service.durationMinutes || 30;
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  // Cleanup is part of the occupied interval for every capacity check below.
  const bufferMinutes = occupiedBufferMinutes(barber.bufferMinutes, service.bookingBufferMinutes);
  const occupiedEndsAt = new Date(endsAt.getTime() + bufferMinutes * 60_000);
  const shop = await transaction.shop.findUnique({ where: { id: appointment.shopId }, select: { timezone: true, hours: true } });
  const timeZone = shop?.timezone || 'UTC';
  const { start, end } = dayRange(startsAt, timeZone);
  const minute = (value: Date) => value <= start ? 0 : value >= end ? 1440 : shopMinute(value, timeZone);
  const [schedule, exceptions, shifts, appointments] = await Promise.all([
    transaction.barberSchedule.findFirst({ where: { barberId: appointment.barberId, dayOfWeek: dayKeyForDate(startsAt, timeZone) as Prisma.EnumBarberScheduleDayOfWeekTypeFilter['equals'], isWorking: true } }),
    transaction.scheduleException.findMany({ where: { shopId: appointment.shopId, status: 'active', startsAt: { lt: occupiedEndsAt }, endsAt: { gt: startsAt }, OR: [{ barberId: appointment.barberId }, { chairId: appointment.chairId }, { exceptionType: 'shop_closure', barberId: null, chairId: null }] } }),
    transaction.staffShift.findMany({ where: { shopId: appointment.shopId, barberId: appointment.barberId, status: { in: ['scheduled', 'clocked_in'] }, scheduledStart: { lt: end }, scheduledEnd: { gt: start } } }),
    transaction.appointment.findMany({ where: { id: { not: appointment.id }, shopId: appointment.shopId, status: { in: [...ACTIVE_STATUSES] }, ...shopDayAppointmentCandidateFilter(start, end, bufferMinutes), OR: [{ barberId: appointment.barberId }, { chairId: appointment.chairId }] }, select: { id: true, startsAt: true, endsAt: true, durationMinutes: true, barberId: true, status: true }, take: MAX_BOOKING_CAPACITY_CANDIDATES + 1 }),
  ]);
  assertAppointmentCandidateSetComplete(appointments);
  const blocking = exceptions.filter((item) => item.exceptionType !== 'working_override');
  if (blocking.length) throw new Error(blocking[0].reason || 'That time is blocked.');
  if (shifts.length && !shifts.some((shift) => startsAt >= shift.scheduledStart && occupiedEndsAt <= shift.scheduledEnd)) throw new Error('That time is outside the barber’s shift.');
  const override = exceptions.find((item) => item.exceptionType === 'working_override');
  const effectiveSchedule = clipToPostedHours(override ? { ...schedule, id: override.id, barberId: appointment.barberId, dayOfWeek: dayKeyForDate(startsAt, timeZone), isWorking: true, startMinute: minute(override.startsAt), endMinute: minute(override.endsAt), breakStartMinute: null, breakEndMinute: null, notes: override.reason, createdAt: override.createdAt, updatedAt: override.updatedAt } : schedule, shop?.hours, dayKeyForDate(startsAt, timeZone));
  if (!isSlotAvailable({
    startsAt,
    timeZone,
    serviceDuration: durationMinutes + bufferMinutes,
    schedule: effectiveSchedule ? { ...effectiveSchedule, dayOfWeek: String(effectiveSchedule.dayOfWeek), barber: { id: barber.id, displayName: barber.displayName } } : null,
    appointments: appointments.map((item) => ({
      id: item.id,
      startsAt: item.startsAt.toISOString(),
      endsAt: item.endsAt?.toISOString() || null,
      durationMinutes: item.durationMinutes || 30,
      status: item.status,
      barber: item.barberId ? { id: item.barberId } : null,
    })),
    occupiedAppointmentBufferMinutes: bufferMinutes,
    blockingWindows: blocking.map((item) => ({ startsAt: item.startsAt, endsAt: item.endsAt, reason: item.reason })),
  })) {
    throw new Error('That slot is unavailable. Choose another time.');
  }
  const authority = await requireEffectivePractitionerAuthority(transaction, { shopId: appointment.shopId, barberId: appointment.barberId, serviceId: appointment.serviceId, at: startsAt });
  return { endsAt, authority };
}

export default async function managePublicAppointment(_root: unknown, args: Args, context: Context): Promise<Result> {
  const action = args.action.trim().toLowerCase();
  const appointmentId = args.appointmentId.trim();
  const reason = args.reason.trim();
  const key = args.idempotencyKey.trim();
  const accessToken = args.accessToken?.trim() || '';
  const sessionItemId = context.session?.itemId || null;
  const preview = args.preview === true;
  if (!['cancel', 'reschedule'].includes(action)) return fail('Action must be cancel or reschedule.');
  if (!appointmentId || (!accessToken && !sessionItemId) || key.length < 8 || key.length > 200 || reason.length < 2 || reason.length > 1000) return fail('Enter a reason for the change.');
  const requestedStart = action === 'reschedule' ? new Date(args.startsAt || '') : null;
  if (requestedStart && Number.isNaN(requestedStart.getTime())) return fail('Choose a new appointment time.');
  const eventKey = `public-appointment-change:${appointmentId}:${digest(key)}`;
  try {
    const data = await runSerializableBookingTransaction(context.prisma, async (rawTransaction) => {
      const transaction = rawTransaction as Prisma.TransactionClient;
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-public-appointment', appointmentId);
      const appointment = await transaction.appointment.findUnique({ where: { id: appointmentId } });
      if (!appointment) throw new Error('Appointment not found.');
      assertAppointmentAccess({ token: accessToken, storedHash: appointment.publicAccessTokenHash, accountId: appointment.accountId, sessionItemId });
      // An already-recorded change is acknowledged before any time-based check.
      const prior = (await transaction.$queryRawUnsafe<EventRow[]>('SELECT action, reason, "nextStartsAt", "appointment" AS "appointmentId", "feeAmount", "depositConsequence" FROM "AppointmentChangeEvent" WHERE "eventKey" = $1 LIMIT 1', eventKey))[0];
      if (prior) {
        if (prior.appointmentId !== appointmentId || prior.action !== (action === 'cancel' ? 'cancelled' : 'rescheduled') || prior.reason !== reason || (requestedStart && prior.nextStartsAt?.getTime() !== requestedStart.getTime())) throw new Error('This change request was already used with different details. Reload the page and try again.');
        return { appointmentId, action, replayed: true, startsAt: prior.nextStartsAt?.toISOString() || null, feeAmount: prior.feeAmount ?? 0, depositConsequence: prior.depositConsequence || 'none' };
      }
      if (requestedStart && requestedStart <= new Date()) throw new Error('Choose a future appointment time.');
      if (!['requested', 'confirmed'].includes(appointment.status || '')) throw new Error('Only requested or confirmed appointments can be changed online. Contact the shop.');
      if (appointment.startsAt <= new Date()) throw new Error('This appointment has already started. Contact the shop to change it.');
      if (!appointment.shopId || !appointment.serviceId || !appointment.barberId || !appointment.customerId) throw new Error('This appointment must be changed by the shop.');
      const snapshot = (await transaction.$queryRawUnsafe<SnapshotRow[]>('SELECT "bookingPolicySnapshot", "bookingAuthoritySnapshot", "customerRescheduleCount" FROM "Appointment" WHERE id = $1 FOR UPDATE', appointmentId))[0];
      if (!snapshot?.bookingPolicySnapshot || !snapshot.bookingAuthoritySnapshot) throw new Error('This appointment must be changed by the shop.');
      const consequence = appointmentChangeConsequences({ action: action as 'cancel' | 'reschedule', startsAt: appointment.startsAt, now: new Date(), paymentStatus: appointment.paymentStatus, depositAmount: appointment.depositAmount, policy: snapshot.bookingPolicySnapshot, priorReschedules: snapshot.customerRescheduleCount });
      let nextStartsAt: Date | null = null;
      let nextEndsAt: Date | null = null;
      let nextAuthority = snapshot.bookingAuthoritySnapshot;
      const slot = action === 'reschedule' && requestedStart ? await assertRescheduleSlot(transaction, appointment, requestedStart) : null;
      if (preview) {
        // Review only: nothing is written. The customer confirms this exact fee.
        return { appointmentId, action, preview: true, startsAt: requestedStart?.toISOString() || appointment.startsAt.toISOString(), feeAmount: consequence.feeAmount, depositConsequence: consequence.depositConsequence, policyName: snapshot.bookingPolicySnapshot.name, policyVersion: snapshot.bookingPolicySnapshot.version };
      }
      if (args.acceptedFeeAmount == null || args.acceptedFeeAmount !== consequence.feeAmount) {
        throw new Error('The change fee is different from what you reviewed. Review the change again before confirming.');
      }
      if (slot && requestedStart) {
        nextStartsAt = requestedStart; nextEndsAt = slot.endsAt; nextAuthority = slot.authority;
        await transaction.$executeRawUnsafe('UPDATE "Appointment" SET "startsAt" = $2, "endsAt" = $3, "bookingAuthoritySnapshot" = $4::jsonb, "customerRescheduleCount" = "customerRescheduleCount" + 1, "updatedAt" = $5 WHERE id = $1', appointmentId, nextStartsAt, nextEndsAt, JSON.stringify(nextAuthority), new Date());
      } else {
        await transaction.appointment.update({ where: { id: appointmentId }, data: { status: 'cancelled', cancellationReason: reason } });
      }
      const occurredAt = new Date();
      const actorReference = appointment.accountId ? `account:${appointment.accountId}` : appointment.publicAccessTokenHash || '';
      await transaction.$executeRawUnsafe(`INSERT INTO "AppointmentChangeEvent" (id, "eventKey", action, "actorType", "actorReferenceHash", reason, "previousStartsAt", "previousEndsAt", "nextStartsAt", "nextEndsAt", "policySnapshot", "authoritySnapshot", "feeAmount", "depositConsequence", "occurredAt", "shop", "appointment", "createdAt", "updatedAt") VALUES ($1,$2,$3::"AppointmentChangeEventActionType",'customer',$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13::"AppointmentChangeEventDepositConsequenceType",$14,$15,$16,$14,$14)`, randomUUID(), eventKey, action === 'cancel' ? 'cancelled' : 'rescheduled', digest(actorReference), reason, appointment.startsAt, appointment.endsAt, nextStartsAt, nextEndsAt, JSON.stringify(snapshot.bookingPolicySnapshot), JSON.stringify(nextAuthority), consequence.feeAmount, consequence.depositConsequence, occurredAt, appointment.shopId, appointment.id);
      await enqueueLifecycleEvent(transaction as never, buildLifecycleEnvelope({ eventKey: `${eventKey}:outbox`, eventType: action === 'cancel' ? 'appointment.customer_cancelled' : 'appointment.customer_rescheduled', aggregateType: 'appointment', aggregateId: appointment.id, shopId: appointment.shopId, occurredAt, data: { appointmentId, action, previousStartsAt: appointment.startsAt.toISOString(), nextStartsAt: nextStartsAt?.toISOString() || null, feeAmount: consequence.feeAmount, depositConsequence: consequence.depositConsequence, policy: snapshot.bookingPolicySnapshot, authority: nextAuthority } }));
      return { appointmentId, action, startsAt: nextStartsAt?.toISOString() || appointment.startsAt.toISOString(), feeAmount: consequence.feeAmount, depositConsequence: consequence.depositConsequence, replayed: false };
    });
    return { success: true, error: null, data };
  } catch (error) { return fail(error instanceof Error && !error.message.includes('Invalid `') ? error.message : 'Unable to change this appointment. Contact the shop.'); }
}
