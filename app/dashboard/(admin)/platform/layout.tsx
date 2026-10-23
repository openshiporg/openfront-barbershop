import { getActiveShopChoicesAction, getClaimableShopsAction } from '@/features/platform/barbershop/actions/shop';
import { ShopAccessPanel } from '@/features/platform/barbershop/screens/ShopAccessPanel';

// Every platform page is shop-scoped: with no shop membership, offer a way in
// instead of a page of access errors.
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const choices = await getActiveShopChoicesAction();
  if (!choices.success || choices.total > 0) return children;
  return <ShopAccessPanel shops={await getClaimableShopsAction()} />;
}
