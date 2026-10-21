import type { Prisma, PrismaClient } from '@prisma/client';

import type { PaymentProviderConfig } from '../../integrations/payment/types';
import { permissions } from '../access';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { isOfflinePaymentProvider, refundPayment } from '../utils/paymentProviderAdapter';
import { hashPublicAccessToken } from '../utils/publicAccessToken';
import { runSerializableTransaction } from '../utils/serializableTransaction';
import { lockAppointmentMoney, recordOf, serializePaymentSession } from './paymentSessionResult';

type Args = { paymentSessionId: string; amount?: number | null; idempotencyKey: string };
type Context = { session?: Parameters<typeof permissions.canManagePayments>[0]['session']; prisma: PrismaClient };

export default async function refundAppointmentPaymentSession(_root: unknown, args: Args, context: Context) {
  if (!permissions.canManagePayments({ session: context.session })) {
    return { success: false, error: 'Not authorized to refund payment sessions.', paymentSession: null };
  }
  const idempotencyKey = args.idempotencyKey?.trim() || '';
  if (!args.paymentSessionId?.trim() || !idempotencyKey || idempotencyKey.length > 200) {
    return { success: false, error: 'Payment session and a refund idempotency key are required.', paymentSession: null };
  }
  if (args.amount != null && (!Number.isSafeInteger(args.amount) || args.amount <= 0)) {
    return { success: false, error: 'Refund amount must be a whole number of cents greater than zero.', paymentSession: null };
  }
  const requestedAmount = args.amount ?? undefined;

  try {
    const shopId = await requireCurrentShopPermission(context.session, 'canManagePayments');
    const updated = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client as Prisma.TransactionClient;
      await requireCurrentShopPermission(context.session, 'canManagePayments', transaction);
      await transaction.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
        'barbershop-payment-session',
        args.paymentSessionId
      );
      const paymentSession = await transaction.paymentSession.findFirst({
        where: { id: args.paymentSessionId, shopId },
        include: { appointment: true, transaction: true, paymentProvider: true },
      });
      if (!paymentSession) throw new Error('Payment session not found.');
      const provider = paymentSession.paymentProvider;
      if (!provider) throw new Error('Payment provider is missing.');
      if (isOfflinePaymentProvider(provider)) {
        throw new Error('Pay-in-person payments are not refunded by a processor. Record a cash refund from the checkout receipt.');
      }

      const eventKey = `payment-refund:${shopId}:${hashPublicAccessToken(idempotencyKey)}:v1`;
      const replay = await transaction.lifecycleOutboxEvent.findUnique({ where: { eventKey } });
      if (replay) {
        const payload = recordOf(replay.payload);
        const refund = recordOf(recordOf(payload.data).refund);
        if (replay.shopId !== shopId || payload.aggregateId !== paymentSession.id || refund.requestedAmount !== requestedAmount) {
          throw new Error('Refund idempotency key was reused for a different refund.');
        }
        return paymentSession;
      }
      if (!['captured', 'partially_refunded'].includes(String(paymentSession.status))) {
        throw new Error(`Payment session in ${paymentSession.status} state cannot be refunded.`);
      }
      const metadata = recordOf(paymentSession.metadata);
      if (typeof metadata.providerCode === 'string' && metadata.providerCode !== provider.code) {
        throw new Error('The payment provider changed after this session started. Reconcile it before refunding.');
      }
      if (!paymentSession.providerPaymentId) throw new Error('This session has no processor payment reference to refund.');

      const capturedAmount = Math.max(0, paymentSession.amount);
      const alreadyRefunded = Math.max(0, paymentSession.refundedAmount || 0);
      const remaining = Math.max(0, capturedAmount - alreadyRefunded);
      const refundAmount = requestedAmount ?? remaining;
      if (refundAmount <= 0 || refundAmount > remaining) {
        throw new Error('Refund amount must be positive and no greater than the remaining captured amount.');
      }
      await lockAppointmentMoney(transaction, paymentSession.appointmentId);

      const result = recordOf(await refundPayment({
        provider: provider as PaymentProviderConfig,
        paymentId: paymentSession.providerPaymentId,
        amount: refundAmount,
        currency: paymentSession.currencyCode.toLowerCase(),
        paymentSessionId: paymentSession.id,
        appointmentId: paymentSession.appointmentId,
        idempotencyKey,
      }));
      const status = String(result.status || '').toLowerCase();
      if (!['refunded', 'succeeded'].includes(status)) throw new Error('Payment provider did not refund the session.');
      if (result.amount != null && Number(result.amount) !== refundAmount) {
        throw new Error('Payment provider reported a different refund amount. Reconcile this session.');
      }

      const refundedAmount = alreadyRefunded + refundAmount;
      const fullyRefunded = refundedAmount >= capturedAmount;
      const refundedAt = new Date();
      const refunded = await transaction.paymentSession.update({
        where: { id: paymentSession.id },
        data: { status: fullyRefunded ? 'refunded' : 'partially_refunded', refundedAmount },
        include: { appointment: true, transaction: true, paymentProvider: true },
      });
      // Only roll the appointment back when this session's deposit is the money on it.
      // A cash/package checkout receipt keeps its own paid/refunded truth.
      if (paymentSession.appointmentId && fullyRefunded) {
        await transaction.appointment.updateMany({
          where: { id: paymentSession.appointmentId, shopId, paymentStatus: 'deposit_paid', transactionId: null },
          data: { paymentStatus: 'refunded' },
        });
      }
      if (paymentSession.transaction?.id) {
        await transaction.checkoutTransaction.update({
          where: { id: paymentSession.transaction.id },
          data: { status: fullyRefunded ? 'refunded' : 'partially_refunded' },
        });
      }
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({
        actorId: context.session?.itemId,
        eventKey,
        eventType: fullyRefunded ? 'payment_session.refunded' : 'payment_session.partially_refunded',
        aggregateType: 'payment_session',
        aggregateId: paymentSession.id,
        shopId,
        occurredAt: refundedAt,
        data: {
          refund: {
            requestedAmount,
            amount: refundAmount,
            refundedAmount,
            capturedAmount,
          },
          settlement: {
            appointmentId: paymentSession.appointmentId,
            transactionId: paymentSession.transaction?.id,
            providerPaymentId: paymentSession.providerPaymentId,
          },
        },
      }));
      return refunded;
    });
    return { success: true, error: null, paymentSession: serializePaymentSession(updated) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to refund payment session.',
      paymentSession: null,
    };
  }
}
