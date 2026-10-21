import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { Session } from '../access';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { runSerializableTransaction } from '../utils/serializableTransaction';
import { assertUsdSettlementCurrency } from '../utils/supportedSettlementCurrency';

type Args = { transactionId: string; reason: string; cashReturned: boolean; idempotencyKey: string };
export default async function refundCashCheckout(_root: unknown, args: Args, context: { session?: Session; prisma: PrismaClient }) {
  try {
    const shopId = await requireCurrentShopPermission(context.session, 'canManagePayments');
    const reason = args.reason?.trim(); const key = args.idempotencyKey?.trim();
    if (!args.cashReturned || !reason || reason.length < 3 || reason.length > 1000 || !key || key.length > 200) throw new Error('Confirm the cash has been returned and provide a reason and retry key.');
    const eventKey = `cash-refund:${shopId}:${createHash('sha256').update(key).digest('hex')}`;
    const data = await runSerializableTransaction(context.prisma, async (client) => {
      const tx = client as Prisma.TransactionClient;
      await requireCurrentShopPermission(context.session, 'canManagePayments', tx);
      const owner = await tx.shopMembership.findFirst({ where: { shopId, userId: context.session!.itemId, status: 'active', membershipRole: 'owner' }, select: { id: true } });
      if (!owner) throw new Error('Only the shop owner can record a cash refund.');
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))', 'barbershop-cash-refund', args.transactionId);
      const prior = await tx.cashRefund.findUnique({ where: { eventKey } });
      if (prior) {
        if (prior.transactionId !== args.transactionId || prior.reason !== reason) throw new Error('Refund retry key was used for different details.');
        return { id: prior.id, amount: prior.amount, replayed: true };
      }
      const receipt = await tx.checkoutTransaction.findFirst({ where: { id: args.transactionId, shopId }, include: { appointments: true, cashRefund: true } });
      if (!receipt || receipt.paymentMethod !== 'cash' || receipt.status !== 'paid' || receipt.paymentSessionId || receipt.cashRefund || receipt.appointments.length !== 1 || (receipt.total ?? 0) < 0) throw new Error('Only an unrefunded, cash-only appointment receipt can be refunded here.');
      assertUsdSettlementCurrency(receipt.currencyCode);
      const paidCommission = await tx.commission.count({ where: { transactionId: receipt.id, status: 'paid' } });
      if (paidCommission) throw new Error('A commission was already paid. Owner reconciliation is required before refunding this receipt.');
      const refundedAt = new Date();
      const refund = await tx.cashRefund.create({ data: { shopId, transactionId: receipt.id, eventKey, actorId: context.session!.itemId, reason, amount: receipt.total ?? 0, tipAmount: receipt.tipAmount ?? 0, taxAmount: receipt.taxAmount ?? 0, refundedAt } });
      await tx.checkoutTransaction.update({ where: { id: receipt.id }, data: { status: 'refunded' } });
      await tx.appointment.updateMany({ where: { transactionId: receipt.id, shopId }, data: { paymentStatus: 'refunded' } });
      await tx.commission.updateMany({ where: { transactionId: receipt.id, status: { in: ['projected', 'approved'] } }, data: { status: 'voided' } });
      await enqueueLifecycleEvent(tx, buildLifecycleEnvelope({ actorId: context.session?.itemId, eventKey: `${eventKey}:outbox`, eventType: 'checkout.cash_refunded', aggregateType: 'checkout_transaction', aggregateId: receipt.id, shopId, occurredAt: refundedAt, data: { refundId: refund.id, amount: refund.amount, tipAmount: refund.tipAmount, taxAmount: refund.taxAmount, reason, actorId: context.session!.itemId, settlement: 'owner_attested_cash_return' } }));
      return { id: refund.id, amount: refund.amount, replayed: false };
    });
    return { success: true, error: null, data };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to record cash refund.', data: null }; }
}
