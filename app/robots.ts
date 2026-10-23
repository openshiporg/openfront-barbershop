import type { MetadataRoute } from 'next';
import { getPublicStorefrontSettings } from '@/features/storefront/lib/data/settings';
import { trustedOrigin } from '@/features/shared/trusted-origin';

export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getPublicStorefrontSettings();
  if (!settings || settings.isDemo) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/dashboard', '/api', '/account', '/appointment'] },
    sitemap: `${trustedOrigin()}/sitemap.xml`,
  };
}
