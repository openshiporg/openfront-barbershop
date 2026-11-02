'use client';

import { useId, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Pill } from '@/features/platform/lib/ui';
import { candidateDetail, type MergeCandidate } from '../lib/mergeCandidates';

export type { MergeCandidate };

/**
 * "Merge into…": pick the record to keep, review what moves, then confirm. The
 * current customer is the duplicate. The key is minted once per opened dialog so
 * a retried confirm replays instead of merging twice.
 */
export function MergeCustomerButton({ customerName, current, candidates, timeZone, disabled, onConfirm }: {
  customerName: string;
  current: MergeCandidate;
  candidates: MergeCandidate[];
  timeZone: string;
  disabled?: boolean;
  onConfirm: (keepCustomerId: string, idempotencyKey: string) => void;
}) {
  const labelId = useId();
  const listId = useId();
  const [key, setKey] = useState('');
  const [keepId, setKeepId] = useState('');
  const [open, setOpen] = useState(false);
  const keep = candidates.find((candidate) => candidate.id === keepId) || null;
  const everyone = [current, ...candidates];
  return (
    <AlertDialog onOpenChange={(next) => { if (next) { setKey(crypto.randomUUID()); setKeepId(''); setOpen(false); } }}>
      <AlertDialogTrigger asChild>
        <Pill size="sm" disabled={disabled || !candidates.length} title={candidates.length ? undefined : 'Search so both records are listed, then merge.'}>Merge into…</Pill>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Merge {customerName} into another customer</AlertDialogTitle>
          <AlertDialogDescription>
            Appointments, notes, payments, balances and waivers move to the customer you keep. Blank phone or email on that record is filled from this one. This record ({candidateDetail(current, everyone, timeZone) || 'no history'}) is then removed. This can&rsquo;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <span id={labelId} className="text-sm font-medium">Keep</span>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                role="combobox"
                aria-labelledby={labelId}
                aria-expanded={open}
                aria-controls={listId}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[6px] border bg-background px-3 py-1.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {keep
                  ? <span className="min-w-0"><span className="block truncate font-medium">{keep.name}</span><span className="block truncate text-xs text-muted-foreground">{candidateDetail(keep, everyone, timeZone)}</span></span>
                  : <span className="text-muted-foreground">Choose a customer…</span>}
                <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] rounded-[6px] p-1">
              <div id={listId} role="listbox" aria-labelledby={labelId} className="max-h-72 overflow-y-auto">
                {candidates.map((candidate) => {
                  const selected = candidate.id === keepId;
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => { setKeepId(candidate.id); setOpen(false); }}
                      className={cn('flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent', selected && 'bg-accent')}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{candidate.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{candidateDetail(candidate, everyone, timeZone)}</span>
                      </span>
                      <Check aria-hidden="true" className={cn('size-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')} />
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={!keep} onClick={() => keep && onConfirm(keep.id, key || crypto.randomUUID())}>
            {keep ? `Merge into ${keep.name}` : 'Merge'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
