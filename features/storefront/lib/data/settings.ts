'use server';

import { cache } from 'react';
import { PUBLIC_STOREFRONT_SETTINGS_QUERY } from './settings-contracts';
import type { PublicStorefrontSettings } from '@/features/shared/storefront-settings';
import { isStorefrontBrandColor } from '@/features/shared/storefront-settings';
import { storefrontClient } from '../config';

export type StorefrontSettingsState =
  | { status: 'published'; settings: PublicStorefrontSettings }
  | { status: 'unpublished' }
  | { status: 'unavailable' };

/** Separates "the owner hasn't published a storefront" from "the request failed". */
export const getPublicStorefrontSettingsState = cache(async function getPublicStorefrontSettingsState(): Promise<StorefrontSettingsState> {
  try {
    const data = await storefrontClient.request<{ settings?: PublicStorefrontSettings | null }>(PUBLIC_STOREFRONT_SETTINGS_QUERY);
    const settings = data.settings;
    if (!settings?.id || !settings.name || !isStorefrontBrandColor(settings.brandColor)) return { status: 'unpublished' };
    return { status: 'published', settings };
  } catch {
    return { status: 'unavailable' };
  }
});

export const getPublicStorefrontSettings = cache(async function getPublicStorefrontSettings(): Promise<PublicStorefrontSettings | null> {
  const state = await getPublicStorefrontSettingsState();
  return state.status === 'published' ? state.settings : null;
});
