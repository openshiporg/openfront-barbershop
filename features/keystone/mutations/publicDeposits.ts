import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

import { stripeConfigured } from '../../integrations/payment/stripe';
import { trustedOrigin } from '../../shared/trusted-origin';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { createPayment, getPaymentStatus } from '../utils/paymentProviderAdapter';
import { resolvePublishedShop } from '../utils/publicShop';
import { hashPublicAccessToken } from '../utils/publicAccessToken';
import { assertAppointmentAccess } from '../utils/waiverEvidence';

type Context = { session?: { itemId?: string }; prisma: PrismaClient; sudo(): { prisma: PrismaClient } };
type Args = { appointmentId: string; accessToken?: string | null };

const STRIPE_CODE = 'pp_stripe';

/** The shop's installed Stripe provider, when online card payments are set up. */
export async function onlineDepositProvider(prisma: PrismaClient | Prisma.TransactionClient, shopId: string) {
  if (!stripeConfigured()) return null;
  return prisma.paymentProvider.findFirst({ where: { shopId, code: STRIPE_CODE, isInstalled: true }, select: { id: true, code: true } });
}

/** Whether the storefront can take deposits online. */
export async function getPublicPaymentOptions(_root: unknown, _args: unknown, context: Context) {
  const prisma = context.sudo().prisma;
  const shop = await resolvePublishedShop(prisma, { id: true });
  return { onlineDeposits: Boolean(shop && (await onlineDepositProvider(prisma, shop.id))) };
}

async function loadAppointment(context: Context, args: Args) {
  const prisma = context.sudo().prisma;
  const appointment = await prisma.appointment.findUnique({
    where: { id: String(args.appointmentId || '') },
    select: { id: true, shopId: true, status: true, paymentStatus: true, depositAmount: true, serviceTitleSnapshot: true, publicAccessTokenHash: true, accountId: true },
  });
  if (!appointment) throw new Error('Appointment not found.');
  assertAppointmentAccess({ token: args.accessToken?.trim() || '', storedHash: appointment.publicAccessTokenHash, accountId: appointment.accountId, sessionItemId: context.session?.itemId || null });
  return { prisma, appointment };
}

/** Opens (or reuses) a Stripe Checkout for the visit's deposit and returns its URL. */
export async function startDepositCheckout(_root: unknown, args: Args, context: Context) {
  try {
    const { prisma, appointment } = await loadAppointment(context, args);
    if (!['requested', 'confirmed'].includes(String(appointment.status)) || appointment.paymentStatus !== 'deposit_due') throw new Error('This visit has no deposit to pay.');
    const amount = appointment.depositAmount || 0;
    if (amount <= 0) throw new Error('This visit has no deposit to pay.');
    const provider = await onlineDepositProvider(prisma, appointment.shopId);
    if (!provider) throw new Error('Online deposits are not available. Pay the deposit in the shop.');

    const open = await prisma.paymentSession.findFirst({ where: { appointmentId: appointment.id, paymentProviderId: provider.id, status: 'pending', amount }, orderBy: { createdAt: 'desc' } });
    const openUrl = open && typeof (open.metadata as Record<string, unknown> | null)?.checkoutUrl === 'string' ? String((open.metadata as Record<string, unknown>).checkoutUrl) : '';
    if (open && openUrl && (!open.expiresAt || open.expiresAt > new Date())) return { success: true, error: null, data: { url: openUrl } };

    const origin = trustedOrigin();
    const returnTo = `${origin}/appointment?id=${encodeURIComponent(appointment.id)}`;
    const key = randomUUID();
    const result = await createPayment({
      provider: { code: provider.code },
      amount, currency: 'usd', description: `Deposit · ${appointment.serviceTitleSnapshot || 'Appointment'}`,
      successUrl: `${returnTo}&deposit=return`, cancelUrl: `${returnTo}&deposit=cancelled`,
      idempotencyKey: key, metadata: { appointmentId: appointment.id },
    }) as { id?: string; url?: string | null };
    if (!result.id || !result.url) throw new Error('Stripe did not open a checkout.');
    await prisma.paymentSession.create({ data: {
      shopId: appointment.shopId, appointmentId: appointment.id, paymentProviderId: provider.id,
      idempotencyKeyHash: hashPublicAccessToken(`deposit:${key}`), status: 'pending', amount, currencyCode: 'USD',
      providerPaymentId: result.id, expiresAt: new Date(Date.now() + 23 * 3600_000), metadata: { checkoutUrl: result.url, purpose: 'deposit' },
    } });
    return { success: true, error: null, data: { url: result.url } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to open the deposit checkout.', data: null };
  }
}

/** Reads the Checkout back from Stripe and records a paid deposit. */
export async function confirmDepositCheckout(_root: unknown, args: Args, context: Context) {
  try {
    const { prisma, appointment } = await loadAppointment(context, args);
    if (appointment.paymentStatus === 'deposit_paid') return { success: true, error: null, data: { paid: true } };
    const session = await prisma.paymentSession.findFirst({ where: { appointmentId: appointment.id, status: 'pending', paymentProvider: { code: STRIPE_CODE } }, orderBy: { createdAt: 'desc' }, include: { paymentProvider: { select: { code: true } } } });
    if (!session || !session.paymentProvider) return { success: true, error: null, data: { paid: false } };
    const status = await getPaymentStatus({ provider: { code: session.paymentProvider.code }, paymentId: session.providerPaymentId }) as { status?: string; amount?: number | null };
    if (status.status === 'expired') {
      await prisma.paymentSession.update({ where: { id: session.id }, data: { status: 'expired' } });
      return { success: true, error: null, data: { paid: false } };
    }
    if (status.status !== 'captured') return { success: true, error: null, data: { paid: false } };
    if (Number(status.amount) !== session.amount) throw new Error('The amount paid does not match the deposit. Contact the shop.');
    const capturedAt = new Date();
    await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.paymentSession.updateMany({ where: { id: session.id, status: 'pending' }, data: { status: 'captured', capturedAt } });
      if (!claimed.count) return;
      await transaction.appointment.update({ where: { id: appointment.id }, data: { paymentStatus: 'deposit_paid' } });
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({
        eventKey: `payment-session:${session.id}:captured:v1`, eventType: 'payment_session.captured', aggregateType: 'payment_session', aggregateId: session.id,
        shopId: appointment.shopId, occurredAt: capturedAt, data: { paymentSession: { id: session.id, appointmentId: appointment.id, amount: session.amount, purpose: 'deposit' } },
      }));
    });
    return { success: true, error: null, data: { paid: true } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to check the deposit.', data: null };
  }
}
