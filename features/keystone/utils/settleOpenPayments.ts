import type { Prisma, PrismaClient } from '@prisma/client';

import { reconcileSessionInTransaction } from '../mutations/reconcilePaymentSession';
import { settleGiftCard } from '../mutations/giftCards';
import { settleProductOrder } from '../mutations/productOrders';
import { getPaymentStatus, isOfflinePaymentProvider } from './paymentProviderAdapter';
import { runSerializableTransaction } from './serializableTransaction';
import { sweepStalePaymentSessions } from './expireStalePaymentSessions';

/**
 * Server-side settlement without a webhook (the shared Stripe account has no endpoint slot for this site):
 * every open Checkout is read back from Stripe and a paid one is recorded through the same code the return
 * page and "Check with Stripe" use. Idempotent: each path claims the session once (status guard + event key).
 * Runs in the web process once a minute (instrumentation.ts); it is not a separate worker service.
 */
const RECENT_MS = 25 * 3600_000;

export async function settleOpenPayments(prisma: PrismaClient) {
  const open = await prisma.paymentSession.findMany({
    where: { status: 'pending', providerPaymentId: { not: '' }, createdAt: { gt: new Date(Date.now() - RECENT_MS) } },
    include: { paymentProvider: { select: { code: true } }, from_GiftCard_paymentSession: { select: { id: true }, take: 1 } },
    orderBy: { createdAt: 'desc' }, take: 40,
  });
  let settled = 0;
  for (const session of open) {
    if (!session.paymentProvider || isOfflinePaymentProvider(session.paymentProvider)) continue;
    const purpose = String((session.metadata as Record<string, unknown> | null)?.purpose || '');
    try {
      if (purpose === 'product_order') { if ((await settleProductOrder(prisma, session.id)).status === 'captured') settled += 1; continue; }
      if (purpose === 'gift_card') { const card = session.from_GiftCard_paymentSession[0]; if (card && (await settleGiftCard(prisma, card.id)).status === 'active') settled += 1; continue; }
      // The desk card screen records its own sale with the ticket; deposits are settled here.
      if (purpose === 'desk_card' || !session.appointmentId) continue;
      const remote = await getPaymentStatus({ provider: { code: session.paymentProvider.code }, paymentId: session.providerPaymentId }) as { status?: string };
      if (remote.status !== 'captured' && remote.status !== 'paid' && remote.status !== 'succeeded') continue;
      const row = await runSerializableTransaction(prisma, (client) => reconcileSessionInTransaction(client as Prisma.TransactionClient, {
        shopId: session.shopId, paymentSessionId: session.id, eventKey: `payment-reconciliation:auto:${session.id}:captured:v1`, actorId: null,
      }));
      if (row.changed) settled += 1;
    } catch (error) {
      console.error('Payment settle skipped', session.id, error instanceof Error ? error.message : error);
    }
  }
  // Expired, unpaid checkouts are closed on the existing schedule.
  const shops = await prisma.shop.findMany({ select: { id: true } });
  for (const shop of shops) await sweepStalePaymentSessions(prisma, shop.id).catch(() => undefined);
  return settled;
}

export function startPaymentSettler(prisma: PrismaClient) {
  const state = globalThis as unknown as { __paymentSettler?: ReturnType<typeof setInterval> };
  if (state.__paymentSettler || process.env.NODE_ENV === 'test') return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const settled = await settleOpenPayments(prisma);
      if (settled) console.log(`Payment settle: recorded ${settled} paid checkout(s).`);
    } catch (error) {
      console.error('Payment settle failed:', error instanceof Error ? error.message : error);
    } finally { running = false; }
  };
  state.__paymentSettler = setInterval(tick, 60_000);
  setTimeout(tick, 15_000);
}
