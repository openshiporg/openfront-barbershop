import { sanitizeStoreLogoSvg } from '../../shared/sanitize-store-logo';
import { normalizeStoreLogoColor } from '../../platform/store-settings/lib/store-logo';
import { requireStorefrontBrandColor } from '../../shared/storefront-settings';
import { assertUsdSettlementCurrency } from './supportedSettlementCurrency';

export type StorefrontSettingsInput = {
  name: string;
  tagline?: string | null;
  address?: string | null;
  phone?: string | null;
  timezone: string;
  currencyCode: string;
  brandColor: string;
  logoIcon?: string;
  logoColor?: string;
  isPublic: boolean;
  isDemo: boolean;
};

function validLogo(svg: string) {
  const sanitized = sanitizeStoreLogoSvg(svg);
  if (!sanitized) throw new Error('Invalid SVG format.');
  return sanitized;
}

function boundedText(value: unknown, label: string, max: number, required = false) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (required && !normalized) throw new Error(`${label} is required.`);
  if (normalized.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  return normalized;
}

export function parseStorefrontSettingsInput(args: StorefrontSettingsInput) {
  const currencyCode = boundedText(args.currencyCode, 'Currency code', 3, true).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new Error('Currency code must be a three-letter ISO code.');
  assertUsdSettlementCurrency(currencyCode);

  const timezone = boundedText(args.timezone, 'Timezone', 100, true);
  if (!/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)+$/.test(timezone)) {
    throw new Error('Timezone must be an IANA timezone such as America/New_York.');
  }

  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); }
  catch { throw new Error('Timezone must be a valid IANA timezone.'); }

  return {
    name: boundedText(args.name, 'Shop name', 120, true),
    tagline: boundedText(args.tagline, 'Tagline', 240),
    address: boundedText(args.address, 'Address', 300),
    phone: boundedText(args.phone, 'Phone', 40),
    timezone,
    currencyCode,
    brandColor: requireStorefrontBrandColor(args.brandColor),
    ...(args.logoIcon === undefined ? {} : { logoIcon: validLogo(args.logoIcon) }),
    ...(args.logoColor === undefined ? {} : { logoColor: normalizeStoreLogoColor(args.logoColor) }),
    isPublic: Boolean(args.isPublic),
    isDemo: Boolean(args.isDemo),
  };
}
