import type { Prisma, PrismaClient } from '@prisma/client';

import { permissions } from '../access';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { calculateProductSale } from '../utils/remainingLifecycle';
import { hashPublicAccessToken } from '../utils/publicAccessToken';
import { runSerializableTransaction } from '../utils/serializableTransaction';
import { assertUsdSettlementCurrency } from '../utils/supportedSettlementCurrency';

type Context = { session?: Parameters<typeof permissions.canManagePayments>[0]['session']; prisma: PrismaClient };
// Retail card/gift-card settlement is not inferred from an operator click.
// Add those tenders only when this command can require captured provider/ledger evidence.
const METHODS = new Set(['cash']);
const MAX_ALLOCATION_LOTS = 50;

function lockLot(transaction: Prisma.TransactionClient, lotId: string) {
  return transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-inventory', `lot:${lotId}`);
}

/** Sellable now: active, in stock and not past its expiry date. */
function sellableLotWhere(shopId: string, productId: string, now: Date) {
  return { shopId, productId, status: 'active' as const, quantityRemaining: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}

/** Tax for this return, allocated against the original line so that returning
 * every unit refunds exactly the original tax (no repeated rounding loss). */
export function allocatedReturnTax(originalTax: number, originalQuantity: number, returnedBefore: number, quantity: number) {
  const tax = Math.abs(originalTax);
  const cumulative = (units: number) => Math.round((tax * units) / originalQuantity);
  return cumulative(returnedBefore + quantity) - cumulative(returnedBefore);
}

export async function recordProductSale(_root: unknown, args: { productId: string; quantity: number; paymentMethod: string; taxRateBps?: number | null; idempotencyKey: string }, context: Context) {
  if (!permissions.canManagePayments({ session: context.session })) return { success: false, error: 'Not authorized to record product sales.', sale: null };
  if (!args.productId || !args.idempotencyKey?.trim() || !METHODS.has(args.paymentMethod)) return { success: false, error: 'Product, cash tender, and idempotency key are required; other tenders need captured settlement evidence.', sale: null };
  try {
    const hash = hashPublicAccessToken(args.idempotencyKey.trim());
    const line = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client as Prisma.TransactionClient;
      const shopId = await requireCurrentShopPermission(context.session, 'canManagePayments', transaction);
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-product-sale', args.productId);
      const lineNumber = `product-sale-${hash.slice(0, 24)}`;
      const replay = await transaction.productSaleLine.findUnique({ where: { lineNumber }, include: { transaction: true } });
      if (replay) {
        if (replay.shopId !== shopId) throw new Error('Product sale idempotency key was reused with different input.');
        assertUsdSettlementCurrency(replay.transaction?.currencyCode);
        const replayTotals = calculateProductSale({ unitPrice: replay.unitPrice, quantity: args.quantity, taxRateBps: args.taxRateBps || 0 });
        if (
          replay.productId !== args.productId
          || replay.quantity !== replayTotals.quantity
          || replay.taxAmount !== replayTotals.taxAmount
          || replay.transaction?.paymentMethod !== args.paymentMethod
        ) throw new Error('Product sale idempotency key was reused with different input.');
        return replay;
      }
      const product = await transaction.product.findFirst({ where: { id: args.productId, shopId } });
      if (!product || product.status !== 'active') throw new Error('Product is not available.');
      const shop = await transaction.shop.findUnique({ where: { id: shopId }, select: { currencyCode: true } });
      assertUsdSettlementCurrency(shop?.currencyCode);
      const totals = calculateProductSale({ unitPrice: product.price || 0, quantity: args.quantity, taxRateBps: args.taxRateBps || 0 });
      const occurredAt = new Date();

      // Tracked goods are allocated across eligible lots (earliest expiry first);
      // untracked goods sell without inventing a stock receipt.
      const allocations: Array<{ lotId: string; quantity: number; quantityAfter: number; becomesConsumed: boolean }> = [];
      if (product.inventoryTracked !== false) {
        const candidates = await transaction.inventoryLot.findMany({
          where: sellableLotWhere(shopId, product.id, occurredAt),
          orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }, { id: 'asc' }],
          take: MAX_ALLOCATION_LOTS,
          select: { id: true },
        });
        for (const lotId of candidates.map((lot) => lot.id).sort()) await lockLot(transaction, lotId);
        const lots = await transaction.inventoryLot.findMany({
          where: { ...sellableLotWhere(shopId, product.id, occurredAt), id: { in: candidates.map((lot) => lot.id) } },
          orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }, { id: 'asc' }],
        });
        let remaining = totals.quantity;
        for (const lot of lots) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, lot.quantityRemaining || 0);
          if (take <= 0) continue;
          const quantityAfter = (lot.quantityRemaining || 0) - take;
          allocations.push({ lotId: lot.id, quantity: take, quantityAfter, becomesConsumed: quantityAfter === 0 });
          remaining -= take;
        }
        if (remaining > 0) throw new Error('Insufficient sellable inventory for this product sale.');
      }

      const checkout = await transaction.checkoutTransaction.create({ data: {
        shopId, status: 'paid', subtotal: totals.subtotal, taxAmount: totals.taxAmount, total: totals.total, currencyCode: 'USD',
        paymentMethod: args.paymentMethod as Prisma.CheckoutTransactionCreateInput['paymentMethod'], completedAt: occurredAt,
        notes: `Retail sale · ${product.name} (${product.sku}) × ${totals.quantity}`,
      } });
      const created = await transaction.productSaleLine.create({ data: {
        shopId, lineNumber, transactionId: checkout.id, productId: product.id, lineType: 'sale',
        productNameSnapshot: product.name, skuSnapshot: product.sku, quantity: totals.quantity, unitPrice: totals.unitPrice,
        subtotal: totals.subtotal, taxAmount: totals.taxAmount, total: totals.total, occurredAt,
      }, include: { transaction: true } });
      for (const [index, allocation] of allocations.entries()) {
        await transaction.inventoryMovement.create({ data: {
          shopId, productId: product.id, inventoryLotId: allocation.lotId,
          // The first lot links 1:1 to the sale line; further lots share its reference prefix.
          ...(index === 0 ? { productSaleLineId: created.id } : {}),
          movementType: 'sale', quantityDelta: -allocation.quantity, quantityAfter: allocation.quantityAfter, reason: 'Product POS sale',
          referenceKey: index === 0 ? `product-sale:${created.id}` : `product-sale:${created.id}:lot:${allocation.lotId}`, occurredAt,
        } });
        await transaction.inventoryLot.update({ where: { id: allocation.lotId }, data: { quantityRemaining: allocation.quantityAfter, ...(allocation.becomesConsumed ? { status: 'consumed' } : {}) } });
      }
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId,
        eventKey: `product-sale:${created.id}:paid:v1`, eventType: 'product_sale.paid', aggregateType: 'product_sale_line', aggregateId: created.id,
        shopId, occurredAt, data: { sale: { lineId: created.id, transactionId: checkout.id, productId: product.id, productName: product.name, sku: product.sku, ...totals, paymentMethod: args.paymentMethod, lots: allocations.map(({ lotId, quantity }) => ({ lotId, quantity })), actorId: context.session?.itemId ?? null } },
      }));
      return created;
    });
    return { success: true, error: null, sale: { id: line.id, transactionId: line.transactionId, productName: line.productNameSnapshot, quantity: line.quantity, subtotal: line.subtotal, taxAmount: line.taxAmount, total: line.total } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to record product sale.', returned: null, sale: null };
  }
}

