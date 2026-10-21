import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';

import { permissions, type Session } from '../access';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { runSerializableTransaction } from '../utils/serializableTransaction';

type Context = { session?: Session; prisma: PrismaClient };
type Args = { productId: string; supplierId?: string | null; lotNumber: string; quantity: number; unitCost?: number | null; receivedAt?: string | null; expiresAt?: string | null; idempotencyKey: string };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const optionalDate = (value?: string | null) => { if (!value) return null; const result = new Date(value); if (Number.isNaN(result.getTime())) throw new Error('Inventory date is invalid.'); return result; };

export default async function receiveInventoryLot(_root: unknown, args: Args, context: Context) {
  if (!permissions.canManageServices({ session: context.session })) return { success: false, error: 'Not authorized to receive inventory.', received: null };
  const lotNumber = args.lotNumber?.trim(); const key = args.idempotencyKey?.trim(); const quantity = Math.floor(Number(args.quantity)); const unitCost = Math.floor(Number(args.unitCost || 0));
  if (!args.productId || !lotNumber || lotNumber.length > 120 || !key || key.length > 200 || !Number.isFinite(quantity) || quantity < 1 || !Number.isFinite(unitCost) || unitCost < 0) return { success: false, error: 'Product, lot number, positive quantity, non-negative cost, and idempotency key are required.', received: null };
  try {
    const received = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client as Prisma.TransactionClient; const referenceKey = `inventory-receipt:${hash(key)}`;
      const shopId = await requireCurrentShopPermission(context.session, 'canManageServices', transaction);
      const receivedAt = optionalDate(args.receivedAt) || new Date(); const expiresAt = optionalDate(args.expiresAt);
      if (receivedAt.getTime() > Date.now() + 5 * 60_000) throw new Error('Received date cannot be in the future.');
      if (expiresAt && expiresAt <= receivedAt) throw new Error('Expiry date must be after the received date.');
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-inventory-receipt', referenceKey);
      const replay = await transaction.inventoryMovement.findUnique({ where: { referenceKey }, include: { inventoryLot: true } });
      if (replay) {
        if (replay.shopId !== shopId || !replay.inventoryLot || replay.productId !== args.productId || replay.inventoryLot.supplierId !== (args.supplierId || null) || replay.inventoryLot.lotNumber !== lotNumber || replay.quantityDelta !== quantity || replay.inventoryLot.unitCost !== unitCost
          || (args.receivedAt ? replay.inventoryLot.receivedAt?.getTime() !== receivedAt.getTime() : false)
          || (replay.inventoryLot.expiresAt?.getTime() ?? null) !== (expiresAt?.getTime() ?? null)) throw new Error('Inventory receipt idempotency key was reused with different input.');
        return replay.inventoryLot;
      }
      const product = await transaction.product.findFirst({ where: { id: args.productId, shopId } });
      if (!product) throw new Error('Product was not found.');
      if (product.inventoryTracked === false) throw new Error('This product is not stock-tracked. Turn on inventory tracking before receiving stock.');
      const supplier = args.supplierId ? await transaction.supplier.findUnique({ where: { id: args.supplierId } }) : null;
      if (args.supplierId && (!supplier || supplier.shopId !== product.shopId || supplier.status !== 'active')) throw new Error('Supplier is unavailable in the active shop.');
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-inventory-lot', `${product.shopId}:${lotNumber}`);
      const lot = await transaction.inventoryLot.create({ data: { shopId: product.shopId, productId: product.id, supplierId: supplier?.id || null, lotNumber, quantityReceived: quantity, quantityRemaining: quantity, unitCost, receivedAt, expiresAt, status: expiresAt && expiresAt <= new Date() ? 'expired' : 'active', metadata: { source: 'operator_receipt' } } });
      const movement = await transaction.inventoryMovement.create({ data: { shopId: product.shopId, productId: product.id, inventoryLotId: lot.id, movementType: 'receive', quantityDelta: quantity, quantityAfter: quantity, reason: `Received lot ${lotNumber}`, referenceKey, occurredAt: receivedAt } });
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId, eventKey: `inventory-receipt:${movement.id}:recorded:v1`, eventType: 'inventory.received', aggregateType: 'inventory_lot', aggregateId: lot.id, shopId: product.shopId, occurredAt: receivedAt, data: { receipt: { lotId: lot.id, productId: product.id, supplierId: supplier?.id || null, lotNumber, quantity, unitCost, receivedAt: receivedAt.toISOString(), expiresAt: expiresAt?.toISOString() ?? null, actorId: context.session?.itemId ?? null } } }));
      return lot;
    });
    return { success: true, error: null, received: { id: received.id, lotNumber: received.lotNumber, quantityReceived: received.quantityReceived, quantityRemaining: received.quantityRemaining, status: received.status } };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to receive inventory.', received: null }; }
}
