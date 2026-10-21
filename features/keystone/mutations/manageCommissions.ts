import type { Prisma, PrismaClient } from '@prisma/client';

import { permissions } from '../access';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { assertCommissionTransition } from '../utils/remainingLifecycle';
import { hashPublicAccessToken } from '../utils/publicAccessToken';
import { runSerializableTransaction } from '../utils/serializableTransaction';

type Context = { session?: Parameters<typeof permissions.canManagePayments>[0]['session']; prisma: PrismaClient };

export async function transitionCommission(_root: unknown, args: { commissionId: string; toStatus: string; reason?: string | null; idempotencyKey: string }, context: Context) {
  if (!permissions.canManagePayments({ session: context.session })) return { success: false, error: 'Not authorized to manage commissions.', commission: null };
  try {
    const commandHash = hashPublicAccessToken(args.idempotencyKey?.trim() || '');
    if (!args.commissionId || !args.idempotencyKey?.trim()) throw new Error('Commission and idempotency key are required.');
    // Paying a commission requires payout evidence; it is only done by Create payout.
    if (!['approved', 'voided'].includes(args.toStatus)) throw new Error('Commissions can be approved or voided here. Record payment with Create payout.');
    const result = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client as Prisma.TransactionClient;
      const shopId = await requireCurrentShopPermission(context.session, 'canManagePayments', transaction);
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-commission', args.commissionId);
      const commission = await transaction.commission.findFirst({ where: { id: args.commissionId, shopId } });
      if (!commission) throw new Error('Commission not found.');
      const eventKey = `commission-command:${commandHash}:v1`;
      const replay = await transaction.lifecycleOutboxEvent.findUnique({ where: { eventKey } });
      if (replay) {
        const payload = replay.payload as { data?: { transition?: { commissionId?: string; toStatus?: string } } } | null;
        if (
          payload?.data?.transition?.commissionId !== commission.id
          || payload.data.transition.toStatus !== args.toStatus
          || String((payload.data.transition as { reason?: string }).reason || '') !== (args.reason?.trim() || '')
        ) throw new Error('Commission idempotency key was reused for a different command.');
        return commission;
      }
      assertCommissionTransition(String(commission.status), args.toStatus);
      const updated = await transaction.commission.update({ where: { id: commission.id }, data: { status: args.toStatus as Prisma.CommissionUpdateInput['status'] } });
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId,
        eventKey, eventType: `commission.${args.toStatus}`, aggregateType: 'commission', aggregateId: commission.id,
        shopId: commission.shopId, occurredAt: updated.updatedAt,
        data: { transition: { commissionId: commission.id, fromStatus: commission.status, toStatus: args.toStatus, reason: args.reason?.trim() || '', actorId: context.session?.itemId ?? null }, amount: commission.commissionAmount },
      }));
      return updated;
    });
    return { success: true, error: null, commission: { id: result.id, status: result.status, commissionAmount: result.commissionAmount } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to transition commission.', commission: null };
  }
}

export async function createCommissionPayout(_root: unknown, args: { commissionIds: string[]; notes?: string | null; idempotencyKey: string }, context: Context) {
  if (!permissions.canManagePayments({ session: context.session })) return { success: false, error: 'Not authorized to create payouts.', payout: null };
  const ids = Array.from(new Set(args.commissionIds || [])).filter(Boolean);
  if (ids.length < 1 || ids.length > 100 || !args.notes?.trim() || args.notes.trim().length > 500 || !args.idempotencyKey?.trim()) return { success: false, error: 'Choose 1–100 commissions and provide a payout method/reference plus idempotency key.', payout: null };
  try {
    const hash = hashPublicAccessToken(args.idempotencyKey.trim());
    const payout = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client as Prisma.TransactionClient;
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-payout', hash);
      const activeShopId = await requireCurrentShopPermission(context.session, 'canManagePayments', transaction);
      const replay = await transaction.commissionPayout.findUnique({ where: { idempotencyKeyHash: hash }, include: { commissions: { select: { id: true } } } });
      if (replay) {
        if (replay.shopId !== activeShopId) throw new Error('Payout idempotency key was reused with different input.');
        const replayIds = replay.commissions.map((item) => item.id).sort();
        if (replayIds.join(',') !== [...ids].sort().join(',') || replay.notes !== (args.notes?.trim() || '')) {
          throw new Error('Payout idempotency key was reused with different input.');
        }
        return replay;
      }
      const commissions = await transaction.commission.findMany({ where: { id: { in: ids }, shopId: activeShopId }, orderBy: { id: 'asc' } });
      if (commissions.length !== ids.length) throw new Error('One or more commissions were not found.');
      const shopId = activeShopId;
      if (commissions.some((item) => item.shopId !== shopId)) throw new Error('Payout commissions must belong to one shop.');
      if (commissions.some((item) => item.status !== 'approved')) throw new Error('Only approved commissions can be paid.');
      const barberId = commissions[0].barberId;
      if (!barberId || commissions.some((item) => item.barberId !== barberId)) throw new Error('A payout must contain commissions for one barber.');
      const paidAt = new Date();
      const totalAmount = commissions.reduce((sum, item) => sum + (item.commissionAmount || 0), 0);
      const created = await transaction.commissionPayout.create({
        data: { shopId, payoutNumber: `payout-${hash.slice(0, 20)}`, idempotencyKeyHash: hash, barberId, commissionCount: commissions.length, totalAmount, paidAt, notes: args.notes?.trim() || '' },
      });
      await transaction.commission.updateMany({ where: { id: { in: ids }, status: 'approved' }, data: { status: 'paid', paidAt, payoutId: created.id } });
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId,
        eventKey: `commission-payout:${created.id}:paid:v1`, eventType: 'commission_payout.paid', aggregateType: 'commission_payout', aggregateId: created.id,
        shopId, occurredAt: paidAt, data: { payout: { id: created.id, barberId, commissionIds: ids.sort(), commissionCount: commissions.length, totalAmount, payoutReference: args.notes!.trim(), actorId: context.session?.itemId ?? null } },
      }));
      return created;
    });
    return { success: true, error: null, payout: { id: payout.id, payoutNumber: payout.payoutNumber, commissionCount: payout.commissionCount, totalAmount: payout.totalAmount, paidAt: payout.paidAt.toISOString() } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to create payout.', payout: null };
  }
}
