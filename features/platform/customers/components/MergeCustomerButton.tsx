'use client';

import { useId, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Pill, selectClass } from '@/features/platform/lib/ui';

export type MergeCandidate = { id: string; name: string; contact: string };

/**
 * "Merge into…": pick the record to keep, review what moves, then confirm. The
 * current customer is the duplicate. The key is minted once per opened dialog so
 * a retried confirm replays instead of merging twice.
 */
export function MergeCustomerButton({ customerName, candidates, disabled, onConfirm }: {
  customerName: string;
  candidates: MergeCandidate[];
  disabled?: boolean;
  onConfirm: (keepCustomerId: string, idempotencyKey: string) => void;
}) {
  const selectId = useId();
  const [key, setKey] = useState('');
  const [keepId, setKeepId] = useState('');
  const keep = candidates.find((candidate) => candidate.id === keepId) || null;
  return (
    <AlertDialog onOpenChange={(open) => { if (open) { setKey(crypto.randomUUID()); setKeepId(''); } }}>
      <AlertDialogTrigger asChild>
        <Pill size="sm" disabled={disabled || !candidates.length} title={candidates.length ? undefined : 'Search so both records are listed, then merge.'}>Merge into…</Pill>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Merge {customerName} into another customer</AlertDialogTitle>
          <AlertDialogDescription>
            Appointments, notes, payments, balances and waivers move to the customer you keep. Blank phone or email on that record is filled from this one. {customerName}&rsquo;s record is then removed. This can&rsquo;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor={selectId}>Keep</Label>
          <select id={selectId} value={keepId} onChange={(event) => setKeepId(event.target.value)} className={selectClass}>
            <option value="">Choose a customer…</option>
            {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}{candidate.contact ? ` · ${candidate.contact}` : ''}</option>)}
          </select>
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
