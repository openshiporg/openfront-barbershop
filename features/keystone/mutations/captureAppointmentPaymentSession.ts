import type { Prisma, PrismaClient } from '@prisma/client';

import type { PaymentProviderConfig } from '../../integrations/payment/types';
import { permissions } from '../access';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';
import { capturePayment, isOfflinePaymentProvider } from '../utils/paymentProviderAdapter';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { runSerializableTransaction } from '../utils/serializableTransaction';
import {
  appointmentSettledElsewhere,
  lockAppointmentMoney,
  recordOf,
  serializePaymentSession,
} from './paymentSessionResult';

type Args = { paymentSessionId: string };
type Context = { session?: Parameters<typeof permissions.canManagePayments>[0]['session']; prisma: PrismaClient };

export default async function captureAppointmentPaymentSession(_root: unknown, args: Args, context: Context) {
  if (!permissions.canManagePayments({ session: context.session })) {
    return { success: false, error: 'Not authorized to capture payment sessions.', paymentSession: null };
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
      const provider = paymentSession.paymentProvider;
      if (!provider) throw new Error('Payment provider is missing.');
      if (isOfflinePaymentProvider(provider)) {
        throw new Error('Pay-in-person sessions are not captured by a processor. Record the payment at checkout.');
      }
      if (paymentSession.status === 'captured') return paymentSession;
      if (!provider.isInstalled) throw new Error('This payment provider is disabled and cannot capture new payments.');
      const metadata = recordOf(paymentSession.metadata);
      if (typeof metadata.providerCode === 'string' && metadata.providerCode !== provider.code) {
        throw new Error('The payment provider changed after this session started. Reconcile it before capturing.');
      }
      if (!paymentSession.providerPaymentId) throw new Error('This session has no processor payment reference to capture.');
      if (!['pending', 'authorized'].includes(String(paymentSession.status))) {
        throw new Error(`Payment session in ${paymentSession.status} state cannot be captured.`);
      }
      if (paymentSession.expiresAt && paymentSession.expiresAt <= new Date()) {
        throw new Error('Payment session has expired.');
      }
      await lockAppointmentMoney(transaction, paymentSession.appointmentId);
      const appointment = paymentSession.appointmentId
        ? await transaction.appointment.findFirst({ where: { id: paymentSession.appointmentId, shopId }, select: { id: true, paymentStatus: true } })
        : null;
      if (appointment && appointmentSettledElsewhere(appointment.paymentStatus)) {
        throw new Error('This appointment was already settled at checkout. Cancel this session instead.');
      }

      const result = recordOf(await capturePayment({
        provider: provider as PaymentProviderConfig,
        paymentId: paymentSession.providerPaymentId,
        amount: paymentSession.amount,
        currency: paymentSession.currencyCode.toLowerCase(),
        paymentSessionId: paymentSession.id,
        appointmentId: paymentSession.appointmentId,
      }));
      const status = String(result.status || '').toLowerCase();
      if (!['captured', 'paid', 'succeeded'].includes(status)) {
        throw new Error('Payment provider did not capture the session.');
      }
      if (result.amount != null && Number(result.amount) !== paymentSession.amount) {
        throw new Error('Payment provider reported a different captured amount. Reconcile this session.');
      }
      if (typeof result.currency === 'string' && result.currency.toUpperCase() !== paymentSession.currencyCode.toUpperCase()) {
        throw new Error('Payment provider reported a different currency. Reconcile this session.');
      }

      const capturedAt = new Date();
      const captured = await transaction.paymentSession.update({
        where: { id: paymentSession.id },
        data: { status: 'captured', capturedAt },
        include: { appointment: true, paymentProvider: true },
      });
      if (appointment) {
        await transaction.appointment.update({
          where: { id: appointment.id },
          data: { paymentStatus: 'deposit_paid' },
        });
      }
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({
        actorId: context.session?.itemId,
        eventKey: `payment-session:${paymentSession.id}:captured:v1`,
        eventType: 'payment_session.captured',
        aggregateType: 'payment_session',
        aggregateId: paymentSession.id,
        shopId,
        occurredAt: capturedAt,
        data: {
          paymentSession: {
            id: paymentSession.id,
            appointmentId: paymentSession.appointmentId,
            amount: paymentSession.amount,
            currencyCode: paymentSession.currencyCode,
            providerPaymentId: paymentSession.providerPaymentId,
          },
        },
      }));
      return captured;
    });
    return { success: true, error: null, paymentSession: serializePaymentSession(updated) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to capture payment session.',
      paymentSession: null,
    };
  }
}
