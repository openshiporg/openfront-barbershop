'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export type InventoryReceiptInput = {
  productId: string;
  supplierId?: string;
  lotNumber: string;
  quantity: number;
  // Actual invoiced unit cost in cents, as declared by the operator.
  unitCost: number;
  receivedAt?: string;
  expiresAt?: string;
};

export async function receiveInventoryAction(input: InventoryReceiptInput, key: string) {
  if (!key || key.length < 8) return { success: false, error: 'A command key is required.' };
  const response = await keystoneClient<{ receiveInventoryLot: { success: boolean; error?: string | null } }>(`
    mutation ReceiveInventory($productId: ID!, $supplierId: ID, $lotNumber: String!, $quantity: Int!, $unitCost: Int, $receivedAt: String, $expiresAt: String, $key: String!) {
      receiveInventoryLot(productId: $productId, supplierId: $supplierId, lotNumber: $lotNumber, quantity: $quantity, unitCost: $unitCost, receivedAt: $receivedAt, expiresAt: $expiresAt, idempotencyKey: $key) { success error data }
    }
  `, { ...input, supplierId: input.supplierId || null, receivedAt: input.receivedAt || null, expiresAt: input.expiresAt || null, key });
  const result = response.data?.receiveInventoryLot;
  if (!response.success || !result) return { success: false, error: response.error || 'Unable to receive inventory.' };
  if (result.success) revalidatePath('/dashboard/platform/barbershop');
  return { success: Boolean(result.success), error: result.error || null };
}
