import type { MetadataRoute } from 'next';
import { trustedOrigin } from '@/features/shared/trusted-origin';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/dashboard', '/api', '/account', '/appointment'] },
    sitemap: `${trustedOrigin()}/sitemap.xml`,
  };
}
