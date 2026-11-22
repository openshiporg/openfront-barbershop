export const dynamic = 'force-dynamic';

import { DashboardLayout } from '@/features/dashboard/components/DashboardLayout';
import { getAdminMetaAction, getAuthenticatedUser } from '@/features/dashboard/actions';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export default async function ListLayout({ children }: { children: React.ReactNode }) {
  // Fetch adminMeta and user data server-side to avoid loading states
  const [adminMetaResponse, userResponse] = await Promise.all([
    getAdminMetaAction(),
    getAuthenticatedUser()
  ]);
  
  const adminMeta = adminMetaResponse.success ? adminMetaResponse.data : null;
  let user = userResponse.success ? userResponse.data?.authenticatedItem : null;

  // A shop that already has services and barbers is set up: staff who join it later are not asked to set it up again.
  if (user && user.onboardingStatus !== 'completed' && user.onboardingStatus !== 'dismissed') {
    const shop = await keystoneClient<{ servicesCount: number; barbersCount: number }>('query ShopIsSetUp { servicesCount barbersCount }');
    if (shop.success && shop.data.servicesCount > 0 && shop.data.barbersCount > 0) user = { ...user, onboardingStatus: 'completed' };
  }

  return (
    <DashboardLayout adminMeta={adminMeta} authenticatedItem={user}>
      {children}
    </DashboardLayout>
  );
}