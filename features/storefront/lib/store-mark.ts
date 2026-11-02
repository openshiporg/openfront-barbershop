import { sanitizeStoreLogoSvg } from '@/features/shared/sanitize-store-logo';
import { DEFAULT_STORE_LOGO_ICON } from '@/features/platform/store-settings/lib/store-logo';

/**
 * The mark the shop chose in Store Settings, sanitized, or "" for none.
 * An empty value, or the platform placeholder onboarding saves when no mark was
 * picked, means the storefront shows the wordmark alone (same rule as Restaurant).
 */
export function storeOwnMark(logoIcon: string | null | undefined): string {
  const raw = (logoIcon || '').trim();
  if (!raw || raw === DEFAULT_STORE_LOGO_ICON) return '';
  const svg = sanitizeStoreLogoSvg(raw);
  return svg && svg !== sanitizeStoreLogoSvg(DEFAULT_STORE_LOGO_ICON) ? svg : '';
}
