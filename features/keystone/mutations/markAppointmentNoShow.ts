import type { Prisma, PrismaClient } from '@prisma/client';

import { permissions } from '../access';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { calculateNoShowEvidence } from '../utils/remainingLifecycle';
import { hashPublicAccessToken } from '../utils/publicAccessToken';
import { runSerializableTransaction } from '../utils/serializableTransaction';

type Args = { appointmentId: string; policyId?: string | null; reason: string; idempotencyKey: string };
type Context = { session?: Parameters<typeof permissions.canManageAppointments>[0]['session']; prisma: PrismaClient };

export default async function markAppointmentNoShow(_root: unknown, args: Args, context: Context) {
  if (!permissions.canManageAppointments({ session: context.session })) {
    return { success: false, error: 'Not authorized to mark no-shows.', evidence: null };
  }
  const appointmentId = args.appointmentId?.trim();
  const reason = args.reason?.trim();
  const idempotencyKey = args.idempotencyKey?.trim();
  if (!appointmentId || !reason || reason.length > 500 || !idempotencyKey) {
    return { success: false, error: 'Appointment, reason, and idempotency key are required.', evidence: null };
  }

  try {
    const evidence = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client as Prisma.TransactionClient;
      const shopId = await requireCurrentShopPermission(context.session, 'canManageAppointments', transaction);
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-no-show', appointmentId);
      const now = new Date();
      // Only a current, time-valid membership (not any prepaid package balance)
      // can qualify for a membership fee waiver.
      const appointment = await transaction.appointment.findFirst({
        where: { id: appointmentId, shopId },
        include: { customer: { include: { packageBalances: {
          where: { status: 'active', membershipPlanId: { not: null }, startsAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          take: 1,
        } } } },
      });
      if (!appointment) throw new Error('Appointment not found.');

      const commandHash = hashPublicAccessToken(idempotencyKey);
      const eventKey = `appointment-no-show:${commandHash}:v1`;
      const replay = await transaction.noShowEvent.findUnique({ where: { eventKey } });
      if (replay) {
        if (
          replay.appointmentId !== appointmentId
          || replay.reason !== reason
          || (args.policyId && replay.policyId !== args.policyId)
        ) throw new Error('No-show idempotency key was reused with different input.');
        return replay;
      }
      if (!['confirmed', 'checked_in'].includes(String(appointment.status))) {
        throw new Error(`Appointment in ${appointment.status} state cannot be marked no-show.`);
      }

      const policy = args.policyId
        ? await transaction.noShowPolicy.findFirst({ where: { id: args.policyId, shopId: appointment.shopId, status: 'active' } })
        : await transaction.noShowPolicy.findFirst({ where: { shopId: appointment.shopId, status: 'active' }, orderBy: { createdAt: 'asc' } });
      if (!policy) throw new Error('An active no-show policy is required.');
      const snapshot = calculateNoShowEvidence(policy, { hasMembership: Boolean(appointment.customer?.packageBalances.length) });
      const eligibleAt = new Date(appointment.startsAt.getTime() + snapshot.graceMinutes * 60_000);
      if (new Date() < eligibleAt) throw new Error(`No-show can be recorded after the ${snapshot.graceMinutes}-minute grace period.`);

      const markedAt = new Date();
      const created = await transaction.noShowEvent.create({
        data: {
          shopId: appointment.shopId,
          eventKey,
          appointmentId,
          customerId: appointment.customerId,
          policyId: policy.id,
          policyNameSnapshot: policy.name,
          feeAmount: snapshot.feeAmount,
          graceMinutes: snapshot.graceMinutes,
          feeWaived: snapshot.feeWaived,
          reason,
          markedAt,
        },
      });
      await transaction.appointment.update({ where: { id: appointmentId }, data: { status: 'no_show', cancellationReason: reason } });
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId,
        eventKey: `${eventKey}:outbox`, eventType: 'appointment.no_show', aggregateType: 'appointment', aggregateId: appointmentId,
        shopId: appointment.shopId, occurredAt: markedAt,
        data: { noShow: { evidenceId: created.id, policyId: policy.id, policyName: policy.name, ...snapshot, reason, actorId: context.session?.itemId ?? null } },
      }));
      return created;
    });
    return { success: true, error: null, evidence: { id: evidence.id, appointmentId: evidence.appointmentId, feeAmount: evidence.feeAmount, feeWaived: evidence.feeWaived, markedAt: evidence.markedAt.toISOString() } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to mark no-show.', evidence: null };
  }
}
