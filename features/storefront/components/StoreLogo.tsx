import { sanitizeStoreLogoSvg } from '@/features/shared/sanitize-store-logo';
import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from '@/features/platform/store-settings/lib/store-logo';

/** Shared donor-style renderer: library/custom SVG and hue stay independent of accent. */
export function StoreLogo({ svg, color, className = '' }: { svg?: string | null; color?: string | null; className?: string }) {
  const safe = sanitizeStoreLogoSvg(svg || '') || DEFAULT_STORE_LOGO_ICON;
  return <span aria-hidden="true" data-store-logo className={`inline-block size-8 shrink-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full ${className}`} style={{ filter: `hue-rotate(${normalizeStoreLogoColor(color)}deg)` }} dangerouslySetInnerHTML={{ __html: safe }} />;
}
