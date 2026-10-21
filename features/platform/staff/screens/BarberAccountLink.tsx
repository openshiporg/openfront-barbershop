'use client';

import { useId, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useCommandKey } from '../../lib/useCommandKey';
import { linkBarberAccountAction } from '../actions/workforce';

type Member = { id: string; name: string; email: string | null };

/** Links a barber profile to an active shop member's sign-in account (owner/manager only). */
export function BarberAccountLink({ barberId, linkedUserId, members }: { barberId: string; linkedUserId: string | null; members: Member[] }) {
  const id = useId();
  const { keyFor, settle } = useCommandKey(`barber-account:${barberId}`);
  const [userId, setUserId] = useState(linkedUserId || '');
  const [outcome, setOutcome] = useState<{ kind: 'status' | 'error'; text: string } | null>(null);
  const [pending, start] = useTransition();
  const changed = (userId || null) !== (linkedUserId || null);

  const save = () => {
    const target = userId || null;
    const key = keyFor({ userId: target });
    setOutcome(null);
    start(async () => {
      try {
        const result = await linkBarberAccountAction(barberId, target, key);
        if (result.success) { settle(); setOutcome({ kind: 'status', text: target ? 'Account linked.' : 'Account unlinked.' }); }
        else setOutcome({ kind: 'error', text: result.error || 'Unable to update the linked account.' });
      } catch {
        setOutcome({ kind: 'error', text: 'Connection interrupted. The change may have been saved. Retry to confirm.' });
      }
    });
  };

  return (
    <div className="mt-3 grid gap-1">
      <Label htmlFor={`${id}-account`} className="text-xs text-muted-foreground">Sign-in account</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select id={`${id}-account`} value={userId} onChange={(event) => setUserId(event.target.value)} disabled={pending} className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm">
          <option value="">Not linked</option>
          {members.map((member) => <option key={member.id} value={member.id}>{member.name}{member.email && member.email !== member.name ? ` · ${member.email}` : ''}</option>)}
        </select>
        <Button size="sm" variant="outline" disabled={pending || !changed} onClick={save}>{pending ? 'Saving…' : 'Save account'}</Button>
      </div>
      <p className="text-xs text-muted-foreground">Only active shop members are listed. Invite someone to the shop before linking them.</p>
      <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{outcome?.kind === 'status' ? outcome.text : ''}</p>
      {outcome?.kind === 'error' && <p role="alert" className="text-xs text-destructive">{outcome.text}</p>}
    </div>
  );
}
