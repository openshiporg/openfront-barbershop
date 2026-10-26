'use client';

import { useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { pillClass } from '@/features/platform/lib/ui';
import type { ActionResult } from '@/features/platform/lib/forms';

/*
 * Local row-action and choice primitives for the barbershop operator screens.
 * The shared kit (features/platform/lib) is fixed; these extend it without
 * reshaping it: a single "more" menu per row (destructive last, separated and
 * quiet), a square segmented radio group, and a ruled checkbox list.
 */

export type RowMenuItem = { label: string; run?: () => Promise<ActionResult>; href?: string; danger?: boolean; disabled?: boolean };

/** One row action menu. Items run a server action and refresh on success. */
export function RowMenu({ label, items, title }: { label: string; items: RowMenuItem[]; title?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!items.length) return null;
  const safe = items.filter((item) => !item.danger);
  const danger = items.filter((item) => item.danger);
  const run = (item: RowMenuItem) => {
    if (!item.run) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await item.run!();
        if (!result.success) setError(result.error || 'This couldn’t be changed.');
        else router.refresh();
      } catch { setError('Connection interrupted. Reload to check whether it changed.'); }
    });
  };
  const entry = (item: RowMenuItem) => item.href
    ? <DropdownMenuItem key={item.label} asChild className="rounded-[4px]"><Link href={item.href}>{item.label}</Link></DropdownMenuItem>
    : <DropdownMenuItem key={item.label} disabled={item.disabled || pending} variant={item.danger ? 'destructive' : 'default'} className="rounded-[4px]" onSelect={() => run(item)}>{item.label}</DropdownMenuItem>;
  return (
    <span className="inline-grid justify-items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(pillClass('flat', 'sm'), 'size-9 px-0 data-[state=open]:bg-muted data-[state=open]:text-foreground')} aria-label={label} disabled={pending}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44 rounded-[6px]">
          {title ? <DropdownMenuLabel className="truncate text-xs font-medium text-muted-foreground">{title}</DropdownMenuLabel> : null}
          {safe.map(entry)}
          {danger.length && safe.length ? <DropdownMenuSeparator /> : null}
          {danger.map(entry)}
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? <span role="alert" className="max-w-56 text-right text-xs text-destructive">{error}</span> : null}
    </span>
  );
}

/** Status changes for a row, offered as menu items (every state other than the current one). */
export function statusItems(current: string, options: Array<{ value: string; label: string; danger?: boolean }>, run: (value: string) => Promise<ActionResult>): RowMenuItem[] {
  return options.filter((option) => option.value !== current).map((option) => ({ label: option.label, danger: option.danger, run: () => run(option.value) }));
}

/** Square segmented radio group (never a pill track). */
export function Segmented<T extends string>({ label, value, options, onChange, disabled, className }: { label: string; value: T; options: Array<{ value: T; label: ReactNode }>; onChange: (value: T) => void; disabled?: boolean; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex max-w-full flex-wrap overflow-hidden rounded-[6px] border', className)}>
      {options.map((option, index) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
              event.preventDefault();
              const next = options[(index + (event.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length];
              onChange(next.value);
              const sibling = (event.currentTarget.parentElement?.children[options.indexOf(next)] as HTMLElement | undefined);
              sibling?.focus();
            }}
            tabIndex={on ? 0 : -1}
            className={cn(
              'inline-flex h-9 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap px-3 text-sm font-medium transition-colors duration-150 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
              index > 0 && 'border-l',
              on ? 'bg-foreground text-background' : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Ruled multi-select checkbox list; submits nothing itself (callers mirror state into hidden inputs). */
export function CheckList({ label, options, value, onChange, empty }: { label: string; options: Array<{ id: string; name: string }>; value: string[]; onChange: (next: string[]) => void; empty?: string }) {
  if (!options.length) return null;
  return (
    <fieldset className="grid min-w-0 gap-1.5 sm:col-span-2">
      <legend className="flex w-full items-baseline justify-between gap-2 pb-1.5 text-sm font-medium">{label}<span className="text-xs font-normal tabular-nums text-muted-foreground">{value.length ? `${value.length} selected` : empty || 'None selected'}</span></legend>
      <div className="grid max-h-64 overflow-y-auto rounded-[6px] border sm:grid-cols-2">
        {options.map((option) => {
          const on = value.includes(option.id);
          return (
            <label key={option.id} className="flex min-h-10 cursor-pointer items-center gap-2.5 border-b px-3 text-sm hover:bg-muted/50 sm:odd:border-r">
              <input type="checkbox" checked={on} onChange={() => onChange(on ? value.filter((id) => id !== option.id) : [...value, option.id])} className="size-4 shrink-0 accent-foreground" />
              <span className="min-w-0 truncate">{option.name}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
