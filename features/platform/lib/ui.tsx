import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * Barbershop platform kit: the floor. Flat 6px controls (no pills, no recessed
 * track), underline status tabs, a one-line readout ledger, ruled sections and
 * dense tables with a status column. Radii are explicit pixels because the
 * shared dashboard theme sets --radius to 10px. Built on the dashboard's own
 * tokens so it follows the shared shell in light and dark.
 */

export type Tone = 'live' | 'wait' | 'info' | 'alert' | 'off';

const toneClass: Record<Tone, string> = {
  live: 'bg-emerald-500',
  wait: 'bg-amber-500',
  info: 'bg-blue-600 dark:bg-blue-500',
  alert: 'bg-red-500',
  off: 'bg-zinc-400 dark:bg-zinc-500',
};

/** Inline dot that sits on the title line, before the title text. */
export function StatusDot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden="true" className={cn('mr-2 inline-block size-2 shrink-0 rounded-full align-[0.18em]', toneClass[tone], className)} />;
}

export function PageHeader({ title, tone, meta, actions }: { title: ReactNode; tone?: Tone; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 md:text-[1.375rem] dark:text-gray-50">{tone ? <StatusDot tone={tone} /> : null}{title}</h1>
        {meta ? <p className="mt-1 text-sm text-muted-foreground">{meta}</p> : null}
      </div>
      {actions}
    </div>
  );
}

