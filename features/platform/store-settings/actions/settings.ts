'use server';

import { sanitizeStoreLogoSvg } from '@/features/shared/sanitize-store-logo';
import { normalizeStoreLogoColor } from '../lib/store-logo';
import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import type { PublicStorefrontSettings, StorefrontBrandColor } from '@/features/shared/storefront-settings';

export type ActiveShopStorefrontSettings = PublicStorefrontSettings & { isPublic: boolean };

export async function getActiveShopStorefrontSettingsAction() {
  const response = await keystoneClient<{
    activeShopStorefrontSettings: { success: boolean; error?: string | null; data?: ActiveShopStorefrontSettings | null };
  }>(`
    query ActiveShopStorefrontSettings {
      activeShopStorefrontSettings { success error data }
    }
  `, {}, { cache: 'no-store' });

  const result = response.data?.activeShopStorefrontSettings;
  if (!response.success || !result?.success) {
    return { success: false as const, error: result?.error || response.error || 'Unable to load store settings.', data: null };
  }
  return { success: true as const, error: null, data: result.data || null };
}

export type StorefrontSettingsInput = {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  timezone: string;
  currencyCode: string;
  brandColor: StorefrontBrandColor;
  logoIcon: string;
  logoColor: string;
  isPublic: boolean;
  isDemo: boolean;
};

const EDITABLE_FIELDS = ['name', 'tagline', 'address', 'phone', 'timezone', 'currencyCode', 'brandColor', 'logoIcon', 'logoColor', 'isPublic', 'isDemo'] as const;

function editableSnapshot(settings: Partial<ActiveShopStorefrontSettings> | null | undefined) {
  return JSON.stringify(EDITABLE_FIELDS.map((field) => settings?.[field] ?? null));
}

/**
 * Saves the settings the operator loaded for `expectedShopId`. The save is
 * refused when the active shop changed (for example in another tab) or when the
 * stored settings changed since `expected` was loaded, so a draft is never
 * written to a different shop or over a newer edit.
 */
export async function updateActiveShopStorefrontSettingsAction(
  expectedShopId: string,
  expected: ActiveShopStorefrontSettings,
  data: StorefrontSettingsInput,
) {
  const logoIcon = sanitizeStoreLogoSvg(data.logoIcon);
  if (!logoIcon) return { success: false as const, conflict: false, error: 'Invalid SVG format.', data: null };
  const current = await getActiveShopStorefrontSettingsAction();
  if (!current.success || !current.data) {
    return { success: false as const, conflict: false, error: current.error || 'Unable to verify the active shop.', data: null };
  }
  if (current.data.id !== expectedShopId) {
    return { success: false as const, conflict: true, error: 'Your active shop changed since this form was loaded. Your changes were not saved. Reload to edit the current shop.', data: null };
  }
  if (editableSnapshot(current.data) !== editableSnapshot(expected)) {
    return { success: false as const, conflict: true, error: 'These settings were changed elsewhere since you loaded them. Your changes were not saved. Reload to see the latest settings.', data: null };
  }
  const response = await keystoneClient<{
    updateActiveShopStorefrontSettings: { success: boolean; error?: string | null; data?: ActiveShopStorefrontSettings | null };
  }>(`
    mutation UpdateActiveShopStorefrontSettings(
      $name: String!
      $tagline: String
      $address: String
      $phone: String
      $timezone: String!
      $currencyCode: String!
      $brandColor: String!
      $logoIcon: String
      $logoColor: String
      $isPublic: Boolean!
      $isDemo: Boolean!
      $expectedShopId: ID
      $expectedVersion: String
    ) {
      updateActiveShopStorefrontSettings(
        name: $name
        tagline: $tagline
        address: $address
        phone: $phone
        timezone: $timezone
        currencyCode: $currencyCode
        brandColor: $brandColor
        logoIcon: $logoIcon
        logoColor: $logoColor
        isPublic: $isPublic
        isDemo: $isDemo
        expectedShopId: $expectedShopId
        expectedVersion: $expectedVersion
      ) { success error data }
    }
  `, {
    ...data,
    logoIcon,
    logoColor: normalizeStoreLogoColor(data.logoColor),
    expectedShopId,
    expectedVersion: (expected as { updatedAt?: string | null }).updatedAt || null,
  });

  const result = response.data?.updateActiveShopStorefrontSettings;
  if (!response.success || !result?.success) {
    return { success: false as const, conflict: false, error: result?.error || response.error || 'Unable to update store settings.', data: null };
  }
  if (result.data?.id !== expectedShopId) {
    return { success: false as const, conflict: true, error: 'The save could not be confirmed for this shop. Reload to check the current settings.', data: null };
  }

  revalidatePath('/', 'layout');
  revalidatePath('/dashboard/platform/store-settings');
  return { success: true as const, conflict: false, error: null, data: result.data };
}
