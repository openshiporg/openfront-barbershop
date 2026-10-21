import type { Prisma, PrismaClient } from '@prisma/client';

import { permissions } from '../access';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { isOfflinePaymentProvider } from '../utils/paymentProviderAdapter';
import { runSerializableTransaction } from '../utils/serializableTransaction';
import { serializePaymentSession } from './paymentSessionResult';

type Args = { paymentSessionId: string };
type Context = { session?: Parameters<typeof permissions.canManagePayments>[0]['session']; prisma: PrismaClient };

export default async function cancelAppointmentPaymentSession(_root: unknown, args: Args, context: Context) {
  if (!permissions.canManagePayments({ session: context.session })) {
    return { success: false, error: 'Not authorized to cancel payment sessions.', paymentSession: null };
  }

  if (!args.paymentSessionId?.trim()) {
    return { success: false, error: 'Payment session is required.', paymentSession: null };
  }

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
        include: { appointment: true, paymentProvider: true },
      });
      if (!paymentSession) throw new Error('Payment session not found.');
      if (paymentSession.status === 'cancelled') return paymentSession;
      if (!['pending', 'authorized'].includes(String(paymentSession.status))) {
        throw new Error(`Payment session in ${paymentSession.status} state cannot be cancelled.`);
      }
      // Withdrawing a pay-in-person session has no remote effect. A processor
      // authorization would need a verified remote cancellation, which no
      // installed adapter provides, so it is not reported as cancelled here.
      if (!paymentSession.paymentProvider || !isOfflinePaymentProvider(paymentSession.paymentProvider)) {
        throw new Error('This payment provider does not support cancelling a payment here. Reconcile the session with the provider.');
      }

      const cancelledAt = new Date();
      const cancelled = await transaction.paymentSession.update({
        where: { id: paymentSession.id },
        data: { status: 'cancelled', cancelledAt },
        include: { appointment: true, paymentProvider: true },
      });
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({
        actorId: context.session?.itemId,
        eventKey: `payment-session:${paymentSession.id}:cancelled:v1`,
        eventType: 'payment_session.cancelled',
        aggregateType: 'payment_session',
        aggregateId: paymentSession.id,
        shopId,
        occurredAt: cancelledAt,
        data: { paymentSession: { id: paymentSession.id, appointmentId: paymentSession.appointmentId, settlement: 'offline' } },
      }));
      return cancelled;
    });
    return { success: true, error: null, paymentSession: serializePaymentSession(updated) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to cancel payment session.',
      paymentSession: null,
    };
  }
}
