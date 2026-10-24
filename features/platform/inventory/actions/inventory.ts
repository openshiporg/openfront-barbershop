'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { activeShop } from '@/features/platform/lib/activeShop';
import { dollarsToCents, platformCommand, platformRequest, trimmed } from '@/features/platform/lib/platformRequest';

/** Products below this many units on hand are flagged for reorder. */
const LOW_STOCK = 5;

type Lot = { id: string; lotNumber: string; quantityReceived: number | null; quantityRemaining: number | null; unitCost: number | null; receivedAt: string | null; expiresAt: string | null; status: string; supplier: { id: string; name: string } | null };
export type StockProduct = { id: string; name: string; sku: string | null; status: string; productType: string; price: number; cost: number; inventoryTracked: boolean; onHand: number; low: boolean; soldLast30: number };
export type StockData = { shopName: string; status: string; search: string; products: StockProduct[]; counts: Record<string, number>; suppliers: Array<{ id: string; name: string }> };

type RawProduct = Omit<StockProduct, 'onHand' | 'low' | 'soldLast30'> & { inventoryLots: Array<{ quantityRemaining: number | null }>; saleLines: Array<{ quantity: number | null; lineType: string }> };

function stock(product: RawProduct): StockProduct {
  const { inventoryLots, saleLines, ...rest } = product;
  const onHand = inventoryLots.reduce((sum, lot) => sum + (lot.quantityRemaining || 0), 0);
  const soldLast30 = saleLines.reduce((sum, line) => sum + (line.lineType === 'sale' ? line.quantity || 0 : -(line.quantity || 0)), 0);
  return { ...rest, onHand, low: product.inventoryTracked && product.status === 'active' && onHand < LOW_STOCK, soldLast30 };
}

const PRODUCT_FIELDS = (since: string) => `id name sku status productType price cost inventoryTracked inventoryLots(where: { status: { equals: active } }) { quantityRemaining } saleLines(where: { occurredAt: { gte: "${since}" } }) { quantity lineType }`;

export async function getStockAction(input: { status?: string; search?: string }): Promise<StockData | null> {
  const shop = await activeShop();
  if (!shop) return null;
  const status = ['active', 'draft', 'archived', 'low'].includes(input.status || '') ? String(input.status) : '';
  const search = (input.search || '').trim().slice(0, 80);
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const result = await platformRequest<{ products: RawProduct[]; suppliers: Array<{ id: string; name: string }> }>(`
    query($shop: ID!) {
      products(where: { shop: { id: { equals: $shop } } }, orderBy: [{ name: asc }], take: 500) { ${PRODUCT_FIELDS(since)} }
      suppliers(where: { shop: { id: { equals: $shop } }, status: { equals: active } }, orderBy: [{ name: asc }]) { id name }
    }`, { shop: shop.id });
  if (!result.ok) return null;
  const all = result.data.products.map(stock);
  const matches = (product: StockProduct) => !search || `${product.name} ${product.sku || ''}`.toLowerCase().includes(search.toLowerCase());
  const counts = { '': all.length, active: all.filter((p) => p.status === 'active').length, draft: all.filter((p) => p.status === 'draft').length, archived: all.filter((p) => p.status === 'archived').length, low: all.filter((p) => p.low).length };
  const products = all.filter((product) => (status === 'low' ? product.low : !status || product.status === status) && matches(product));
  return { shopName: shop.name, status, search, products, counts, suppliers: result.data.suppliers };
}

export type ProductDetail = {
  shopName: string; timezone: string;
  product: StockProduct & { description: string | null };
  lots: Lot[];
  movements: Array<{ id: string; movementType: string; quantityDelta: number; quantityAfter: number | null; reason: string | null; occurredAt: string; inventoryLot: { lotNumber: string } | null }>;
  suppliers: Array<{ id: string; name: string }>;
};

export async function getProductDetailAction(id: string): Promise<ProductDetail | null> {
  const shop = await activeShop();
  if (!shop) return null;
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const result = await platformRequest<{ product: (RawProduct & { description: string | null; lots: Lot[]; inventoryMovements: ProductDetail['movements'] }) | null; shop: { timezone: string | null } | null; suppliers: Array<{ id: string; name: string }> }>(`
    query($id: ID!, $shop: ID!) {
      product(where: { id: $id }) {
        ${PRODUCT_FIELDS(since)} description
        lots: inventoryLots(orderBy: [{ receivedAt: desc }], take: 50) { id lotNumber quantityReceived quantityRemaining unitCost receivedAt expiresAt status supplier { id name } }
        inventoryMovements(orderBy: [{ occurredAt: desc }], take: 50) { id movementType quantityDelta quantityAfter reason occurredAt inventoryLot { lotNumber } }
      }
      shop(where: { id: $shop }) { timezone }
      suppliers(where: { shop: { id: { equals: $shop } }, status: { equals: active } }, orderBy: [{ name: asc }]) { id name }
    }`, { id, shop: shop.id });
  if (!result.ok || !result.data.product) return null;
  const { lots, inventoryMovements, description, ...raw } = result.data.product;
  return { shopName: shop.name, timezone: result.data.shop?.timezone || 'UTC', product: { ...stock(raw), description }, lots, movements: inventoryMovements, suppliers: result.data.suppliers };
}

const refresh = (productId?: string) => {
  revalidatePath('/dashboard/platform/inventory', 'layout');
  if (productId) revalidatePath(`/dashboard/platform/inventory/${productId}`);
  revalidatePath('/dashboard/platform/pos');
  revalidatePath('/dashboard/platform/barbershop');
};

