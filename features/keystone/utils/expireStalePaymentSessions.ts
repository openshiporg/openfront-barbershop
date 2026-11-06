import type { Prisma, PrismaClient } from '@prisma/client';

import { getPaymentStatus, isOfflinePaymentProvider } from './paymentProviderAdapter';

/**
 * Card pages nobody paid close on their own (Square / Stripe default: a Checkout lives 24h). Pending
 * processor sessions past their expiry are read back from Stripe once: unpaid ones are expired at Stripe
 * and locally, paid ones are left for reconciliation so money is never dropped. Runs when owners open
 * operations, payments or the POS, throttled per shop.
 */
const lastSweep = new Map<string, number>();
const SWEEP_EVERY_MS = 5 * 60_000;
const DEFAULT_LIFETIME_MS = 24 * 3600_000;

async function expireAtStripe(checkoutId: string) {
  if (!checkoutId || !process.env.STRIPE_SECRET_KEY) return;
  await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(checkoutId)}/expire`, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }, redirect: 'error',
  }).catch(() => undefined);
}

export async function expireStalePaymentSessions(prisma: PrismaClient | Prisma.TransactionClient, shopId: string, now = new Date()) {
  const last = lastSweep.get(shopId) || 0;
  if (now.getTime() - last < SWEEP_EVERY_MS) return 0;
  lastSweep.set(shopId, now.getTime());
  const stale = await prisma.paymentSession.findMany({
    where: { shopId, status: { in: ['pending', 'authorized'] }, OR: [{ expiresAt: { lt: now } }, { expiresAt: null, createdAt: { lt: new Date(now.getTime() - DEFAULT_LIFETIME_MS) } }] },
    include: { paymentProvider: { select: { code: true } } }, take: 50, orderBy: { createdAt: 'asc' },
  });
  let expired = 0;
  for (const session of stale) {
    if (!session.paymentProvider || isOfflinePaymentProvider(session.paymentProvider)) continue;
    try {
      if (session.providerPaymentId) {
        const remote = await getPaymentStatus({ provider: { code: session.paymentProvider.code }, paymentId: session.providerPaymentId }) as { status?: string };
        if (remote.status === 'captured') continue;
        if (remote.status !== 'expired') await expireAtStripe(session.providerPaymentId);
      }
      const updated = await prisma.paymentSession.updateMany({ where: { id: session.id, status: { in: ['pending', 'authorized'] } }, data: { status: 'expired', cancelledAt: now } });
      expired += updated.count;
    } catch {
      // Leave it for the next sweep or a manual check.
    }
  }
  return expired;
}
