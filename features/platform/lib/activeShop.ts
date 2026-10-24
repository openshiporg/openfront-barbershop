import { getActiveShopChoicesAction } from '@/features/platform/barbershop/actions/shop';

/** The shop platform writes go to: the selected active shop, or the only one. */
export async function activeShop(): Promise<{ id: string; name: string } | null> {
  const choices = await getActiveShopChoicesAction();
  const shop = choices.activeShop || (choices.shops.length === 1 ? choices.shops[0] : null);
  return shop ? { id: shop.id, name: shop.name } : null;
}
