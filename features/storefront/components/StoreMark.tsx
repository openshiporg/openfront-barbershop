import { normalizeStoreLogoColor } from '@/features/platform/store-settings/lib/store-logo';
import { storeOwnMark } from '../lib/store-mark';

/** The shop's own Store Settings mark, or nothing: the storefront never shows the platform placeholder. */
export function StoreMark({ svg, color, className = '' }: { svg?: string | null; color?: string | null; className?: string }) {
  const mark = storeOwnMark(svg);
  if (!mark) return null;
  return <span aria-hidden="true" data-store-logo className={`inline-block size-8 shrink-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full ${className}`} style={{ filter: `hue-rotate(${normalizeStoreLogoColor(color)}deg)` }} dangerouslySetInnerHTML={{ __html: mark }} />;
}
