'use server';

import type { PublicBookingEligibility } from '@/features/shared/public-booking-eligibility';
import { storefrontClient } from '../config';

export async function getPublicBookingEligibility(): Promise<{ success: boolean; error?: string | null; data?: PublicBookingEligibility | null }> {
  try {
    const result = await storefrontClient.request<{ getPublicBookingEligibility: { success: boolean; error?: string | null; data?: PublicBookingEligibility | null } }>(`
      query PublicBookingEligibility { getPublicBookingEligibility { success error data } }
    `);
    return result.getPublicBookingEligibility;
  } catch {
    return { success: false, error: 'Booking eligibility could not be verified. Contact the shop before requesting a visit.', data: null };
  }
}
