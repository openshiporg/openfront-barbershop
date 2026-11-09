import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

import { permissions } from '../access';
import { trustedOrigin } from '../../shared/trusted-origin';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';
import { buildCommandReceipt, recordCommandReceipt } from '../utils/commandReceipt';
import { createPayment, getPaymentStatus, refundPayment } from '../utils/paymentProviderAdapter';
import { hashPublicAccessToken } from '../utils/publicAccessToken';
import { onlineDepositProvider } from './publicDeposits';
import { recordOf } from './paymentSessionResult';
import checkoutAppointment from './checkoutAppointment';

/**
 * Card at the chair (Square / Booksy "charge card"): the POS prices the ticket, Stripe hosts the card form
 * (on the counter screen or the client's phone through a pay link), and checkout records the sale against
 * the captured session once Stripe confirms. Refunds then go back to the card through the existing refund flow.
 */

type Context = { session?: Parameters<typeof permissions.canManagePayments>[0]['session']; prisma: PrismaClient };
type Ticket = { tipAmount: number; discountAmount: number; taxAmount: number; notes: string };
export type DeskCardResult = { success: boolean; error: string | null; data: { sessionId: string; url: string | null; amount: number; status: string; recorded: boolean; transactionId?: string | null } | null };

const fail = (error: string): DeskCardResult => ({ success: false, error, data: null });
const cents = (value: unknown) => {
  const amount = Number(value ?? 0);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 2_000_000_000) throw new Error('Amounts must be whole cents.');
  return amount;
};

function deskData(session: { metadata: unknown }) {
  return recordOf(session.metadata);
}

/** The ticket total for card: service price + tip + tax − discount, minus a deposit already paid online. */
async function ticketTotal(prisma: PrismaClient | Prisma.TransactionClient, shopId: string, appointmentId: string, ticket: Ticket) {
  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, shopId }, select: { id: true, status: true, price: true, paymentStatus: true, depositAmount: true, transactionId: true, serviceTitleSnapshot: true, customer: { select: { email: true } } } });
  if (!appointment) throw new Error('Appointment not found.');
  if (appointment.transactionId || appointment.paymentStatus === 'paid') throw new Error('This visit is already paid.');
  if (appointment.status !== 'in_chair') throw new Error('Seat this visit before taking payment.');
  if (appointment.price == null) throw new Error('This appointment has no agreed price.');
  const subtotal = appointment.price;
  const discount = Math.min(ticket.discountAmount, subtotal);
  const total = subtotal + ticket.tipAmount + ticket.taxAmount - discount;
  const deposit = appointment.paymentStatus === 'deposit_paid' ? Math.min(appointment.depositAmount || 0, total) : 0;
  return { appointment, total, collect: total - deposit };
}

