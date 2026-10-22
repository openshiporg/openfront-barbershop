import type { Metadata } from 'next';
import { Big_Shoulders, Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import { getPublicStorefrontSettings } from '@/features/storefront/lib/data/settings';
import { trustedOrigin } from '@/features/shared/trusted-origin';
import { sanitizeStoreLogoSvg } from '@/features/shared/sanitize-store-logo';
import { normalizeStoreLogoColor } from '@/features/platform/store-settings/lib/store-logo';
import '@/features/storefront/styles/storefront.css';

const bigShoulders = Big_Shoulders({
  variable: '--font-big-shoulders',
  subsets: ['latin'],
  weight: ['700', '800'],
});

const instrumentSans = Instrument_Sans({
  variable: '--font-instrument-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['500', '600'],
});

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
    robots: settings.isDemo ? { index: false, follow: false } : undefined,
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
  return <div className={`${bigShoulders.variable} ${instrumentSans.variable} ${jetbrainsMono.variable}`}>{children}</div>;
}
