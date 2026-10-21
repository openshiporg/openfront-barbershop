import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

import type { PaymentProviderConfig } from '../../integrations/payment/types';
import { permissions } from '../access';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';
import { buildLifecycleEnvelope, canonicalJson, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { getPaymentStatus, isOfflinePaymentProvider } from '../utils/paymentProviderAdapter';
import { hashPublicAccessToken } from '../utils/publicAccessToken';
import { runSerializableTransaction } from '../utils/serializableTransaction';
import { appointmentSettledElsewhere, lockAppointmentMoney, recordOf } from './paymentSessionResult';

type Args = { paymentSessionId: string; idempotencyKey: string };
type Context = { session?: Parameters<typeof permissions.canManagePayments>[0]['session']; prisma: PrismaClient };
type SessionStatus = 'pending' | 'authorized' | 'captured' | 'failed' | 'expired' | 'cancelled' | 'partially_refunded' | 'refunded';

const REMOTE_STATUS: Record<string, SessionStatus> = {
  pending: 'pending',
  authorized: 'authorized',
  captured: 'captured',
  paid: 'captured',
  succeeded: 'captured',
  partially_refunded: 'partially_refunded',
  refunded: 'refunded',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  expired: 'expired',
  failed: 'failed',
};

// Legal forward transitions only. Captured money is never erased by a later
// failed/cancelled observation, and refunds need a reported refund amount.
const ALLOWED: Record<string, SessionStatus[]> = {
  pending: ['authorized', 'captured', 'failed', 'cancelled', 'expired'],
  authorized: ['captured', 'failed', 'cancelled', 'expired'],
  captured: ['partially_refunded', 'refunded'],
  partially_refunded: ['partially_refunded', 'refunded'],
};

function reconciliationResult(row: { id: string; paymentSessionId: string | null; localStatusBefore: string; remoteStatus: string; localStatusAfter: string; changed: boolean; observedAt: Date }) {
  return {
    id: row.id,
    paymentSessionId: row.paymentSessionId,
    localStatusBefore: row.localStatusBefore,
    remoteStatus: row.remoteStatus,
    localStatusAfter: row.localStatusAfter,
    changed: row.changed,
    observedAt: row.observedAt.toISOString(),
  };
}

export default async function reconcilePaymentSession(_root: unknown, args: Args, context: Context) {
  if (!permissions.canManagePayments({ session: context.session })) return { success: false, error: 'Not authorized to reconcile payments.', reconciliation: null };
  const idempotencyKey = args.idempotencyKey?.trim() || '';
  if (!args.paymentSessionId?.trim() || !idempotencyKey || idempotencyKey.length > 200) return { success: false, error: 'Payment session and idempotency key are required.', reconciliation: null };
  try {
    const shopId = await requireCurrentShopPermission(context.session, 'canManagePayments');
    const commandHash = hashPublicAccessToken(idempotencyKey);
    const reconciliation = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client as Prisma.TransactionClient;
      await requireCurrentShopPermission(context.session, 'canManagePayments', transaction);
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-payment-session', args.paymentSessionId);
      const eventKey = `payment-reconciliation:${commandHash}:v1`;
      const replay = await transaction.paymentReconciliation.findUnique({ where: { eventKey } });
      if (replay) {
        if (replay.shopId !== shopId || replay.paymentSessionId !== args.paymentSessionId) throw new Error('Reconciliation idempotency key was already used.');
        return replay;
      }
      const paymentSession = await transaction.paymentSession.findFirst({
        where: { id: args.paymentSessionId, shopId }, include: { paymentProvider: true, transaction: true },
      });
      if (!paymentSession || !paymentSession.paymentProvider) throw new Error('Payment session or provider was not found.');
      if (isOfflinePaymentProvider(paymentSession.paymentProvider)) {
        throw new Error('Pay-in-person sessions have no processor status to reconcile. Record payment at checkout.');
      }
      if (!paymentSession.providerPaymentId) throw new Error('This session has no processor payment reference to reconcile.');
      const providerResult = recordOf(await getPaymentStatus({
        provider: paymentSession.paymentProvider as PaymentProviderConfig,
        paymentId: paymentSession.providerPaymentId,
        amount: paymentSession.amount,
        currency: paymentSession.currencyCode.toLowerCase(),
        paymentSessionId: paymentSession.id,
        appointmentId: paymentSession.appointmentId,
      }));
      const remoteStatus = String(providerResult.status || '').toLowerCase();
      const observed = REMOTE_STATUS[remoteStatus];
      if (!observed) throw new Error('The provider returned a payment status that cannot be reconciled automatically.');
      if (providerResult.amount != null && Number(providerResult.amount) !== paymentSession.amount) {
        throw new Error('The provider reported a different amount. Review this payment with the provider.');
      }
      if (typeof providerResult.currency === 'string' && providerResult.currency.toUpperCase() !== paymentSession.currencyCode.toUpperCase()) {
        throw new Error('The provider reported a different currency. Review this payment with the provider.');
      }

      const before = String(paymentSession.status);
      const reportedRefund = Number(providerResult.refundedAmount);
      const refundKnown = Number.isSafeInteger(reportedRefund) && reportedRefund >= 0 && reportedRefund <= paymentSession.amount;
      let next: string = before;
      let refundedAmount = paymentSession.refundedAmount ?? 0;
      if (observed !== before && ALLOWED[before]?.includes(observed)) {
        if (observed === 'refunded' || observed === 'partially_refunded') {
          if (refundKnown && reportedRefund > refundedAmount) {
            refundedAmount = reportedRefund;
            next = reportedRefund >= paymentSession.amount ? 'refunded' : 'partially_refunded';
          }
        } else {
          next = observed;
        }
      } else if (before === 'partially_refunded' && observed === 'partially_refunded' && refundKnown && reportedRefund > refundedAmount) {
        refundedAmount = reportedRefund;
      }
      const changed = next !== before || refundedAmount !== (paymentSession.refundedAmount ?? 0);
      const observedAt = new Date();
      if (changed) {
        await lockAppointmentMoney(transaction, paymentSession.appointmentId);
        await transaction.paymentSession.update({
          where: { id: paymentSession.id },
          data: {
            status: next as Prisma.PaymentSessionUpdateInput['status'],
            refundedAmount,
            ...(next === 'captured' && !paymentSession.capturedAt ? { capturedAt: observedAt } : {}),
          },
        });
        const appointment = paymentSession.appointmentId
          ? await transaction.appointment.findFirst({ where: { id: paymentSession.appointmentId, shopId }, select: { id: true, paymentStatus: true, transactionId: true } })
          : null;
        if (appointment && !appointmentSettledElsewhere(appointment.paymentStatus) && next === 'captured') {
          await transaction.appointment.update({ where: { id: appointment.id }, data: { paymentStatus: 'deposit_paid' } });
        }
        if (appointment && next === 'refunded' && appointment.paymentStatus === 'deposit_paid' && !appointment.transactionId) {
          await transaction.appointment.update({ where: { id: appointment.id }, data: { paymentStatus: 'refunded' } });
        }
        if (paymentSession.transaction?.id && ['partially_refunded', 'refunded'].includes(next)) {
          await transaction.checkoutTransaction.update({ where: { id: paymentSession.transaction.id }, data: { status: next as Prisma.CheckoutTransactionUpdateInput['status'] } });
        }
      }
      const providerPayloadHash = createHash('sha256').update(canonicalJson(providerResult)).digest('hex');
      const created = await transaction.paymentReconciliation.create({ data: {
        shopId, eventKey, paymentSessionId: paymentSession.id,
        localStatusBefore: before, remoteStatus, localStatusAfter: next,
        changed, amount: paymentSession.amount, providerPayloadHash, observedAt,
      } });
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({
        actorId: context.session?.itemId,
        eventKey: `${eventKey}:outbox`, eventType: 'payment_session.reconciled', aggregateType: 'payment_session', aggregateId: paymentSession.id,
        shopId, occurredAt: observedAt,
        data: { reconciliation: { id: created.id, localStatusBefore: before, remoteStatus, localStatusAfter: next, changed, amount: paymentSession.amount, refundedAmount } },
      }));
      return created;
    });
    return { success: true, error: null, reconciliation: reconciliationResult(reconciliation) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to reconcile payment.', reconciliation: null };
  }
}