export async function startDeskCardPayment(_root: unknown, args: { appointmentId: string; tipAmount?: number | null; discountAmount?: number | null; taxAmount?: number | null; notes?: string | null }, context: Context): Promise<DeskCardResult> {
  if (!permissions.canManagePayments({ session: context.session })) return fail('Not authorized to take payments.');
  try {
    const shopId = await requireCurrentShopPermission(context.session, 'canManagePayments');
    const ticket: Ticket = { tipAmount: cents(args.tipAmount), discountAmount: cents(args.discountAmount), taxAmount: cents(args.taxAmount), notes: (args.notes || '').trim().slice(0, 500) };
    const { appointment, collect } = await ticketTotal(context.prisma, shopId, args.appointmentId, ticket);
    if (collect <= 0) return fail('Nothing to collect by card. Record the visit with cash tender.');
    const provider = await onlineDepositProvider(context.prisma, shopId);
    if (!provider) return fail('Card payments need Stripe connected. Use Card terminal to record a payment taken elsewhere.');

    // Reuse an open card page for the same ticket; a changed ticket closes the old page first.
    const open = await context.prisma.paymentSession.findMany({ where: { shopId, appointmentId: appointment.id, status: 'pending', paymentProviderId: provider.id }, orderBy: { createdAt: 'desc' } });
    for (const session of open) {
      const data = deskData(session);
      if (data.purpose !== 'desk_card') continue;
      const same = session.amount === collect && JSON.stringify(data.ticket) === JSON.stringify(ticket);
      if (same && typeof data.checkoutUrl === 'string' && (!session.expiresAt || session.expiresAt > new Date())) {
        return { success: true, error: null, data: { sessionId: session.id, url: data.checkoutUrl, amount: session.amount, status: 'pending', recorded: false } };
      }
      const status = recordOf(await getPaymentStatus({ provider: { code: provider.code }, paymentId: session.providerPaymentId }));
      if (status.status === 'captured') return fail('A card payment for this visit was already taken. Press Check payment to record it.');
      await expireCheckout(session.providerPaymentId);
      await context.prisma.paymentSession.update({ where: { id: session.id }, data: { status: 'cancelled', cancelledAt: new Date() } });
    }

    const key = randomUUID();
    const back = `${trustedOrigin()}/pay`;
    const result = recordOf(await createPayment({
      provider: { code: provider.code }, amount: collect, currency: 'usd', description: `${appointment.serviceTitleSnapshot || 'Visit'}`,
      successUrl: `${back}?result=paid`, cancelUrl: `${back}?result=cancelled`, idempotencyKey: key,
      metadata: { appointmentId: appointment.id, purpose: 'desk_card' }, customerEmail: appointment.customer?.email || '',
    }));
    const url = typeof result.url === 'string' ? result.url : '';
    if (!result.id || !url) throw new Error('Stripe did not open a card page.');
    const session = await context.prisma.paymentSession.create({ data: {
      shopId, appointmentId: appointment.id, paymentProviderId: provider.id, idempotencyKeyHash: hashPublicAccessToken(`desk-card:${key}`),
      status: 'pending', amount: collect, currencyCode: 'USD', providerPaymentId: String(result.id), expiresAt: new Date(Date.now() + 23 * 3600_000),
      metadata: { purpose: 'desk_card', checkoutUrl: url, ticket, operatorId: context.session?.itemId || null },
    } });
    return { success: true, error: null, data: { sessionId: session.id, url, amount: collect, status: 'pending', recorded: false } };
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Unable to open a card payment.');
  }
}

