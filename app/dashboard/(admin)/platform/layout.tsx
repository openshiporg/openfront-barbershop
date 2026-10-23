import { getActiveShopChoicesAction, getClaimableShopsAction } from '@/features/platform/barbershop/actions/shop';
import { ShopAccessPanel } from '@/features/platform/barbershop/screens/ShopAccessPanel';

// Every platform page is shop-scoped: with no shop membership, offer a way in
// instead of a page of access errors.
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const choices = await getActiveShopChoicesAction();
  // Bottom room on phones so the floating assistant button never covers actions.
  if (!choices.success || choices.total > 0) return <div className="pb-20 md:pb-0">{children}</div>;
  return <ShopAccessPanel shops={await getClaimableShopsAction()} />;
}
