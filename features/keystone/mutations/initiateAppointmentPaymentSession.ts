import type { Prisma, PrismaClient } from '@prisma/client';

import type { PaymentProviderConfig } from '../../integrations/payment/types';
import { permissions } from '../access';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { createPayment, paymentProviderSettlement } from '../utils/paymentProviderAdapter';
import { hashPublicAccessToken } from '../utils/publicAccessToken';
import { runSerializableTransaction } from '../utils/serializableTransaction';
import { assertUsdSettlementCurrency } from '../utils/supportedSettlementCurrency';
import {
  OPEN_PAYMENT_SESSION_STATUSES,
  lockAppointmentMoney,
  recordOf,
  serializePaymentSession,
} from './paymentSessionResult';

type Args = {
  appointmentId: string;
  amount?: number | null;
  currencyCode?: string | null;
  idempotencyKey: string;
};

type Context = { session?: Parameters<typeof permissions.canManagePayments>[0]['session']; prisma: PrismaClient };

type SessionRequest = { appointmentId: string; amount: number | null; currencyCode: string | null };

function clean(value?: string | null) {
  return value?.trim() || '';
}

function statusOf(value: unknown) {
  return String(recordOf(value).status || '').toLowerCase();
}

function sameRequest(stored: unknown, request: SessionRequest) {
  const original = recordOf(recordOf(stored).request);
  if (!Object.keys(original).length) return null;
  return original.appointmentId === request.appointmentId
    && (original.amount ?? null) === request.amount
    && (original.currencyCode ?? null) === request.currencyCode;
}

export default async function initiateAppointmentPaymentSession(_root: unknown, args: Args, context: Context) {
  if (!permissions.canManagePayments({ session: context.session })) {
    return { success: false, error: 'Not authorized to initiate payment sessions.', paymentSession: null };
  }
  const appointmentId = clean(args.appointmentId);
  const idempotencyKey = clean(args.idempotencyKey);
  if (!appointmentId || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    return { success: false, error: 'Appointment and a valid idempotency key are required.', paymentSession: null };
  }
  const requestedCurrency = clean(args.currencyCode).toUpperCase() || null;
  if (requestedCurrency && !/^[A-Z]{3}$/.test(requestedCurrency)) {
    return { success: false, error: 'Currency code must be a three-letter ISO code.', paymentSession: null };
  }
  if (args.amount != null && (!Number.isSafeInteger(args.amount) || args.amount <= 0)) {
    return { success: false, error: 'Payment session amount must be a whole number of cents greater than zero.', paymentSession: null };
  }
  const request: SessionRequest = { appointmentId, amount: args.amount ?? null, currencyCode: requestedCurrency };

  try {
    const shopId = await requireCurrentShopPermission(context.session, 'canManagePayments');
    const idempotencyKeyHash = hashPublicAccessToken(idempotencyKey);
    const paymentSession = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client as Prisma.TransactionClient;
      await requireCurrentShopPermission(context.session, 'canManagePayments', transaction);
      await transaction.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
        'barbershop-payment-initiation',
        idempotencyKeyHash
      );
      await lockAppointmentMoney(transaction, appointmentId);

      const existing = await transaction.paymentSession.findUnique({
        where: { idempotencyKeyHash },
        select: { id: true, shopId: true, appointmentId: true, metadata: true },
      });
      if (existing) {
        if (existing.shopId !== shopId || existing.appointmentId !== appointmentId || sameRequest(existing.metadata, request) === false) {
          throw new Error('This idempotency key was already used for a different payment request.');
        }
        return transaction.paymentSession.findUniqueOrThrow({
          where: { id: existing.id },
          include: { appointment: true, paymentProvider: true },
        });
      }

      const appointment = await transaction.appointment.findFirst({
        where: { id: appointmentId, shopId },
        include: { shop: { select: { currencyCode: true } } },
      });
      if (!appointment) throw new Error('Appointment not found.');
      if (appointment.transactionId || ['paid', 'refunded'].includes(String(appointment.paymentStatus))) {
        throw new Error('This appointment is already settled and cannot start another payment session.');
      }
      if (['cancelled', 'no_show'].includes(String(appointment.status))) {
        throw new Error('Cancelled or no-show appointments cannot start payment sessions.');
      }

      const currencyCode = appointment.shop.currencyCode;
      assertUsdSettlementCurrency(currencyCode);
      if (requestedCurrency && requestedCurrency !== currencyCode) {
        throw new Error(`Payments for this shop are taken in ${currencyCode}.`);
      }
      if (appointment.price == null) {
        throw new Error('This appointment has no agreed price. Set its price before taking payment.');
      }

      const openSession = await transaction.paymentSession.findFirst({
        where: { appointmentId, shopId, status: { in: [...OPEN_PAYMENT_SESSION_STATUSES] } },
        select: { id: true },
      });
      if (openSession) {
        throw new Error('This appointment already has an open payment session. Cancel it before starting another.');
      }

      const defaultAmount = appointment.depositAmount && appointment.depositAmount > 0 ? appointment.depositAmount : appointment.price;
      const amount = request.amount ?? defaultAmount;
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new Error('Payment session amount must be greater than zero.');
      }
      if (amount > appointment.price) {
        throw new Error('Payment session amount cannot exceed the appointment price.');
      }

      const provider = await transaction.paymentProvider.findFirst({
        where: { shopId, isInstalled: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      if (!provider) throw new Error('No payment provider is set up for this shop.');
      const settlement = paymentProviderSettlement(provider);

      const expiresAt = new Date(Date.now() + 30 * 60_000);
      const created = await transaction.paymentSession.create({
        data: {
          shopId,
          appointmentId,
          paymentProviderId: provider.id,
          idempotencyKeyHash,
          status: 'pending',
          amount,
          currencyCode,
          expiresAt,
          metadata: { request, providerCode: provider.code, settlement },
        },
      });
      const adapterResult = await createPayment({
        provider: provider as PaymentProviderConfig,
        amount,
        currency: currencyCode.toLowerCase(),
        appointmentId,
        paymentSessionId: created.id,
        idempotencyKey,
      });
      const adapterStatus = statusOf(adapterResult);
      const adapterData = recordOf(recordOf(adapterResult).data);
      // Only a processor can report an authorization or an external payment reference.
      // A pay-in-person session stays pending until staff record payment at checkout.
      const externalId = settlement === 'processor'
        ? [recordOf(adapterResult).id, adapterData.id].find((value): value is string => typeof value === 'string' && value.length > 0) ?? null
        : null;
      const status = settlement === 'processor' && adapterStatus === 'authorized' ? 'authorized' : 'pending';
      const updated = await transaction.paymentSession.update({
        where: { id: created.id },
        data: { providerPaymentId: externalId ?? '', status, metadata: { request, providerCode: provider.code, settlement, adapterStatus } },
        include: { appointment: true, paymentProvider: true },
      });
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({
        actorId: context.session?.itemId,
        eventKey: `payment-session:${created.id}:initiated:v1`,
        eventType: 'payment_session.initiated',
        aggregateType: 'payment_session',
        aggregateId: created.id,
        shopId,
        occurredAt: updated.createdAt,
        data: {
          paymentSession: {
            id: created.id,
            appointmentId,
            paymentProviderId: provider.id,
            amount,
            currencyCode,
            settlement,
            providerPaymentId: externalId,
            expiresAt: expiresAt.toISOString(),
          },
        },
      }));
      return updated;
    });
    return { success: true, error: null, paymentSession: serializePaymentSession(paymentSession) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to start the payment session.',
      paymentSession: null,
    };
  }
}
