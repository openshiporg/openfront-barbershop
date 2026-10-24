import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * Barbershop platform kit: title-line status dots, raised pills in a recessed
 * track, readout strips and ruled sections. Built on the dashboard's own tokens
 * so it follows the shared shell in light and dark.
 */

export type Tone = 'live' | 'wait' | 'info' | 'alert' | 'off';

const toneClass: Record<Tone, string> = {
  live: 'bg-emerald-500 shadow-[0_0_0_3px_rgb(16_185_129/0.18)]',
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
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">{tone ? <StatusDot tone={tone} /> : null}{title}</h1>
        {meta ? <p className="mt-1 text-sm text-muted-foreground">{meta}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function Track({ children, className, label, block = false, wrap = false }: { children: ReactNode; className?: string; label?: string; block?: boolean; wrap?: boolean }) {
  return (
    <div
      role={label ? 'group' : undefined}
      aria-label={label}
      className={cn(
        'max-w-full items-center gap-1 rounded-full bg-muted p-1 shadow-[inset_0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-inset ring-black/5 dark:bg-zinc-900 dark:shadow-[inset_0_1px_2px_rgb(0_0_0/0.5)] dark:ring-white/5',
        // Inline tracks never wrap into a lopsided blob: on narrow screens they scroll.
        block ? 'flex w-full flex-wrap [&>*]:flex-1'
          // Card actions wrap onto a second row so none is hidden off the edge.
          : wrap ? 'inline-flex flex-wrap rounded-2xl'
          : 'inline-flex flex-nowrap overflow-x-auto [scrollbar-width:none] [&>*]:shrink-0',
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
    'inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-[background-color,color,box-shadow,transform] active:translate-y-px disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4 [&_svg]:shrink-0',
    size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm',
    variant === 'raised' && 'bg-background text-foreground shadow-sm ring-1 ring-black/5 hover:bg-accent dark:bg-zinc-800 dark:ring-white/10 dark:hover:bg-zinc-700',
    variant === 'primary' && 'bg-foreground text-background shadow-sm hover:bg-foreground/85',
    variant === 'danger' && 'bg-background text-red-600 shadow-sm ring-1 ring-black/5 hover:bg-red-50 dark:bg-zinc-800 dark:text-red-400 dark:ring-white/10 dark:hover:bg-red-950/40',
    variant === 'flat' && 'text-muted-foreground hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm aria-pressed:ring-1 aria-pressed:ring-black/5 aria-[checked=true]:bg-background aria-[checked=true]:text-foreground aria-[checked=true]:shadow-sm dark:aria-pressed:bg-zinc-800 dark:aria-[checked=true]:bg-zinc-800',
  );
}

export function Pill({ variant = 'raised', size = 'md', className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: PillVariant; size?: 'sm' | 'md' }) {
  return <button type={type} className={cn(pillClass(variant, size), className)} {...props} />;
}

export function PillLink({ href, variant = 'raised', size = 'md', className, children }: { href: string; variant?: PillVariant; size?: 'sm' | 'md'; className?: string; children: ReactNode }) {
  return <Link href={href} className={cn(pillClass(variant, size), className)}>{children}</Link>;
}

/** Headline figures as a ruled strip of readouts (mono numerals). */
export function Readouts({ items }: { items: Array<{ label: string; value: ReactNode; tone?: Tone }> }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 bg-background px-4 py-3">
          <dt className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{item.tone ? <StatusDot tone={item.tone} /> : null}{item.label}</dt>
          <dd className="mt-1 truncate font-mono text-xl font-semibold tabular-nums sm:text-2xl">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Section({ title, tone, count, actions, children, id, className }: { title: ReactNode; tone?: Tone; count?: ReactNode; actions?: ReactNode; children: ReactNode; id?: string; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn('min-w-0', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <h2 id={id} className="text-sm font-semibold">{tone ? <StatusDot tone={tone} /> : null}{title}{count !== undefined ? <span className="ml-2 font-mono text-xs font-normal tabular-nums text-muted-foreground">{count}</span> : null}</h2>
        {actions}
      </div>
      <div className="pt-3">{children}</div>
    </section>
  );
}

export function Notice({ tone = 'status', children, className }: { tone?: 'status' | 'alert'; children: ReactNode; className?: string }) {
  return <p role={tone} className={cn('rounded-lg px-3 py-2 text-sm', tone === 'alert' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground', className)}>{children}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-4 text-sm text-muted-foreground">{children}</p>;
}

export function Restricted({ children }: { children: ReactNode }) {
  return <p role="status" className="py-2 text-sm text-muted-foreground"><StatusDot tone="off" />{children}</p>;
}

/** Native select styled to match the shadcn Input. */
export const selectClass = 'h-9 w-full min-w-0 rounded-md border bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

export function Tag({ children, tone }: { children: ReactNode; tone?: Tone }) {
  return <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-foreground">{tone ? <StatusDot tone={tone} className="mr-1.5 size-1.5 align-[0.15em]" /> : null}{children}</span>;
}

export function Pager({ page, pages, prev, next, label }: { page: number; pages: number; prev?: string | null; next?: string | null; label: string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label={label} className="flex items-center justify-between gap-3 pt-3">
      <Track>
        {prev ? <PillLink href={prev} size="sm">Previous</PillLink> : <Pill size="sm" disabled>Previous</Pill>}
        {next ? <PillLink href={next} size="sm">Next</PillLink> : <Pill size="sm" disabled>Next</Pill>}
      </Track>
      <span className="font-mono text-xs tabular-nums text-muted-foreground">{page} / {pages}</span>
    </nav>
  );
}

/** Last-refresh time in the shop's timezone (server and browser agree on it). */
export function liveStamp(at: Date, timeZone?: string | null) {
  try { return at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', ...(timeZone ? { timeZone } : {}) }); }
  catch { return at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
}
