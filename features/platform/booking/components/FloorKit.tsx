import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { StatusDot, thClass, type Tone } from '@/features/platform/lib/ui';

/*
 * The floor: one cell per chair (barber, who is in it, since when / free),
 * shared by the walk-in queue and the booking board. Also the classes for an
 * operator table that becomes stacked rows on a phone instead of scrolling.
 */

export type ChairCell = {
  id: string;
  barber: string;
  chair?: string | null;
  tone: Tone;
  /** Who is in the chair, or the state word ("Free", "Off today"). */
  occupant: ReactNode;
  occupied?: boolean;
  /** Service or next booking. */
  detail?: ReactNode;
  /** "since 2:10 PM · 24 min" */
  since?: ReactNode;
};

export function ChairStrip({ cells, label = 'Chairs', empty }: { cells: ChairCell[]; label?: string; empty?: ReactNode }) {
  if (!cells.length) return empty ? <p className="rounded-[6px] border px-3 py-3 text-sm text-muted-foreground">{empty}</p> : null;
  return (
    // Wrapping flex with growing cells: every row spans the full width, so no empty painted track reads as an extra chair.
    <ul aria-label={label} className="flex flex-wrap gap-px overflow-hidden rounded-[6px] border bg-border">
      {cells.map((cell) => (
        <li key={cell.id} className={cn('min-w-0 grow basis-[calc(50%-1px)] bg-background px-3 py-2.5 sm:basis-[calc(33.333%-1px)] lg:basis-48', !cell.occupied && 'bg-muted/25')}>
          <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate"><StatusDot tone={cell.tone} className="mr-1.5" />{cell.barber}</span>
            {cell.chair ? <span className="shrink-0 tabular-nums">Chair {cell.chair}</span> : null}
          </p>
          <p className={cn('mt-1 truncate text-sm', cell.occupied ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{cell.occupant}</p>
          {cell.detail ? <p className="truncate text-xs text-muted-foreground">{cell.detail}</p> : null}
          {cell.since ? <p className="mt-0.5 truncate text-xs tabular-nums text-muted-foreground" suppressHydrationWarning>{cell.since}</p> : null}
        </li>
      ))}
    </ul>
  );
}

/** Table that stacks into rows under md. The wrapper is `relative` so nothing escapes it. */
export const stack = {
  wrap: 'relative min-w-0 rounded-[6px] border bg-background',
  table: 'w-full border-collapse text-sm max-md:block',
  head: 'max-md:hidden',
  th: thClass,
  body: 'max-md:block',
  row: 'align-top max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-3 max-md:gap-y-1 max-md:border-b max-md:px-3 max-md:py-3 max-md:last:border-b-0',
  td: 'border-b px-3 py-2.5 align-top [tr:last-child>&]:border-b-0 max-md:border-0 max-md:p-0',
  /** A cell that takes the full width of a stacked row (actions, forms). */
  full: 'max-md:col-span-2',
  /** A cell hidden on phones because its content is folded into another cell there. */
  wide: 'max-md:hidden',
};

/** Minutes between an ISO instant and now, as "24 min" / "1 h 5 min". */
export function sinceLabel(from: string | null | undefined, now: number) {
  if (!from) return null;
  const minutes = Math.max(0, Math.floor((now - new Date(from).getTime()) / 60_000));
  if (Number.isNaN(minutes)) return null;
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** A 2–4 option choice as flat 6px buttons (radio semantics), never a pill track. */
export function Segmented<T extends string>({ label, value, options, onChange, size = 'sm', block = false, disabled = false }: {
  label: string;
  value: T;
  options: Array<{ value: T; label: ReactNode; hint?: ReactNode }>;
  onChange: (value: T) => void;
  size?: 'sm' | 'lg';
  block?: boolean;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex flex-wrap gap-1.5', block ? 'w-full [&>*]:flex-1' : 'inline-flex')}>
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex min-w-0 select-none flex-col items-center justify-center whitespace-nowrap rounded-[6px] border font-medium transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
              size === 'lg' ? 'h-12 px-4 text-sm' : 'h-8 px-2.5 text-xs',
              checked ? (size === 'lg' ? 'border-foreground bg-foreground text-background' : 'border-foreground bg-muted text-foreground') : 'border-border bg-background text-foreground hover:border-foreground/30 hover:bg-muted/60',
            )}
          >
            <span>{option.label}</span>
            {option.hint ? <span className={cn('text-[11px] font-normal', checked && size === 'lg' ? 'text-background/70' : 'text-muted-foreground')}>{option.hint}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** In-page underline tabs (client state), matching the kit's StatusTabs. */
export function LocalTabs<T extends string>({ label, value, tabs, onChange, idBase }: {
  label: string;
  value: T;
  tabs: Array<{ value: T; label: ReactNode; count?: number }>;
  onChange: (value: T) => void;
  idBase: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="relative -mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
      <div className="flex min-w-max items-end gap-5 border-b">
        {tabs.map((tab) => {
          const active = tab.value === value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              id={`${idBase}-tab-${tab.value}`}
              aria-selected={active}
              aria-controls={`${idBase}-panel-${tab.value}`}
              onClick={() => onChange(tab.value)}
              className={cn('-mb-px inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', active ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground')}
            >
              {tab.label}{tab.count !== undefined ? <span className={cn('text-xs tabular-nums', active ? 'text-foreground/70' : 'text-muted-foreground/80')}>{tab.count}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
