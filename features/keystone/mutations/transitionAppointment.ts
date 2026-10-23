import type { Prisma, PrismaClient } from '@prisma/client';

import { permissions } from '../access';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';
import { lockBookingResources } from '../utils/bookingCapacity';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { assertAppointmentTransition } from '../utils/lifecycleState';
import { hashPublicAccessToken } from '../utils/publicAccessToken';
import { runSerializableTransaction } from '../utils/serializableTransaction';
import { assertAuthorityMatches, requireEffectivePractitionerAuthority, type PractitionerAuthoritySnapshot } from '../utils/practitionerAuthority';
import { getAppointmentWaiverRequirement, requireSignedWaiver } from '../utils/waiverEvidence';
import { formatShopDateTime, shopDateKey } from '../../shared/shop-time';
import { sendAppointmentEmail } from '../lib/mail';

/** Tells the customer the shop confirmed their visit; mail failures are ignored. */
async function sendConfirmedNotice(prisma: PrismaClient, appointmentId: string) {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, startsAt: true, serviceTitleSnapshot: true, barberNameSnapshot: true, customer: { select: { email: true } }, shop: { select: { name: true, timezone: true } } },
    });
    const to = appointment?.customer?.email?.trim();
    if (!appointment || !to) return;
    await sendAppointmentEmail({
      to,
      subject: `Booking confirmed · ${appointment.shop.name}`,
      heading: 'Your visit is confirmed',
      lines: [
        `${appointment.serviceTitleSnapshot || 'Appointment'} with ${appointment.barberNameSnapshot || 'your barber'}`,
        formatShopDateTime(appointment.startsAt, appointment.shop.timezone || 'UTC'),
      ],
      path: `/appointment?id=${encodeURIComponent(appointment.id)}`,
      action: 'View booking',
    });
  } catch { /* best effort */ }
}

type Args = { appointmentId: string; toStatus: string; idempotencyKey: string };
type Context = { session?: Parameters<typeof permissions.canManageAppointments>[0]['session']; prisma: PrismaClient };
const STATUSES = new Set(['requested', 'confirmed', 'checked_in', 'in_chair', 'completed', 'cancelled', 'no_show']);

