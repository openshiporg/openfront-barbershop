import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

import { trustedOrigin } from '../../shared/trusted-origin';
import { createPayment, getPaymentStatus } from '../utils/paymentProviderAdapter';
import { hashPublicAccessToken } from '../utils/publicAccessToken';
import { resolvePublishedShop } from '../utils/publicShop';
import { runSerializableTransaction } from '../utils/serializableTransaction';
import { createProductSaleInTransaction } from './manageProductSales';
import { onlineDepositProvider } from './publicDeposits';
import { recordOf } from './paymentSessionResult';

/**
 * Online retail (always buyable): the buyer pays the product price on Stripe's hosted page; the sale
 * (receipt, sale line, stock) is recorded only after the payment is read back from Stripe. One unit per order.
 */
type Context = { prisma: PrismaClient; sudo(): { prisma: PrismaClient } };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usd = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

function orderToken(sessionId: string) {
  const secret = process.env.SESSION_SECRET || '';
  if (secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters long');
  return createHmac('sha256', secret).update(`barbershop-product:${sessionId}`).digest('hex');
}
function tokenOk(sessionId: string, token?: string | null) {
  if (!token || token.length !== 64) return false;
  const a = Buffer.from(orderToken(sessionId)); const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function startProductCheckout(_root: unknown, args: { productId: string; buyerName: string; buyerEmail: string }, context: Context) {
  const fail = (error: string) => ({ success: false, error, data: null });
  try {
    const buyerName = (args.buyerName || '').trim(); const buyerEmail = (args.buyerEmail || '').trim().toLowerCase();
    if (!buyerName || buyerName.length > 120) return fail('Enter your name.');
    if (!EMAIL.test(buyerEmail)) return fail('Enter a valid email address.');
    const prisma = context.sudo().prisma;
    const shop = await resolvePublishedShop(prisma, { id: true, name: true }) as { id: string; name: string } | null;
    if (!shop) return fail('The shop is unavailable right now.');
    const product = await prisma.product.findFirst({ where: { id: String(args.productId || ''), shopId: shop.id, status: 'active' } });
    if (!product || !(product.price && product.price > 0)) return fail('That product is not available.');
    const provider = await onlineDepositProvider(prisma, shop.id);
    if (!provider) return fail('Online checkout is unavailable right now. Try again in a moment.');
    const key = randomUUID();
    const amount = product.price;
    const sessionId = randomUUID().replace(/-/g, '');
    const back = `${trustedOrigin()}/shop/order?id=${sessionId}&token=${orderToken(sessionId)}`;
    const result = recordOf(await createPayment({
      provider: { code: provider.code }, amount, currency: 'usd', description: `${shop.name} · ${product.name} · ${usd(amount)}`,
      successUrl: back, cancelUrl: `${back}&result=cancelled`, idempotencyKey: key, customerEmail: buyerEmail,
      metadata: { purpose: 'product_order', productId: product.id },
    }));
    if (!result.id || typeof result.url !== 'string') throw new Error('Stripe did not open a checkout.');
    await prisma.paymentSession.create({ data: {
      id: sessionId, shopId: shop.id, paymentProviderId: provider.id, idempotencyKeyHash: hashPublicAccessToken(`product-order:${key}`), status: 'pending',
      amount, currencyCode: 'USD', providerPaymentId: String(result.id), expiresAt: new Date(Date.now() + 23 * 3600_000),
      metadata: { purpose: 'product_order', productId: product.id, productName: product.name, quantity: 1, buyerName, buyerEmail, checkoutUrl: result.url },
    } });
    return { success: true, error: null, data: { url: result.url } };
  } catch (error) {
    console.error('Product checkout could not be opened:', error);
    return fail('Online checkout is unavailable right now. Try again in a moment.');
  }
}

/** Reads the checkout back from Stripe and records the sale once paid. Safe to call repeatedly. */
export async function settleProductOrder(prisma: PrismaClient, sessionId: string) {
  const session = await prisma.paymentSession.findUnique({ where: { id: sessionId }, include: { paymentProvider: { select: { code: true } }, transaction: { select: { id: true } } } });
  const meta = recordOf(session?.metadata);
  if (!session || meta.purpose !== 'product_order') throw new Error('Order not found.');
  if (session.status === 'pending' && session.paymentProvider) {
    const remote = recordOf(await getPaymentStatus({ provider: { code: session.paymentProvider.code }, paymentId: session.providerPaymentId }));
    if (remote.status === 'expired') {
      await prisma.paymentSession.updateMany({ where: { id: session.id, status: 'pending' }, data: { status: 'expired', cancelledAt: new Date() } });
    } else if (remote.status === 'captured') {
      if (Number(remote.amount) !== session.amount) throw new Error('The amount paid does not match the order. Contact the shop.');
      await prisma.paymentSession.updateMany({ where: { id: session.id, status: 'pending' }, data: { status: 'captured', capturedAt: new Date() } });
    }
  }
  const fresh = await prisma.paymentSession.findUniqueOrThrow({ where: { id: session.id }, include: { transaction: { select: { id: true } } } });
  if (['captured', 'partially_refunded', 'refunded'].includes(String(fresh.status)) && !fresh.transaction) {
    await runSerializableTransaction(prisma, async (client) => {
      const tx = client as Prisma.TransactionClient;
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-product-order', fresh.id);
      const done = await tx.checkoutTransaction.findUnique({ where: { paymentSessionId: fresh.id }, select: { id: true } });
      if (done) return;
      await createProductSaleInTransaction(tx, {
        shopId: fresh.shopId, productId: String(meta.productId), quantity: 1, taxRateBps: 0, paymentMethod: 'card',
        lineNumber: `product-order-${fresh.id}`, paymentSessionId: fresh.id, online: true,
      });
    });
  }
  return { status: String(fresh.status), name: String(meta.productName || 'Product'), amount: fresh.amount, buyerEmail: String(meta.buyerEmail || '') };
}

export async function confirmProductOrder(_root: unknown, args: { orderId: string; token: string }, context: Context) {
  if (!tokenOk(args.orderId, args.token)) return { success: false, error: 'We could not find that order.', data: null };
  try {
    return { success: true, error: null, data: await settleProductOrder(context.sudo().prisma, args.orderId) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'We could not check the payment yet.', data: null };
  }
}

/** Settles product orders still open, for the owner's payments sweep. */
export async function settleOpenProductOrders(prisma: PrismaClient, shopId: string) {
  const open = await prisma.paymentSession.findMany({ where: { shopId, OR: [{ status: 'pending' }, { status: 'captured', transaction: null }], metadata: { path: ['purpose'], equals: 'product_order' } }, select: { id: true }, take: 20 });
  for (const row of open) await settleProductOrder(prisma, row.id).catch(() => undefined);
}
