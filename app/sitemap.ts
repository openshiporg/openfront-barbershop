import type { MetadataRoute } from 'next';
import { getPublicStorefrontSettings } from '@/features/storefront/lib/data/settings';
import { getAllBarbers, getAllServices, getRetailProducts } from '@/features/storefront/lib/data/services';
import { trustedOrigin } from '@/features/shared/trusted-origin';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getPublicStorefrontSettings();
  if (!settings || settings.isDemo) return [];
  const origin = trustedOrigin();
  const [services, barbers, products] = await Promise.all([getAllServices().catch(() => []), getAllBarbers().catch(() => []), getRetailProducts().catch(() => [])]);
  return [
    ...['/', '/services', '/barbers', '/book', '/queue', '/shop', '/memberships'].map((path) => ({ url: `${origin}${path}` })),
    ...services.map((service) => ({ url: `${origin}/services/${service.id}` })),
    ...barbers.map((barber) => ({ url: `${origin}/barbers/${barber.id}` })),
    ...products.map((product) => ({ url: `${origin}/shop/${product.id}` })),
  ];
}