async function expireCheckout(checkoutId: string) {
  if (!checkoutId || !process.env.STRIPE_SECRET_KEY) return;
  await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(checkoutId)}/expire`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }, redirect: 'error' }).catch(() => undefined);
}

/** Reads the card page from Stripe; once paid, completes checkout against the captured session (exact total). */
export async function checkDeskCardPayment(_root: unknown, args: { paymentSessionId: string }, context: Context): Promise<DeskCardResult> {
  if (!permissions.canManagePayments({ session: context.session })) return fail('Not authorized to take payments.');
  try {
    const shopId = await requireCurrentShopPermission(context.session, 'canManagePayments');
    let session = await context.prisma.paymentSession.findFirst({ where: { id: args.paymentSessionId, shopId }, include: { paymentProvider: { select: { code: true } }, transaction: { select: { id: true } } } });
    const data = session ? deskData(session) : {};
    if (!session || data.purpose !== 'desk_card' || !session.appointmentId || !session.paymentProvider) return fail('Card payment not found.');
    if (session.transaction) return { success: true, error: null, data: { sessionId: session.id, url: null, amount: session.amount, status: 'captured', recorded: true, transactionId: session.transaction.id } };
    if (session.status === 'pending') {
      const status = recordOf(await getPaymentStatus({ provider: { code: session.paymentProvider.code }, paymentId: session.providerPaymentId }));
      if (status.status === 'expired') {
        await context.prisma.paymentSession.update({ where: { id: session.id }, data: { status: 'expired', cancelledAt: new Date() } });
        return { success: true, error: 'The card page expired without payment.', data: { sessionId: session.id, url: null, amount: session.amount, status: 'expired', recorded: false } };
      }
      if (status.status !== 'captured') return { success: true, error: null, data: { sessionId: session.id, url: String(data.checkoutUrl || ''), amount: session.amount, status: 'pending', recorded: false } };
      if (Number(status.amount) !== session.amount) return fail('Stripe reports a different amount. Check this payment in Stripe.');
      const capturedAt = new Date();
      await context.prisma.$transaction(async (transaction) => {
        const claimed = await transaction.paymentSession.updateMany({ where: { id: session!.id, status: 'pending' }, data: { status: 'captured', capturedAt } });
        if (!claimed.count) return;
        await recordCommandReceipt(transaction, buildCommandReceipt({
          actorId: context.session?.itemId, eventKey: `payment-session:${session!.id}:captured:v1`, eventType: 'payment_session.captured', aggregateType: 'payment_session', aggregateId: session!.id,
          shopId, occurredAt: capturedAt, data: { paymentSession: { id: session!.id, appointmentId: session!.appointmentId, amount: session!.amount, purpose: 'desk_card' } },
        }));
      });
      session = { ...session, status: 'captured' };
    }
    if (session.status !== 'captured') return { success: true, error: null, data: { sessionId: session.id, url: null, amount: session.amount, status: String(session.status), recorded: false } };
    const ticket = recordOf(data.ticket);
    const result = await checkoutAppointment(null, {
      appointmentId: session.appointmentId!, paymentMethod: 'card', tipAmount: Number(ticket.tipAmount || 0), discountAmount: Number(ticket.discountAmount || 0), taxAmount: Number(ticket.taxAmount || 0),
      notes: String(ticket.notes || ''), paymentSessionId: session.id, idempotencyKey: `desk-card-checkout:${session.id}`,
    }, context);
    if (!result.success) return { success: false, error: `Card paid, but checkout was not recorded: ${result.error}`, data: { sessionId: session.id, url: null, amount: session.amount, status: 'captured', recorded: false } };
    return { success: true, error: null, data: { sessionId: session.id, url: null, amount: session.amount, status: 'captured', recorded: true, transactionId: result.transaction?.id || null } };
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Unable to check the card payment.');
  }
}

/** Closes an unpaid card page, or refunds a card that was taken but never recorded on a sale. */
export async function cancelDeskCardPayment(_root: unknown, args: { paymentSessionId: string }, context: Context): Promise<DeskCardResult> {
  if (!permissions.canManagePayments({ session: context.session })) return fail('Not authorized to take payments.');
  try {
    const shopId = await requireCurrentShopPermission(context.session, 'canManagePayments');
    const session = await context.prisma.paymentSession.findFirst({ where: { id: args.paymentSessionId, shopId }, include: { paymentProvider: { select: { code: true } }, transaction: { select: { id: true } } } });
    if (!session || deskData(session).purpose !== 'desk_card' || !session.paymentProvider) return fail('Card payment not found.');
    if (session.transaction) return fail('This card payment is on a receipt. Refund it from Payments.');
    const status = session.status === 'pending' ? recordOf(await getPaymentStatus({ provider: { code: session.paymentProvider.code }, paymentId: session.providerPaymentId })) : { status: session.status };
    if (status.status === 'captured') {
      await refundPayment({ provider: { code: session.paymentProvider.code }, paymentId: session.providerPaymentId, amount: session.amount, idempotencyKey: `desk-card-refund:${session.id}` });
      await context.prisma.paymentSession.update({ where: { id: session.id }, data: { status: 'refunded', refundedAmount: session.amount, capturedAt: session.capturedAt || new Date() } });
      return { success: true, error: null, data: { sessionId: session.id, url: null, amount: session.amount, status: 'refunded', recorded: false } };
    }
    await expireCheckout(session.providerPaymentId);
    await context.prisma.paymentSession.update({ where: { id: session.id }, data: { status: 'cancelled', cancelledAt: new Date() } });
    return { success: true, error: null, data: { sessionId: session.id, url: null, amount: session.amount, status: 'cancelled', recorded: false } };
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Unable to cancel the card payment.');
  }
}

/** Open card page for a ticket, so the POS shows it again after a refresh. */
export async function openDeskCardPayment(_root: unknown, args: { appointmentId: string }, context: Context): Promise<DeskCardResult> {
  if (!permissions.canManagePayments({ session: context.session })) return fail('Not authorized to take payments.');
  try {
    const shopId = await requireCurrentShopPermission(context.session, 'canManagePayments');
    const rows = await context.prisma.paymentSession.findMany({ where: { shopId, appointmentId: args.appointmentId, status: { in: ['pending', 'captured'] }, transaction: null }, orderBy: { createdAt: 'desc' }, take: 5 });
    const session = rows.find((row) => deskData(row).purpose === 'desk_card');
    if (!session) return { success: true, error: null, data: null };
    return { success: true, error: null, data: { sessionId: session.id, url: String(deskData(session).checkoutUrl || ''), amount: session.amount, status: String(session.status), recorded: false } };
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Unable to read card payments.');
  }
}
