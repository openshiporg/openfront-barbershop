'use client';

import { useId, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCommandKey } from '../../lib/useCommandKey';
import { payCommissionAction, reconcilePaymentAction, transitionCommissionAction } from '../actions/operations';

type Commission = { id: string; status: string; commissionNumber?: string };
type PaymentSession = { id: string; status: string; amount: number; currencyCode: string; paymentProvider?: { name?: string | null } | null };
type Outcome = { kind: 'status' | 'error'; text: string } | null;

const interrupted = 'Connection interrupted. The action may have completed. Retry to confirm; the same request will not be applied twice.';

function Feedback({ outcome }: { outcome: Outcome }) {
  return <>
    <span role="status" aria-live="polite" className="text-xs text-muted-foreground">{outcome?.kind === 'status' ? outcome.text : ''}</span>
    {outcome?.kind === 'error' && <span role="alert" className="text-xs text-destructive">{outcome.text}</span>}
  </>;
}

export function CommissionControls({ commission }: { commission: Commission }) {
  const id = useId();
  const { keyFor, settle } = useCommandKey(`commission:${commission.id}`);
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [payoutReference, setPayoutReference] = useState('');
  const run = (target: string, body: unknown, operation: (key: string) => Promise<{ success: boolean; error?: string | null }>, success: string) => {
    const key = keyFor(body, target);
    setOutcome(null);
    startTransition(async () => {
      try {
        const result = await operation(key);
        if (result.success) { settle(target); setOutcome({ kind: 'status', text: success }); }
        else setOutcome({ kind: 'error', text: result.error || 'Unable to update.' });
      } catch {
        setOutcome({ kind: 'error', text: interrupted });
      }
    });
  };
  return <div className="mt-2 flex flex-wrap items-center gap-1">
    {commission.status === 'projected' && <Button size="sm" variant="outline" disabled={pending} onClick={() => run('approve', { status: 'approved' }, (key) => transitionCommissionAction(commission.id, 'approved', key), 'Commission approved.')}>Approve</Button>}
    {commission.status === 'approved' && <>
      <Label htmlFor={`${id}-reference`} className="sr-only">Payout reference for {commission.commissionNumber || 'this commission'}</Label>
      <Input id={`${id}-reference`} value={payoutReference} onChange={(event) => setPayoutReference(event.target.value)} placeholder="Cash or payroll reference" className="h-8 min-w-40 text-xs" />
      <Button size="sm" disabled={pending || !payoutReference.trim()} onClick={() => run('pay', { reference: payoutReference.trim() }, (key) => payCommissionAction(commission.id, payoutReference, key), 'Payout recorded. This records your own cash or payroll payment; no transfer was made.')}>Record paid</Button>
    </>}
    {['projected', 'approved'].includes(commission.status) && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run('void', { status: 'voided' }, (key) => transitionCommissionAction(commission.id, 'voided', key), 'Commission voided.')}>Void</Button>}
    <Feedback outcome={outcome} />
  </div>;
}

export function ReconciliationControls({ sessions }: { sessions: PaymentSession[] }) {
  const { keyFor, settle } = useCommandKey('reconcile');
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const reconcile = (session: PaymentSession) => {
    const key = keyFor({ session: session.id }, session.id);
    setOutcome(null);
    setPendingId(session.id);
    startTransition(async () => {
      try {
        const result = await reconcilePaymentAction(session.id, key);
        if (result.success) { settle(session.id); setOutcome({ kind: 'status', text: 'Provider status checked and recorded.' }); }
        else setOutcome({ kind: 'error', text: result.error || 'Unable to reconcile.' });
      } catch {
        setOutcome({ kind: 'error', text: interrupted });
      } finally {
        setPendingId(null);
      }
    });
  };
  return <div className="space-y-2">
    {sessions.map((session) => <div key={session.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div><strong>{session.paymentProvider?.name || 'Payment provider'}</strong><p className="text-xs text-muted-foreground">{session.status} · {(session.amount / 100).toLocaleString('en-US', { style: 'currency', currency: session.currencyCode || 'USD' })}</p></div>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => reconcile(session)}>{pendingId === session.id ? 'Checking…' : 'Check provider status'}</Button>
    </div>)}
    <Feedback outcome={outcome} />
  </div>;
}
