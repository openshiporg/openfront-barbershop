'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export type ShopChoice = { id: string; name: string; slug: string; status?: string | null };

const SHOP_CHOICE_LIMIT = 50;

type ShopChoicesResponse = {
  authenticatedItem: {
    id: string;
    activeShop?: ShopChoice | null;
    shopMembershipsCount?: number | null;
    shopMemberships?: Array<{ id: string; shop?: ShopChoice | null }> | null;
  } | null;
};

// The signed-in user's own active memberships (bounded); Shop and ShopMembership
// List access still apply, so foreign or revoked shops never appear.
export async function getActiveShopChoicesAction() {
  const response = await keystoneClient<ShopChoicesResponse>(`
    query ActiveShopChoices($take: Int!) {
      authenticatedItem {
        ... on User {
          id
          activeShop { id name slug status }
          shopMembershipsCount(where: { status: { equals: active }, shop: { status: { equals: active } } })
          shopMemberships(where: { status: { equals: active }, shop: { status: { equals: active } } }, orderBy: [{ createdAt: asc }], take: $take) {
            id
            shop { id name slug status }
          }
        }
      }
    }
  `, { take: SHOP_CHOICE_LIMIT }, { cache: 'no-store' });
  const user = response.data?.authenticatedItem;
  if (!response.success || !user) {
    return { success: false as const, error: response.error || 'Unable to load your shops.', activeShop: null, shops: [] as ShopChoice[], total: 0 };
  }
  const byId = new Map<string, ShopChoice>();
  for (const membership of user.shopMemberships || []) {
    if (membership.shop?.id && !byId.has(membership.shop.id)) byId.set(membership.shop.id, membership.shop);
  }
  const shops = [...byId.values()];
  return { success: true as const, error: null, activeShop: user.activeShop || null, shops, total: user.shopMembershipsCount ?? shops.length };
}

export async function selectActiveShopAction(shopId: string) {
  const response = await keystoneClient<{ selectActiveShop: { success: boolean; error?: string | null; shop?: ShopChoice | null } }>(`mutation SelectActiveShop($shopId: ID!) { selectActiveShop(shopId: $shopId) { success error shop { id name slug } } }`, { shopId });
  const result = response.data?.selectActiveShop;
  if (!response.success || !result) return { success: false, error: response.error || 'Unable to switch shops.', shop: null };
  if (result.success && result.shop?.id !== shopId) return { success: false, error: 'The selected shop could not be confirmed. Refresh and try again.', shop: null };
  if (result.success) revalidatePath('/dashboard', 'layout');
  return { success: result.success, error: result.error || null, shop: result.shop || null };
}
