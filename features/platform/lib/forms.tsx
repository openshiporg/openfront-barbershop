'use client';

import { useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { Notice, Pill, StatusDot, Track, type Tone } from './ui';

/*
 * Platform form kit: a right-hand drawer for create/edit, labelled fields, and
 * a pill row for explicit state transitions. Every save refreshes the page's
 * server data on success and shows the server's refusal otherwise.
 */

export type ActionResult = { success: boolean; error?: string | null };

export function Field({ id, label, children, wide = false, hint }: { id: string; label: string; children: ReactNode; wide?: boolean; hint?: string }) {
  return (
    <div className={cn('grid min-w-0 gap-1.5', wide && 'sm:col-span-2')}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

/** Submits FormData to a server action and refreshes on success. */
export function useFormAction(action: (form: FormData) => Promise<ActionResult>, onDone?: () => void) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const result = await action(form);
        if (!result.success) { setError(result.error || 'This couldn’t be saved.'); return; }
        onDone?.();
        router.refresh();
      } catch { setError('Connection interrupted. Reload to check whether it saved.'); }
    });
  };
  return { submit, pending, error };
}

export function DrawerForm({ trigger, title, description, action, children, submitLabel = 'Save', triggerVariant = 'raised' }: {
  trigger: ReactNode; title: string; description?: string; action: (form: FormData) => Promise<ActionResult>; children: ReactNode; submitLabel?: string; triggerVariant?: 'raised' | 'primary' | 'flat';
}) {
  const [open, setOpen] = useState(false);
  const { submit, pending, error } = useFormAction(action, () => setOpen(false));
  return (
    <>
      <Pill size="sm" variant={triggerVariant} onClick={() => setOpen(true)}>{trigger}</Pill>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
          <form onSubmit={submit} className="grid gap-4 px-4 pb-6 sm:grid-cols-2">
            {children}
            {error ? <Notice tone="alert" className="sm:col-span-2">{error}</Notice> : null}
            <Track className="sm:col-span-2">
              <Pill onClick={() => setOpen(false)}>Cancel</Pill>
              <Pill type="submit" variant="primary" disabled={pending}>{pending ? 'Saving…' : submitLabel}</Pill>
            </Track>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Explicit state transitions: one pill per allowed next state. */
export function TransitionPills({ current, options, run, label }: { current: string; options: Array<{ value: string; label: string; danger?: boolean }>; run: (value: string) => Promise<ActionResult>; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next = options.filter((option) => option.value !== current);
  if (!next.length) return null;
  return (
    <span className="inline-grid gap-1">
      <Track label={label}>
        {next.map((option) => (
          <Pill key={option.value} size="sm" variant={option.danger ? 'danger' : 'raised'} disabled={pending} onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await run(option.value);
              if (!result.success) setError(result.error || 'This couldn’t be changed.');
              else router.refresh();
            });
          }}>{option.label}</Pill>
        ))}
      </Track>
      {error ? <span role="alert" className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}

export function StatusTabs({ tabs, current, hrefFor }: { tabs: Array<{ value: string; label: string; count?: number; tone?: Tone }>; current: string; hrefFor: (value: string) => string }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <nav aria-label="Status" className="inline-flex w-max gap-1 rounded-full bg-muted p-1 shadow-[inset_0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-inset ring-black/5 dark:bg-zinc-900">
        {tabs.map((tab) => {
          const active = tab.value === current;
          return (
            <a key={tab.value || 'all'} href={hrefFor(tab.value)} aria-current={active ? 'page' : undefined} className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium', active ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:bg-zinc-800' : 'text-muted-foreground hover:text-foreground')}>
              {tab.tone ? <StatusDot tone={tab.tone} className="mr-0" /> : null}{tab.label}{tab.count !== undefined ? <span className="font-mono tabular-nums">{tab.count}</span> : null}
            </a>
          );
        })}
      </nav>
    </div>
  );
}

export const inputMoney = { type: 'number', inputMode: 'decimal' as const, min: 0, step: '0.01', className: 'font-mono' };
export const toDollars = (cents?: number | null) => ((cents ?? 0) / 100).toFixed(2);
