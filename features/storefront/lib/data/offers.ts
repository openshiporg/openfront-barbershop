'use server';

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { storefrontClient } from '../config';

export type PackageOffer = { id: string; name: string; description: string | null; price: number; items: Array<{ quantity: number; serviceId: string; serviceName: string }> };
export type PlanOffer = { id: string; name: string; description: string | null; price: number; billingInterval: string; includedVisits: number | null; discountPercent: number | null };
export type BarberDay = { dayOfWeek: string; startMinute: number | null; endMinute: number | null };
export type AccountBalance = { id: string; status: string; remainingVisits: number | null; name: string; kind: 'package' | 'membership'; billingInterval: string | null; expiresAt: string | null; nextBillingAt: string | null };

/** Packages and memberships for sale; null when the request fails. */
export async function getMembershipOffers(): Promise<{ packages: PackageOffer[]; plans: PlanOffer[] } | null> {
  try {
    const data = await storefrontClient.request<{ getPublicMembershipOffers: { packages: PackageOffer[]; plans: PlanOffer[] } }>('query { getPublicMembershipOffers { packages { id name description price items { quantity serviceId serviceName } } plans { id name description price billingInterval includedVisits discountPercent } } }');
    return data.getPublicMembershipOffers;
  } catch { return null; }
}

export async function getBarberWeek(barberId: string): Promise<BarberDay[]> {
  try {
    const data = await storefrontClient.request<{ getPublicBarberWeek: BarberDay[] }>('query($id: ID!) { getPublicBarberWeek(barberId: $id) { dayOfWeek startMinute endMinute } }', { id: barberId });
    return data.getPublicBarberWeek;
  } catch { return []; }
}

export async function getAccountBalances(): Promise<AccountBalance[] | null> {
  const result = await keystoneClient<{ accountBalances: { success: boolean; data: AccountBalance[] | null } }>('query { accountBalances { success error data } }', {}, { cache: 'no-store' });
  return result.success && result.data.accountBalances.success ? result.data.accountBalances.data || [] : null;
}
