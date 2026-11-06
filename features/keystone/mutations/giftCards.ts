import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

import { permissions } from '../access';
import { sendAppointmentEmail } from '../lib/mail';
import { trustedOrigin } from '../../shared/trusted-origin';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { createPayment, getPaymentStatus } from '../utils/paymentProviderAdapter';
import { hashPublicAccessToken } from '../utils/publicAccessToken';
import { resolvePublishedShop } from '../utils/publicShop';
import { onlineDepositProvider } from './publicDeposits';
import { recordOf } from './paymentSessionResult';

/**
 * Online gift cards (Square / Booksy): pick an amount, pay on Stripe's hosted page, and the card activates
 * only after the payment is read back from Stripe. The code is emailed to the recipient and shown to the
 * buyer. At the chair the POS takes a code as tender; each debit is appended to the card's ledger.
 */

type Context = { session?: Parameters<typeof permissions.canManagePayments>[0]['session']; prisma: PrismaClient; sudo(): { prisma: PrismaClient } };
type Ledger = Array<{ at: string; type: 'purchase' | 'redeem'; amount: number; balance: number; ref: string }>;

export const GIFT_CARD_AMOUNTS = [2500, 5000, 7500, 10000, 15000, 20000];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usd = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

function codeFor(key: string) {
  return createHash('sha256').update(key).digest('hex').slice(0, 12).toUpperCase().match(/.{1,4}/g)!.join('-');
}
export function normalizeGiftCode(code: string) {
  const raw = code.toUpperCase().replace(/[^0-9A-F]/g, '');
  return raw.length === 12 ? raw.match(/.{1,4}/g)!.join('-') : '';
}
function orderToken(giftCardId: string) {
  const secret = process.env.SESSION_SECRET || '';
  if (secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters long');
  return createHmac('sha256', secret).update(`barbershop-gift:${giftCardId}`).digest('hex');
}
function tokenOk(giftCardId: string, token?: string | null) {
  if (!token || token.length !== 64) return false;
  const a = Buffer.from(orderToken(giftCardId)); const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Whether the storefront sells gift cards online. */
export async function giftCardOptions(prisma: PrismaClient) {
  const shop = await resolvePublishedShop(prisma, { id: true });
  return { online: Boolean(shop && (await onlineDepositProvider(prisma, (shop as { id: string }).id))), amounts: GIFT_CARD_AMOUNTS };
}

export async function startGiftCardCheckout(_root: unknown, args: { amount: number; purchaserName: string; purchaserEmail: string; recipientName?: string | null; recipientEmail?: string | null; message?: string | null }, context: Context) {
  const fail = (error: string) => ({ success: false, error, data: null });
  try {
    if (!GIFT_CARD_AMOUNTS.includes(args.amount)) return fail('Choose one of the gift card amounts.');
    const purchaserName = (args.purchaserName || '').trim(); const purchaserEmail = (args.purchaserEmail || '').trim().toLowerCase();
    const recipientEmail = (args.recipientEmail || '').trim().toLowerCase() || purchaserEmail;
    const recipientName = (args.recipientName || '').trim() || purchaserName;
    const message = (args.message || '').trim();
    if (!purchaserName || purchaserName.length > 120 || recipientName.length > 120) return fail('Enter your name.');
    if (!EMAIL.test(purchaserEmail) || !EMAIL.test(recipientEmail)) return fail('Enter a valid email address.');
    if (message.length > 500) return fail('Keep the message under 500 characters.');
    const prisma = context.sudo().prisma;
    const shop = await resolvePublishedShop(prisma, { id: true, name: true }) as { id: string; name: string } | null;
    if (!shop) return fail('Gift cards are unavailable right now.');
    const provider = await onlineDepositProvider(prisma, shop.id);
    if (!provider) return fail('Online gift cards are unavailable right now. Buy one in the shop.');

    const key = randomUUID();
    const expiresAt = new Date(); expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    const card = await prisma.giftCard.create({ data: {
      shopId: shop.id, code: codeFor(`gift:${key}`), status: 'pending', initialValue: args.amount, balance: args.amount,
      purchaserName, purchaserEmail, recipientName, recipientEmail, message, expiresAt,
    } });
    const back = `${trustedOrigin()}/gift-cards/order?id=${encodeURIComponent(card.id)}&token=${orderToken(card.id)}`;
    try {
      const result = recordOf(await createPayment({
        provider: { code: provider.code }, amount: args.amount, currency: 'usd', description: `${shop.name} gift card · ${usd(args.amount)}`,
        successUrl: back, cancelUrl: `${back}&result=cancelled`, idempotencyKey: key, customerEmail: purchaserEmail,
        metadata: { purpose: 'gift_card', giftCardId: card.id },
      }));
      if (!result.id || typeof result.url !== 'string') throw new Error('Stripe did not open a checkout.');
      const session = await prisma.paymentSession.create({ data: {
        shopId: shop.id, paymentProviderId: provider.id, idempotencyKeyHash: hashPublicAccessToken(`gift-card:${key}`), status: 'pending',
        amount: args.amount, currencyCode: 'USD', providerPaymentId: String(result.id), expiresAt: new Date(Date.now() + 23 * 3600_000),
        metadata: { purpose: 'gift_card', giftCardId: card.id, checkoutUrl: result.url },
      } });
      await prisma.giftCard.update({ where: { id: card.id }, data: { paymentSessionId: session.id } });
      return { success: true, error: null, data: { url: result.url } };
    } catch (error) {
      console.error('Gift card checkout could not be opened:', error);
      await prisma.giftCard.update({ where: { id: card.id }, data: { status: 'cancelled' } });
      return fail('Online gift cards are unavailable right now. Buy one in the shop.');
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Unable to start the gift card order.');
  }
}

/** Reads the hosted checkout back from Stripe and activates the card once paid. Safe to call repeatedly. */
export async function settleGiftCard(prisma: PrismaClient, giftCardId: string) {
  const card = await prisma.giftCard.findUnique({ where: { id: giftCardId }, include: { paymentSession: { include: { paymentProvider: { select: { code: true } } } } } });
  if (!card) throw new Error('Gift card order not found.');
  const session = card.paymentSession;
  if (card.status === 'pending' && session?.paymentProvider && session.status === 'pending') {
    const remote = recordOf(await getPaymentStatus({ provider: { code: session.paymentProvider.code }, paymentId: session.providerPaymentId }));
    if (remote.status === 'expired') {
      await prisma.$transaction([
        prisma.paymentSession.update({ where: { id: session.id }, data: { status: 'expired', cancelledAt: new Date() } }),
        prisma.giftCard.update({ where: { id: card.id }, data: { status: 'cancelled' } }),
      ]);
      return { ...card, status: 'cancelled' as const };
    }
    if (remote.status === 'captured') {
      if (Number(remote.amount) !== session.amount) throw new Error('The amount paid does not match the gift card. Contact the shop.');
      const now = new Date();
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.paymentSession.updateMany({ where: { id: session.id, status: 'pending' }, data: { status: 'captured', capturedAt: now } });
        if (!claimed.count) return;
        const ledger: Ledger = [{ at: now.toISOString(), type: 'purchase', amount: card.initialValue, balance: card.initialValue, ref: session.id }];
        await tx.giftCard.update({ where: { id: card.id }, data: { status: 'active', activatedAt: now, ledger } });
        await enqueueLifecycleEvent(tx, buildLifecycleEnvelope({
          eventKey: `gift-card:${card.id}:sold:v1`, eventType: 'gift_card.sold', aggregateType: 'gift_card', aggregateId: card.id,
          shopId: card.shopId, occurredAt: now, data: { giftCard: { id: card.id, amount: card.initialValue, paymentSessionId: session.id } },
        }));
      });
    }
  }
  const fresh = await prisma.giftCard.findUniqueOrThrow({ where: { id: card.id } });
  if (fresh.status === 'active') await emailOnce(prisma, fresh);
  return fresh;
}

/** The code goes to the recipient exactly once, whichever reader settles the order first. */
async function emailOnce(prisma: PrismaClient, card: { id: string; shopId: string; code: string; initialValue: number; recipientEmail: string | null; recipientName: string | null; purchaserName: string | null; message: string | null; expiresAt: Date | null }) {
  if (!card.recipientEmail || process.env.NODE_ENV === 'test' || !process.env.SMTP_HOST) return;
  const claimed = await prisma.giftCard.updateMany({ where: { id: card.id, emailedAt: null }, data: { emailedAt: new Date() } });
  if (!claimed.count) return;
  try {
    const shop = await prisma.shop.findUnique({ where: { id: card.shopId }, select: { name: true } });
    await sendAppointmentEmail({
      to: card.recipientEmail,
      subject: `${usd(card.initialValue)} gift card from ${card.purchaserName || 'a friend'}`,
      heading: `${usd(card.initialValue)} at ${shop?.name || 'the shop'}`,
      lines: [
        `Hi ${card.recipientName || 'there'}, ${card.purchaserName || 'a friend'} sent you a gift card.`,
        ...(card.message ? [`“${card.message}”`] : []),
        `Code: ${card.code}`,
        `Show this code at checkout.${card.expiresAt ? ` Valid until ${card.expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.` : ''}`,
      ],
      path: '/book', action: 'Book a cut',
    });
  } catch (error) {
    console.error('Gift card email failed:', error);
    await prisma.giftCard.update({ where: { id: card.id }, data: { emailedAt: null } }).catch(() => undefined);
  }
}

export async function confirmGiftCardOrder(_root: unknown, args: { giftCardId: string; token: string }, context: Context) {
  if (!tokenOk(args.giftCardId, args.token)) return { success: false, error: 'We could not find that gift card order.', data: null };
  try {
    const card = await settleGiftCard(context.sudo().prisma, args.giftCardId);
    return { success: true, error: null, data: {
      status: card.status, amount: card.initialValue, recipientEmail: card.recipientEmail, recipientName: card.recipientName,
      code: card.status === 'active' || card.status === 'redeemed' ? card.code : null, expiresAt: card.expiresAt?.toISOString() || null,
    } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'We could not check the payment yet.', data: null };
  }
}

/** Settles any gift card orders still open, for the owner's payments sweep. */
export async function settleOpenGiftCards(prisma: PrismaClient, shopId: string) {
  const open = await prisma.giftCard.findMany({ where: { shopId, status: 'pending', paymentSession: { status: 'pending' } }, select: { id: true }, take: 20 });
  for (const card of open) await settleGiftCard(prisma, card.id).catch(() => undefined);
}

/** POS look-up: balance for a code, scoped to the operator's shop. */
export async function lookupGiftCard(_root: unknown, args: { code: string }, context: Context) {
  if (!permissions.canManagePayments({ session: context.session })) return { success: false, error: 'Not authorized.', data: null };
  try {
    const shopId = await requireCurrentShopPermission(context.session, 'canManagePayments');
    const code = normalizeGiftCode(args.code || '');
    if (!code) return { success: false, error: 'Enter the 12-character gift card code.', data: null };
    let card = await context.prisma.giftCard.findFirst({ where: { shopId, code } });
    if (card?.status === 'pending') card = await settleGiftCard(context.prisma, card.id);
    if (!card) return { success: false, error: 'No gift card with that code.', data: null };
    return { success: true, error: null, data: { id: card.id, code: card.code, status: card.status, balance: card.balance, expiresAt: card.expiresAt?.toISOString() || null, recipientName: card.recipientName } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to look up the gift card.', data: null };
  }
}

/** Debits a gift card inside checkout. Throws when the card can't cover `amount`. */
export async function redeemGiftCardInTransaction(transaction: Prisma.TransactionClient, input: { shopId: string; code: string; amount: number; transactionId: string; now: Date }) {
  const code = normalizeGiftCode(input.code);
  await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-gift-card', code);
  const card = await transaction.giftCard.findFirst({ where: { shopId: input.shopId, code } });
  if (!card || card.status !== 'active') throw new Error('That gift card is not active.');
  if (card.expiresAt && card.expiresAt < input.now) throw new Error('That gift card has expired.');
  if (card.balance < input.amount) throw new Error(`That gift card has ${usd(card.balance)} left. Take the rest by card or cash first.`);
  const balance = card.balance - input.amount;
  const ledger = [...(Array.isArray(card.ledger) ? card.ledger as Ledger : []), { at: input.now.toISOString(), type: 'redeem' as const, amount: input.amount, balance, ref: input.transactionId }];
  await transaction.giftCard.update({ where: { id: card.id }, data: { balance, status: balance === 0 ? 'redeemed' : 'active', ledger } });
  return card;
}