export default async function transitionAppointment(_root: unknown, args: Args, context: Context) {
  if (!permissions.canManageAppointments({ session: context.session })) {
    return { success: false, error: 'Not authorized to transition appointments.', appointment: null };
  }
  const appointmentId = args.appointmentId?.trim();
  const toStatus = args.toStatus?.trim();
  const idempotencyKey = args.idempotencyKey?.trim();
  if (!appointmentId || !STATUSES.has(toStatus) || !idempotencyKey || idempotencyKey.length > 200) {
    return { success: false, error: 'Appointment, target status, and idempotency key are required.', appointment: null };
  }

  // No-show and policy cancellation have dedicated, policy-aware commands.
  if (toStatus === 'no_show') {
    return { success: false, error: 'Use Mark no-show so the grace period and no-show policy are applied.', appointment: null };
  }

  let confirmedNow = false;
  try {
    const appointment = await runSerializableTransaction(context.prisma, async (client) => {
      confirmedNow = false;
      const transaction = client as Prisma.TransactionClient;
      // Authorize first; only then read the appointment, scoped to the shop.
      const shopId = await requireCurrentShopPermission(context.session, 'canManageAppointments', transaction);
      await transaction.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
        'barbershop-appointment-transition',
        appointmentId
      );
      const current = await transaction.appointment.findFirst({ where: { id: appointmentId, shopId } });
      if (!current || !current.shopId) throw new Error('Appointment not found.');

      const commandHash = hashPublicAccessToken(idempotencyKey);
      const eventKey = `appointment-command:${commandHash}:v1`;
      const replay = await transaction.lifecycleOutboxEvent.findUnique({ where: { eventKey } });
      if (replay) {
        const payload = replay.payload as { aggregateId?: string; shopId?: string; data?: { transition?: { toStatus?: string; actorId?: string | null } } } | null;
        if (payload?.aggregateId !== appointmentId || payload.shopId !== shopId || payload.data?.transition?.toStatus !== toStatus
          || (payload.data.transition.actorId !== undefined && payload.data.transition.actorId !== (context.session?.itemId ?? null))) {
          throw new Error('Appointment idempotency key was reused for a different command.');
        }
        return current;
      }
      // Same-state requests are no-ops: original acceptance, start and
      // completion facts are never rewritten.
      if (current.status === toStatus) return current;
      if (toStatus === 'cancelled' && current.status !== 'checked_in') {
        throw new Error('Use Cancel appointment so the booking policy, fees and deposit rules are applied.');
      }

      assertAppointmentTransition(String(current.status), toStatus, {
        paymentStatus: current.paymentStatus,
        startsAt: current.startsAt,
      });
      if (toStatus === 'checked_in' || toStatus === 'in_chair') {
        const shop = await transaction.shop.findUnique({ where: { id: shopId }, select: { timezone: true } });
        const timeZone = shop?.timezone || 'UTC';
        if (current.startsAt && shopDateKey(current.startsAt, timeZone) !== shopDateKey(new Date(), timeZone)) {
          throw new Error('Check-in and seating happen on the appointment’s day.');
        }
      }
      if (toStatus === 'in_chair') {
        if (!current.barberId || !current.serviceId) throw new Error('Appointment practitioner and service are required.');
        await lockBookingResources(transaction, { serviceId: current.serviceId, barberId: current.barberId, chairNumber: current.barberChairNumberSnapshot || null });
        if (current.chairId) {
          const chair = await transaction.barberChair.findFirst({ where: { id: current.chairId, shopId }, select: { status: true } });
          if (!chair || chair.status !== 'active') throw new Error('The assigned chair is not available. Reassign the appointment before starting service.');
        }
        const barber = await transaction.barber.findFirst({ where: { id: current.barberId, shopId }, select: { status: true } });
        if (!barber || barber.status !== 'active') throw new Error('The assigned barber is not active.');
        const occupied = await transaction.appointment.findFirst({
          where: {
            shopId, status: 'in_chair', id: { not: current.id },
            OR: [{ barberId: current.barberId }, ...(current.chairId ? [{ chairId: current.chairId }] : [])],
          },
          select: { id: true },
        });
        if (occupied) throw new Error('This barber or chair is still serving another guest. Complete that service first.');
      }
      let authorityEvidence: unknown = null;
      if (toStatus === 'confirmed' || toStatus === 'in_chair' || toStatus === 'completed') {
        if (!current.barberId || !current.serviceId || !current.customerId) throw new Error('Appointment practitioner, service, and customer linkage is required.');
        authorityEvidence = await requireEffectivePractitionerAuthority(transaction, {
          shopId: current.shopId,
          barberId: current.barberId,
          serviceId: current.serviceId,
          at: toStatus === 'confirmed' ? current.startsAt : new Date(),
        });
        if (toStatus === 'completed') {
          const executionRows = await transaction.$queryRawUnsafe<Array<{ executionAuthoritySnapshot: PractitionerAuthoritySnapshot | null; serviceStartedAt: Date | null }>>('SELECT "executionAuthoritySnapshot", "serviceStartedAt" FROM "Appointment" WHERE id = $1 LIMIT 1', current.id);
          if (!executionRows[0]?.executionAuthoritySnapshot || !executionRows[0].serviceStartedAt) throw new Error('Recorded execution authority is required before completion.');
          assertAuthorityMatches(executionRows[0].executionAuthoritySnapshot, { shopId: current.shopId, barberId: current.barberId, serviceId: current.serviceId, at: executionRows[0].serviceStartedAt });
        }
        if (toStatus === 'in_chair' || toStatus === 'completed') {
          const waiver = await getAppointmentWaiverRequirement(transaction, current.id);
          if (waiver.required) await requireSignedWaiver(transaction, { appointmentId: current.id, serviceId: current.serviceId, customerId: current.customerId, templateHash: waiver.templateHash });
        }
      }
      const updated = await transaction.appointment.update({
        where: { id: current.id },
        data: {
          status: toStatus as Prisma.AppointmentUpdateInput['status'],
          ...(toStatus === 'cancelled' ? { cancellationReason: 'Cancelled by staff after check-in' } : {}),
        },
      });
      if (toStatus === 'confirmed') {
        await transaction.$executeRawUnsafe('UPDATE "Appointment" SET "bookingAuthoritySnapshot" = $2::jsonb WHERE id = $1', current.id, JSON.stringify(authorityEvidence));
        confirmedNow = true;
      }
      if (toStatus === 'in_chair') {
        await transaction.$executeRawUnsafe('UPDATE "Appointment" SET "executionAuthoritySnapshot" = $2::jsonb, "serviceStartedAt" = $3 WHERE id = $1', current.id, JSON.stringify(authorityEvidence), updated.updatedAt);
      }
      if (toStatus === 'completed') {
        await transaction.$executeRawUnsafe('UPDATE "Appointment" SET "serviceCompletedAt" = $2 WHERE id = $1', current.id, updated.updatedAt);
      }
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId,
        eventKey,
        eventType: `appointment.${toStatus}`,
        aggregateType: 'appointment',
        aggregateId: current.id,
        shopId: current.shopId,
        occurredAt: updated.updatedAt,
        data: {
          transition: { fromStatus: current.status, toStatus, actorId: context.session?.itemId ?? null },
          appointment: { id: current.id, startsAt: current.startsAt.toISOString(), paymentStatus: current.paymentStatus },
          authorityEvidence,
        },
      }));
      return updated;
    });
    if (confirmedNow) void sendConfirmedNotice(context.prisma, appointment.id);

    return {
      success: true,
      error: null,
      appointment: {
        id: appointment.id,
        status: appointment.status,
        paymentStatus: appointment.paymentStatus,
        updatedAt: appointment.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to transition appointment.', appointment: null };
  }
}
