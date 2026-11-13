import type { Metadata } from 'next';
import { Anton, Barlow, Barlow_Condensed, Permanent_Marker } from 'next/font/google';
import { getPublicStorefrontSettings } from '@/features/storefront/lib/data/settings';
import { trustedOrigin } from '@/features/shared/trusted-origin';
import { sanitizeStoreLogoSvg } from '@/features/shared/sanitize-store-logo';
import { normalizeStoreLogoColor } from '@/features/platform/store-settings/lib/store-logo';
import '@/features/storefront/styles/antares.css';

// Antares: oversized poster grotesk, a brush-marker hand, condensed labels, plain body.
const anton = Anton({ variable: '--font-anton', weight: '400', subsets: ['latin'] });
const marker = Permanent_Marker({ variable: '--font-permanent-marker', weight: '400', subsets: ['latin'] });
const barlowCondensed = Barlow_Condensed({ variable: '--font-barlow-condensed', weight: ['500', '600', '700'], subsets: ['latin'] });
const barlow = Barlow({ variable: '--font-barlow', weight: ['400', '500', '600', '700'], subsets: ['latin'] });

/** The shop's own logo (with its chosen colour) as the storefront icon. */
function storeLogoIcon(logoIcon?: string | null, logoColor?: string | null) {
  const logo = sanitizeStoreLogoSvg(logoIcon || '');
  if (!logo) return '/favicon.svg';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><filter id="logo-hue"><feColorMatrix type="hueRotate" values="${normalizeStoreLogoColor(logoColor)}"/></filter></defs><g filter="url(#logo-hue)">${logo}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicStorefrontSettings();
  if (!settings) {
    return {
      title: 'Storefront not configured',
      description: 'This storefront has not been published by its owner.',
      robots: { index: false, follow: false },
      icons: { icon: '/favicon.svg' },
    };
  }

  const description = settings.tagline || `Book services directly with ${settings.name}.`;
  return {
    metadataBase: new URL(trustedOrigin()),
    title: { default: settings.name, template: `%s · ${settings.name}` },
    description,
    applicationName: settings.name,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      siteName: settings.name,
      title: settings.name,
      description,
      url: '/',
      images: [{ url: '/images/barbershop/photo/shop-floor.webp', width: 2200, height: 1238, alt: `${settings.name} shop floor` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: settings.name,
      description,
      images: ['/images/barbershop/photo/shop-floor.webp'],
    },
    icons: { icon: [{ url: storeLogoIcon(settings.logoIcon, settings.logoColor), type: 'image/svg+xml' }] },
  };
}

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${anton.variable} ${marker.variable} ${barlowCondensed.variable} ${barlow.variable}`}>{children}</div>;
}