export async function receiveDeliveryAction(productId: string, form: FormData) {
  const lotNumber = trimmed(form.get('lotNumber'), 80);
  const quantity = Math.floor(Number(form.get('quantity')));
  const unitCost = dollarsToCents(form.get('unitCost'));
  if (!lotNumber) return { success: false, error: 'Enter the lot or delivery number.' };
  if (!(quantity >= 1 && quantity <= 10000)) return { success: false, error: 'Quantity must be 1 to 10,000.' };
  if (!(unitCost >= 0)) return { success: false, error: 'Enter a valid unit cost.' };
  const result = await platformCommand(`mutation($productId: ID!, $supplierId: ID, $lotNumber: String!, $quantity: Int!, $unitCost: Int, $expiresAt: String, $key: String!) { receiveInventoryLot(productId: $productId, supplierId: $supplierId, lotNumber: $lotNumber, quantity: $quantity, unitCost: $unitCost, expiresAt: $expiresAt, idempotencyKey: $key) { success error data } }`,
    { productId, supplierId: String(form.get('supplierId') || '') || null, lotNumber, quantity, unitCost, expiresAt: String(form.get('expiresAt') || '') || null, key: randomUUID() }, 'receiveInventoryLot');
  if (result.success) refresh(productId);
  return result;
}

/** Waste or a counted correction on one lot; positive or negative for adjustments. */
export async function adjustLotAction(productId: string, form: FormData) {
  const inventoryLotId = String(form.get('lotId') || '');
  const movementType = String(form.get('movementType') || 'adjustment');
  const quantity = Math.floor(Number(form.get('quantity')));
  const reason = trimmed(form.get('reason'), 500);
  if (!inventoryLotId) return { success: false, error: 'Choose a lot.' };
  if (!['waste', 'adjustment'].includes(movementType)) return { success: false, error: 'Choose waste or a count correction.' };
  if (!Number.isInteger(quantity) || quantity === 0 || Math.abs(quantity) > 10000) return { success: false, error: 'Enter a quantity other than zero.' };
  if (!reason) return { success: false, error: 'Enter a reason.' };
  const quantityDelta = movementType === 'waste' ? -Math.abs(quantity) : quantity;
  const result = await platformRequest<{ recordInventoryMovement: { success: boolean; error: string | null } }>(`mutation($lot: ID!, $type: String!, $delta: Int!, $reason: String!, $ref: String!) { recordInventoryMovement(inventoryLotId: $lot, movementType: $type, quantityDelta: $delta, reason: $reason, referenceKey: $ref) { success error } }`,
    { lot: inventoryLotId, type: movementType, delta: quantityDelta, reason, ref: `platform:${randomUUID()}` });
  if (!result.ok) return { success: false, error: result.error };
  if (!result.data.recordInventoryMovement.success) return { success: false, error: result.data.recordInventoryMovement.error || 'Unable to record this.' };
  refresh(productId);
  return { success: true };
}

export type SupplierRow = { id: string; name: string; status: string; contactName: string | null; email: string | null; phone: string | null; website: string | null; notes: string | null; inventoryLotsCount: number };

export async function getSuppliersAction(): Promise<{ shopName: string; suppliers: SupplierRow[] } | null> {
  const shop = await activeShop();
  if (!shop) return null;
  const result = await platformRequest<{ suppliers: Array<Omit<SupplierRow, 'inventoryLotsCount'>>; lots: Array<{ supplier: { id: string } | null }> }>(`
    query($shop: ID!) {
      suppliers(where: { shop: { id: { equals: $shop } } }, orderBy: [{ name: asc }]) { id name status contactName email phone website notes }
      lots: inventoryLots(where: { shop: { id: { equals: $shop } } }, take: 2000) { supplier { id } }
    }`, { shop: shop.id });
  if (!result.ok) return { shopName: shop.name, suppliers: [] };
  const lotCount = new Map<string, number>();
  for (const lot of result.data.lots) if (lot.supplier) lotCount.set(lot.supplier.id, (lotCount.get(lot.supplier.id) || 0) + 1);
  return { shopName: shop.name, suppliers: result.data.suppliers.map((supplier) => ({ ...supplier, inventoryLotsCount: lotCount.get(supplier.id) || 0 })) };
}

export async function saveSupplierAction(id: string | null, form: FormData) {
  const shop = await activeShop();
  if (!shop) return { success: false, error: 'Select an active shop first.' };
  const name = trimmed(form.get('name'), 120);
  if (!name) return { success: false, error: 'Enter the supplier name.' };
  const email = trimmed(form.get('email'), 254);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { success: false, error: 'Enter a valid email.' };
  const data = { name, contactName: trimmed(form.get('contactName'), 120), email, phone: trimmed(form.get('phone'), 40), website: trimmed(form.get('website'), 300), notes: trimmed(form.get('notes'), 2000) };
  const result = id
    ? await platformRequest(`mutation($id: ID!, $data: SupplierUpdateInput!) { updateSupplier(where: { id: $id }, data: $data) { id } }`, { id, data })
    : await platformRequest(`mutation($data: SupplierCreateInput!) { createSupplier(data: $data) { id } }`, { data: { ...data, status: 'active', shop: { connect: { id: shop.id } } } });
  if (!result.ok) return { success: false, error: result.error };
  refresh();
  return { success: true };
}

export async function setSupplierStatusAction(id: string, status: string) {
  if (!['active', 'paused', 'archived'].includes(status)) return { success: false, error: 'Choose a status.' };
  const result = await platformRequest(`mutation($id: ID!, $status: SupplierStatusType) { updateSupplier(where: { id: $id }, data: { status: $status }) { id } }`, { id, status });
  if (!result.ok) return { success: false, error: result.error };
  refresh();
  return { success: true };
}
