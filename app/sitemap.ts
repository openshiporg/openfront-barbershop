import type { MetadataRoute } from 'next';
import { getPublicStorefrontSettings } from '@/features/storefront/lib/data/settings';
import { getAllServices } from '@/features/storefront/lib/data/services';
import { trustedOrigin } from '@/features/shared/trusted-origin';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getPublicStorefrontSettings();
  if (!settings || settings.isDemo) return [];
  const origin = trustedOrigin();
  const services = await getAllServices().catch(() => []);
  return [
    ...['/', '/services', '/barbers', '/book', '/queue'].map((path) => ({ url: `${origin}${path}` })),
    ...services.map((service) => ({ url: `${origin}/services/${service.id}` })),
  ];
}
