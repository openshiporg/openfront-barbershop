/**
 * Small drawn tool marks for the home service chips, picked from the service's
 * own name and category: clippers for fades, a razor for beard and shave work,
 * scissors for combined services, a comb for everything else.
 */
type Glyph = 'comb' | 'clipper' | 'razor' | 'scissors';

export function serviceGlyph(name: string, category?: string | null): Glyph {
  const text = `${name} ${category || ''}`.toLowerCase();
  if (/\+|&| and |combo|package|works/.test(name.toLowerCase())) return 'scissors';
  if (/fade|taper|clipper|buzz|line ?up/.test(text)) return 'clipper';
  if (/beard|shave|razor|towel/.test(text)) return 'razor';
  return 'comb';
}

const PATHS: Record<Glyph, React.ReactNode> = {
  comb: (
    <>
      <path d="M4 9h16v3H4z" />
      <path d="M5.5 12v5M8 12v5M10.5 12v5M13 12v5M15.5 12v5M18 12v5" />
    </>
  ),
  clipper: (
    <>
      <path d="M8 3h8l1 4-1.5 13a1.5 1.5 0 0 1-1.5 1.3h-3a1.5 1.5 0 0 1-1.5-1.3L7 7z" />
      <path d="M8 3V1.5M10.7 3V1.5M13.3 3V1.5M16 3V1.5M9.5 10h5" />
    </>
  ),
  razor: (
    <>
      <path d="M3 8.5 14.5 4l2 4.5L5 13z" />
      <path d="M14.5 8.2 19 18.5a1.6 1.6 0 0 1-2.9 1.3l-4.4-9.9" />
    </>
  ),
  scissors: (
    <>
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="M8 15.8 18.5 3M16 15.8 5.5 3" />
    </>
  ),
};

export function ServiceGlyph({ name, category }: { name: string; category?: string | null }) {
  return (
    <svg className="sf-chip-glyph" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[serviceGlyph(name, category)]}
    </svg>
  );
}
