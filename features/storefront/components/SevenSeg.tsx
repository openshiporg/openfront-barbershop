/**
 * Seven-segment numerals for the "Now serving" board. Every segment is drawn;
 * unlit ones stay as designed ghosts, the way a real LED board reads when off.
 * The SVG is decorative: the value is always given as text for screen readers.
 */

const H = (cy: number) => `9,${cy} 15,${cy - 6} 45,${cy - 6} 51,${cy} 45,${cy + 6} 15,${cy + 6}`;
const V = (cx: number, y0: number, y1: number) => `${cx},${y0} ${cx + 6},${y0 + 6} ${cx + 6},${y1 - 6} ${cx},${y1} ${cx - 6},${y1 - 6} ${cx - 6},${y0 + 6}`;

const SEGMENTS = {
  a: H(6),
  b: V(54, 9, 47),
  c: V(54, 53, 91),
  d: H(94),
  e: V(6, 53, 91),
  f: V(6, 9, 47),
  g: H(50),
} as const;

type Segment = keyof typeof SEGMENTS;

const GLYPHS: Record<string, Segment[]> = {
  '0': ['a', 'b', 'c', 'd', 'e', 'f'],
  '1': ['b', 'c'],
  '2': ['a', 'b', 'g', 'e', 'd'],
  '3': ['a', 'b', 'g', 'c', 'd'],
  '4': ['f', 'g', 'b', 'c'],
  '5': ['a', 'f', 'g', 'c', 'd'],
  '6': ['a', 'f', 'g', 'e', 'd', 'c'],
  '7': ['a', 'b', 'c'],
  '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  '9': ['a', 'b', 'c', 'd', 'f', 'g'],
  '-': ['g'],
  ' ': [],
};

function Digit({ glyph }: { glyph: string }) {
  const lit = GLYPHS[glyph] || [];
  return (
    <svg viewBox="-1 -1 62 102" aria-hidden="true" focusable="false">
      {(Object.keys(SEGMENTS) as Segment[]).map((segment) => (
        <polygon key={segment} points={SEGMENTS[segment]} className={lit.includes(segment) ? 'is-lit' : 'is-ghost'} />
      ))}
    </svg>
  );
}

/** Right-aligned like a real readout: `value` is padded with blanks to `digits`. */
export function SevenSeg({ value, digits, dim = false, className = '' }: { value: string; digits: number; dim?: boolean; className?: string }) {
  const text = value.slice(-digits).padStart(digits, ' ');
  return (
    <span className={`sf-seg ${dim ? 'is-dim' : ''} ${className}`} aria-hidden="true">
      {text.split('').map((glyph, index) => <Digit key={index} glyph={glyph} />)}
    </span>
  );
}
