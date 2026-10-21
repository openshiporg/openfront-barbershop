import { sanitizeStoreLogoSvg } from '../../shared/sanitize-store-logo';
import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from '../../platform/store-settings/lib/store-logo';
import {
  isStorefrontBrandColor,
  type PublicStorefrontSettings,
} from '../../shared/storefront-settings';
import { resolvePublishedShop } from '../utils/publicShop';

type PublicSettingsContext = {
  sudo(): {
    prisma: Parameters<typeof resolvePublishedShop>[0];
  };
};

export default async function getPublicStorefrontSettings(
  _root: unknown,
  _args: unknown,
  context: PublicSettingsContext,
): Promise<PublicStorefrontSettings | null> {
  const shop = await resolvePublishedShop(context.sudo().prisma, {
    id: true,
    name: true,
    tagline: true,
    address: true,
    phone: true,
    timezone: true,
    currencyCode: true,
    hours: true,
    brandColor: true,
    logoIcon: true,
    logoColor: true,
    isDemo: true,
  });

  if (!shop?.id || !shop.name || !shop.timezone || !shop.currencyCode || !isStorefrontBrandColor(shop.brandColor)) {
    return null;
  }

  return {
    id: shop.id,
    name: shop.name,
    tagline: shop.tagline || null,
    address: shop.address || null,
    phone: shop.phone || null,
    timezone: shop.timezone,
    currencyCode: shop.currencyCode,
    hours: shop.hours && typeof shop.hours === 'object' ? shop.hours as Record<string, unknown> : null,
    brandColor: shop.brandColor,
    logoIcon: sanitizeStoreLogoSvg(shop.logoIcon || '') || DEFAULT_STORE_LOGO_ICON,
    logoColor: normalizeStoreLogoColor(shop.logoColor),
    isDemo: Boolean(shop.isDemo),
  };
}
