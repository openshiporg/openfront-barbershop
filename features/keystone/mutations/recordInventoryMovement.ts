import type { Prisma, PrismaClient } from '@prisma/client';

import { permissions } from '../access';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';
import { applyInventoryDelta } from '../utils/balanceLedgers';
import { runSerializableTransaction } from '../utils/serializableTransaction';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';

type Args = {
  inventoryLotId: string;
  movementType: string;
  quantityDelta: number;
  reason: string;
  referenceKey: string;
};

type Context = {
  session?: Parameters<typeof permissions.canManageServices>[0]['session'];
  prisma: PrismaClient;
};

const MOVEMENT_TYPES = new Set(['receive', 'sale', 'return', 'waste', 'adjustment']);

export default async function recordInventoryMovement(_root: unknown, args: Args, context: Context) {
  if (!permissions.canManageServices({ session: context.session })) {
    return { success: false, error: 'Not authorized to manage inventory.', movement: null };
  }

  const inventoryLotId = args.inventoryLotId?.trim();
  const reason = args.reason?.trim();
  const referenceKey = args.referenceKey?.trim();
  const quantityDelta = Number(args.quantityDelta);
  if (!inventoryLotId || !reason || reason.length > 500 || !referenceKey || referenceKey.length > 200) {
    return { success: false, error: 'Lot, reason, and reference key are required.', movement: null };
  }
  if (!MOVEMENT_TYPES.has(args.movementType)) {
    return { success: false, error: 'Inventory movement type is invalid.', movement: null };
  }
  if (['receive', 'return'].includes(args.movementType) && quantityDelta <= 0) {
    return { success: false, error: 'Receive and return movements must increase inventory.', movement: null };
  }
  if (['sale', 'waste'].includes(args.movementType) && quantityDelta >= 0) {
    return { success: false, error: 'Sale and waste movements must decrease inventory.', movement: null };
  }

  try {
    const movement = await runSerializableTransaction(
      context.prisma,
      async (client) => {
        const transaction = client as Prisma.TransactionClient;
        const shopId = await requireCurrentShopPermission(context.session, 'canManageServices', transaction);
        await transaction.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
          'barbershop-inventory',
          `lot:${inventoryLotId}`
        );
        const lot = await transaction.inventoryLot.findFirst({ where: { id: inventoryLotId, shopId } });
        if (!lot || !lot.productId || !lot.shopId) throw new Error('Inventory lot was not found.');
        const replay = await transaction.inventoryMovement.findUnique({ where: { referenceKey } });
        if (replay) {
          if (
            replay.shopId !== lot.shopId
            || replay.inventoryLotId !== lot.id
            || replay.movementType !== args.movementType
            || replay.quantityDelta !== quantityDelta
            || replay.reason !== reason
          ) {
            throw new Error('Inventory idempotency key was reused for a different movement.');
          }
          return replay;
        }
        const now = new Date();
        const expired = lot.status === 'expired' || Boolean(lot.expiresAt && lot.expiresAt <= now);
        if (quantityDelta > 0 && expired) throw new Error('This lot has expired. Receive new stock as a new lot instead of adding to it.');
        const balance = applyInventoryDelta(lot.quantityRemaining || 0, quantityDelta);
        const created = await transaction.inventoryMovement.create({
          data: {
            shopId: lot.shopId,
            productId: lot.productId,
            inventoryLotId: lot.id,
            movementType: args.movementType as Prisma.InventoryMovementCreateInput['movementType'],
            quantityDelta: balance.delta,
            quantityAfter: balance.after,
            reason,
            referenceKey,
            occurredAt: new Date(),
          },
        });
        await transaction.inventoryLot.update({
          where: { id: lot.id },
          data: {
            quantityRemaining: balance.after,
            quantityReceived: args.movementType === 'receive'
              ? (lot.quantityReceived || 0) + balance.delta
              : lot.quantityReceived,
            // Quantity changes never revive an expired lot.
            status: expired ? 'expired' : balance.after === 0 ? 'consumed' : 'active',
          },
        });
        await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId,
          eventKey: `inventory:${created.id}:${referenceKey}:v1`,
          eventType: 'inventory.moved',
          aggregateType: 'inventory_movement',
          aggregateId: created.id,
          shopId: lot.shopId,
          occurredAt: created.occurredAt,
          data: {
            movement: {
              id: created.id,
              inventoryLotId: lot.id,
              productId: lot.productId,
              movementType: created.movementType,
              quantityDelta: created.quantityDelta,
              quantityAfter: created.quantityAfter,
              referenceKey,
              reason,
              actorId: context.session?.itemId ?? null,
            },
          },
        }));
        return created;
      }
    );

    return { success: true, error: null, movement };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to record inventory movement.', movement: null };
  }
}