/**
 * Records a retail return. The cash refund is recorded only when the operator
 * confirms cash was handed back; returned goods go back to sellable stock only
 * when they are explicitly restocked into an unexpired lot.
 */
export async function returnProductSaleLine(_root: unknown, args: { saleLineId: string; quantity: number; reason: string; cashReturned?: boolean | null; restock?: boolean | null; idempotencyKey: string }, context: Context) {
  if (!permissions.canManagePayments({ session: context.session })) return { success: false, error: 'Not authorized to return product sales.', returned: null };
  if (!args.saleLineId || !args.idempotencyKey?.trim() || !args.reason?.trim()) return { success: false, error: 'Sale line, reason, and idempotency key are required.', returned: null };
  if (args.cashReturned !== true) return { success: false, error: 'Confirm the cash refund was handed to the customer before recording the return.', returned: null };
  const restock = args.restock === true;
  try {
    const hash = hashPublicAccessToken(args.idempotencyKey.trim());
    const returned = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client as Prisma.TransactionClient;
      const shopId = await requireCurrentShopPermission(context.session, 'canManagePayments', transaction);
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-product-return', args.saleLineId);
      const lineNumber = `product-return-${hash.slice(0, 24)}`;
      const replay = await transaction.productSaleLine.findUnique({ where: { lineNumber }, include: { transaction: true } });
      if (replay) {
        if (replay.shopId !== shopId) throw new Error('Product return idempotency key was reused with different input.');
        assertUsdSettlementCurrency(replay.transaction?.currencyCode);
        if (
          replay.originalLineId !== args.saleLineId
          || replay.quantity !== Math.floor(Number(args.quantity))
          || replay.transaction?.notes !== args.reason.trim()
        ) throw new Error('Product return idempotency key was reused with different input.');
        return replay;
      }
      const original = await transaction.productSaleLine.findFirst({ where: { id: args.saleLineId, shopId }, include: { inventoryMovement: true, transaction: true, product: { select: { inventoryTracked: true } } } });
      if (!original || original.lineType !== 'sale' || !original.productId) throw new Error('Original product sale was not found.');
      assertUsdSettlementCurrency(original.transaction?.currencyCode);
      const quantity = Math.floor(Number(args.quantity));
      const returnedBefore = original.returnedQuantity || 0;
      const available = original.quantity - returnedBefore;
      if (!Number.isFinite(quantity) || quantity < 1 || quantity > available) throw new Error('Return quantity exceeds the unreturned sale quantity.');

      const occurredAt = new Date();
      let restockLot: { id: string; quantityRemaining: number | null; status: string | null } | null = null;
      if (restock) {
        if (original.product?.inventoryTracked === false) throw new Error('This product is not stock-tracked, so it cannot be restocked.');
        const saleMovements = await transaction.inventoryMovement.findMany({
          where: { shopId, OR: [{ productSaleLineId: original.id }, { referenceKey: { startsWith: `product-sale:${original.id}:lot:` } }] },
          select: { inventoryLotId: true },
        });
        const lotIds = Array.from(new Set(saleMovements.map((movement) => movement.inventoryLotId).filter((id): id is string => Boolean(id)))).sort();
        if (!lotIds.length) throw new Error('Original inventory evidence is missing.');
        for (const lotId of lotIds) await lockLot(transaction, lotId);
        restockLot = await transaction.inventoryLot.findFirst({
          where: { id: { in: lotIds }, shopId, status: { in: ['active', 'consumed'] }, OR: [{ expiresAt: null }, { expiresAt: { gt: occurredAt } }] },
          orderBy: [{ expiresAt: { sort: 'desc', nulls: 'first' } }, { id: 'asc' }],
          select: { id: true, quantityRemaining: true, status: true },
        });
        if (!restockLot) throw new Error('The original stock lot has expired or is unavailable. Record the return without restocking.');
      }

      const subtotal = -original.unitPrice * quantity;
      const taxAmount = -allocatedReturnTax(original.taxAmount, original.quantity, returnedBefore, quantity);
      const total = subtotal + taxAmount;
      const checkout = await transaction.checkoutTransaction.create({ data: {
        shopId, status: 'refunded', subtotal, taxAmount, total, currencyCode: 'USD',
        paymentMethod: original.transaction?.paymentMethod || 'other', completedAt: occurredAt, notes: args.reason.trim(),
      } });
      const created = await transaction.productSaleLine.create({ data: {
        shopId, lineNumber, transactionId: checkout.id, productId: original.productId, originalLineId: original.id,
        lineType: 'return', productNameSnapshot: original.productNameSnapshot, skuSnapshot: original.skuSnapshot,
        quantity, unitPrice: original.unitPrice, subtotal, taxAmount, total, occurredAt,
      } });
      if (restockLot) {
        const quantityAfter = (restockLot.quantityRemaining || 0) + quantity;
        await transaction.inventoryMovement.create({ data: {
          shopId, productId: original.productId, inventoryLotId: restockLot.id, productSaleLineId: created.id,
          movementType: 'return', quantityDelta: quantity, quantityAfter, reason: `Restocked return: ${args.reason.trim()}`, referenceKey: `product-return:${created.id}`, occurredAt,
        } });
        await transaction.inventoryLot.update({ where: { id: restockLot.id }, data: { quantityRemaining: quantityAfter, ...(restockLot.status === 'consumed' ? { status: 'active' } : {}) } });
      }
      await transaction.productSaleLine.update({ where: { id: original.id }, data: { returnedQuantity: returnedBefore + quantity } });
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId,
        eventKey: `product-return:${created.id}:refunded:v1`, eventType: 'product_sale.returned', aggregateType: 'product_sale_line', aggregateId: created.id,
        shopId, occurredAt, data: { return: { lineId: created.id, originalLineId: original.id, transactionId: checkout.id, productId: original.productId, quantity, subtotal, taxAmount, total, reason: args.reason.trim(), cashReturned: true, restocked: Boolean(restockLot), restockLotId: restockLot?.id ?? null, actorId: context.session?.itemId ?? null } },
      }));
      return created;
    });
    return { success: true, error: null, returned: { id: returned.id, originalLineId: returned.originalLineId, quantity: returned.quantity, subtotal: returned.subtotal, taxAmount: returned.taxAmount, total: returned.total } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to return product sale.', returned: null };
  }
}
