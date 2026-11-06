import type { Prisma, PrismaClient } from '@prisma/client';

import { reconcileSessionInTransaction } from '../mutations/reconcilePaymentSession';
import { getPaymentStatus, isOfflinePaymentProvider } from './paymentProviderAdapter';
import { runSerializableTransaction } from './serializableTransaction';

/**
 * Automatic payment reconciliation (Square / Stripe default: a Checkout lives 24h and is settled from the
 * processor, not by a person). Every pending processor session past its expiry is read back from Stripe:
 *  - paid     → reconciled exactly like staff's "Check with Stripe" (session captured, deposit marked paid)
 *  - unpaid   → expired at Stripe and locally, so it can't be paid later
 * The barbershop has no webhook or scheduler, so the sweep rides traffic: storefront reads (booking, services,
 * queue), owner pages, and the Payments "Check all with Stripe" button. Throttled per shop; at most 50 a run.
 */
const lastSweep = new Map<string, number>();
const SWEEP_EVERY_MS = 5 * 60_000;
const DEFAULT_LIFETIME_MS = 24 * 3600_000;
const running = new Set<string>();

export type SweepResult = { expired: number; reconciled: number; checked: number };

async function expireAtStripe(checkoutId: string) {
  if (!checkoutId || !process.env.STRIPE_SECRET_KEY) return;
  await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(checkoutId)}/expire`, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }, redirect: 'error',
  }).catch(() => undefined);
}

/** Fire-and-forget from read paths (storefront, dashboard). Never blocks or fails the page. */
export function triggerPaymentSweep(prisma: PrismaClient, shopId: string | null | undefined) {
  if (!shopId || process.env.NODE_ENV === 'test') return;
  const last = lastSweep.get(shopId) || 0;
  if (Date.now() - last < SWEEP_EVERY_MS || running.has(shopId)) return;
  void expireStalePaymentSessions(prisma, shopId).catch((error) => console.error('Payment sweep failed:', error));
}

export async function expireStalePaymentSessions(prisma: PrismaClient | Prisma.TransactionClient, shopId: string, now = new Date(), options: { force?: boolean } = {}): Promise<number> {
  return (await sweepStalePaymentSessions(prisma, shopId, now, options)).expired;
}

export async function sweepStalePaymentSessions(prisma: PrismaClient | Prisma.TransactionClient, shopId: string, now = new Date(), options: { force?: boolean } = {}): Promise<SweepResult> {
  const result: SweepResult = { expired: 0, reconciled: 0, checked: 0 };
  const last = lastSweep.get(shopId) || 0;
  if (!options.force && now.getTime() - last < SWEEP_EVERY_MS) return result;
  if (running.has(shopId)) return result;
  lastSweep.set(shopId, now.getTime());
  running.add(shopId);
  try {
    const stale = await prisma.paymentSession.findMany({
      where: { shopId, status: { in: ['pending', 'authorized'] }, OR: [{ expiresAt: { lt: now } }, { expiresAt: null, createdAt: { lt: new Date(now.getTime() - DEFAULT_LIFETIME_MS) } }] },
      include: { paymentProvider: { select: { code: true } } }, take: 50, orderBy: { createdAt: 'asc' },
    });
    for (const session of stale) {
      if (!session.paymentProvider || isOfflinePaymentProvider(session.paymentProvider)) continue;
      result.checked += 1;
      try {
        if (session.providerPaymentId) {
          const remote = await getPaymentStatus({ provider: { code: session.paymentProvider.code }, paymentId: session.providerPaymentId }) as { status?: string };
          if (remote.status === 'captured' || remote.status === 'paid' || remote.status === 'succeeded') {
            // Paid but never recorded: settle it the same way staff would, once (keyed per session).
            if ('$transaction' in prisma) {
              const row = await runSerializableTransaction(prisma as PrismaClient, (client) => reconcileSessionInTransaction(client as Prisma.TransactionClient, {
                shopId, paymentSessionId: session.id, eventKey: `payment-reconciliation:auto:${session.id}:captured:v1`, actorId: null,
              }));
              if (row.changed) result.reconciled += 1;
            }
            continue;
          }
          if (remote.status !== 'expired') await expireAtStripe(session.providerPaymentId);
        }
        const updated = await prisma.paymentSession.updateMany({ where: { id: session.id, status: { in: ['pending', 'authorized'] } }, data: { status: 'expired', cancelledAt: now } });
        result.expired += updated.count;
      } catch {
        // Leave it for the next sweep or a manual check.
      }
    }
  } finally {
    running.delete(shopId);
  }
  return result;
}