/** A plain row of related controls. No recessed track; narrow rows scroll or wrap. */
export function Track({ children, className, label, block = false, wrap = false }: { children: ReactNode; className?: string; label?: string; block?: boolean; wrap?: boolean }) {
  return (
    <div
      role={label ? 'group' : undefined}
      aria-label={label}
      className={cn(
        'max-w-full items-center gap-1.5',
        block ? 'flex w-full flex-wrap [&>*]:flex-1'
          : wrap ? 'inline-flex flex-wrap'
          : 'relative inline-flex flex-nowrap overflow-x-auto [scrollbar-width:none] [&>*]:shrink-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

export type PillVariant = 'raised' | 'primary' | 'flat' | 'danger';

export function pillClass(variant: PillVariant = 'raised', size: 'sm' | 'md' = 'md') {
  return cn(
    'inline-flex min-w-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] font-medium transition-[background-color,color,border-color,transform] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background [&_svg]:size-4 [&_svg]:shrink-0',
    size === 'sm' ? 'h-9 px-2.5 text-xs sm:h-8' : 'h-10 px-3.5 text-sm sm:h-9',
    variant === 'raised' && 'border border-border bg-background text-foreground hover:border-foreground/25 hover:bg-muted/60',
    variant === 'primary' && 'bg-foreground text-background hover:bg-foreground/85',
    variant === 'danger' && 'border border-red-300 bg-background text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40',
    variant === 'flat' && 'border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:border-foreground aria-pressed:bg-background aria-pressed:text-foreground aria-[checked=true]:border-foreground aria-[checked=true]:bg-background aria-[checked=true]:text-foreground',
  );
}

export function Pill({ variant = 'raised', size = 'md', className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: PillVariant; size?: 'sm' | 'md' }) {
  return <button type={type} className={cn(pillClass(variant, size), className)} {...props} />;
}

export function PillLink({ href, variant = 'raised', size = 'md', className, children }: { href: string; variant?: PillVariant; size?: 'sm' | 'md'; className?: string; children: ReactNode }) {
  return <Link href={href} className={cn(pillClass(variant, size), className)}>{children}</Link>;
}

/** The counts that decide what to do next, as one ruled ledger line. */
export function Readouts({ items }: { items: Array<{ label: string; value: ReactNode; tone?: Tone }> }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border bg-border sm:flex sm:flex-wrap">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 bg-background px-4 py-2.5 sm:min-w-[8.5rem] sm:flex-1">
          <dt className="truncate text-xs text-muted-foreground">{item.tone ? <StatusDot tone={item.tone} className="mr-1.5" /> : null}{item.label}</dt>
          <dd className="mt-0.5 truncate text-lg font-semibold leading-tight tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Section({ title, tone, count, actions, children, id, className }: { title: ReactNode; tone?: Tone; count?: ReactNode; actions?: ReactNode; children: ReactNode; id?: string; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn('min-w-0', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <h2 id={id} className="text-sm font-semibold">{tone ? <StatusDot tone={tone} /> : null}{title}{count !== undefined ? <span className="ml-2 text-xs font-normal tabular-nums text-muted-foreground">{count}</span> : null}</h2>
        {actions}
      </div>
      <div className="pt-3">{children}</div>
    </section>
  );
}

export function Notice({ tone = 'status', children, className }: { tone?: 'status' | 'alert'; children: ReactNode; className?: string }) {
  return <p role={tone} className={cn('rounded-[6px] border px-3 py-2 text-sm', tone === 'alert' ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'bg-muted/50 text-foreground', className)}>{children}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-4 text-sm text-muted-foreground">{children}</p>;
}

export function Restricted({ children }: { children: ReactNode }) {
  return <p role="status" className="py-2 text-sm text-muted-foreground"><StatusDot tone="off" />{children}</p>;
}

/** Native select styled to match the shadcn Input. */
export const selectClass = 'h-9 w-full min-w-0 rounded-[6px] border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

export function Tag({ children, tone }: { children: ReactNode; tone?: Tone }) {
  return <span className="inline-flex h-5 items-center rounded-[4px] border bg-muted/40 px-1.5 text-[11px] font-medium capitalize text-foreground">{tone ? <StatusDot tone={tone} className="mr-1.5 size-1.5 align-[0.15em]" /> : null}{children}</span>;
}

export function Pager({ page, pages, prev, next, label }: { page: number; pages: number; prev?: string | null; next?: string | null; label: string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label={label} className="flex items-center justify-between gap-3 pt-3">
      <Track>
        {prev ? <PillLink href={prev} size="sm">Previous</PillLink> : <Pill size="sm" disabled>Previous</Pill>}
        {next ? <PillLink href={next} size="sm">Next</PillLink> : <Pill size="sm" disabled>Next</Pill>}
      </Track>
      <span className="text-xs tabular-nums text-muted-foreground">{page} / {pages}</span>
    </nav>
  );
}

/** Last-refresh time in the shop's timezone (server and browser agree on it). */
export function liveStamp(at: Date, timeZone?: string | null) {
  try { return at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', ...(timeZone ? { timeZone } : {}) }); }
  catch { return at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
}

/** Status filters as flat underline tabs. Server-safe: takes plain data and a href builder. */
export function StatusTabs({ tabs, current, hrefFor, label = 'Status' }: { tabs: Array<{ value: string; label: string; count?: number; tone?: Tone }>; current: string; hrefFor: (value: string) => string; label?: string }) {
  return (
    <nav aria-label={label} className="relative -mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
      <div className="flex min-w-max items-end gap-5 border-b">
        {tabs.map((tab) => {
          const active = tab.value === current;
          return (
            <Link key={tab.value || 'all'} href={hrefFor(tab.value)} aria-current={active ? 'page' : undefined} className={cn('-mb-px inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', active ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground')}>
              {tab.tone ? <StatusDot tone={tab.tone} className="mr-0" /> : null}{tab.label}{tab.count !== undefined ? <span className={cn('text-xs tabular-nums', active ? 'text-foreground/70' : 'text-muted-foreground/80')}>{tab.count}</span> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Dense operator table parts. */
export const tableWrapClass = 'relative min-w-0 overflow-x-auto rounded-[6px] border bg-background';
export const thClass = 'h-9 whitespace-nowrap border-b bg-muted/40 px-3 text-left align-middle text-xs font-medium text-muted-foreground';
export const tdClass = 'border-b px-3 py-2.5 align-top [tr:last-child>&]:border-b-0';

export function DataTable({ label, head, children, className }: { label: string; head: Array<{ label: ReactNode; className?: string }>; children: ReactNode; className?: string }) {
  return (
    <div className={cn(tableWrapClass, className)}>
      <table className="w-full border-collapse text-sm" aria-label={label}>
        <thead><tr>{head.map((column, index) => <th key={index} scope="col" className={cn(thClass, column.className)}>{column.label}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn(tdClass, className)}>{children}</td>;
}

/** Status in a table cell: dot + word, never a coloured pill. */
export function StatusCell({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className="inline-flex items-center whitespace-nowrap text-[13px] font-medium"><StatusDot tone={tone} className="mr-1.5 align-middle" />{children}</span>;
}
