import type { MetadataRoute } from 'next';
import { STOREFRONT_BRAND_PRESETS } from '@/features/shared/storefront-settings';
import { getPublicStorefrontSettings } from '@/features/storefront/lib/data/settings';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getPublicStorefrontSettings();
  const name = settings?.name || 'Unconfigured storefront';

  return {
    name,
    short_name: name,
    description: settings?.tagline || 'This storefront has not been published by its owner.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f5f4',
    theme_color: settings ? STOREFRONT_BRAND_PRESETS[settings.brandColor].swatch : '#475569',
    icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
