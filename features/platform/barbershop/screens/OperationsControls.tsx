'use client';

import { useId, useState, useTransition } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCommandKey } from '../../lib/useCommandKey';
import { Pill, Track } from '../../lib/ui';
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
  return <div className="mt-2 flex flex-wrap items-center gap-2">
    {commission.status === 'approved' && <>
      <Label htmlFor={`${id}-reference`} className="sr-only">Payout reference for {commission.commissionNumber || 'this commission'}</Label>
      <Input id={`${id}-reference`} value={payoutReference} onChange={(event) => setPayoutReference(event.target.value)} placeholder="Payout reference" className="rounded-[6px] h-8 min-w-36 flex-1 text-xs" />
    </>}
    {['projected', 'approved'].includes(commission.status) && <Track>
      {commission.status === 'projected' && <Pill size="sm" variant="primary" disabled={pending} onClick={() => run('approve', { status: 'approved' }, (key) => transitionCommissionAction(commission.id, 'approved', key), 'Commission approved.')}>Approve</Pill>}
      {commission.status === 'approved' && <Pill size="sm" variant="primary" disabled={pending || !payoutReference.trim()} onClick={() => run('pay', { reference: payoutReference.trim() }, (key) => payCommissionAction(commission.id, payoutReference, key), 'Payout recorded. No transfer was made.')}>Record paid</Pill>}
      <Pill size="sm" disabled={pending} onClick={() => run('void', { status: 'voided' }, (key) => transitionCommissionAction(commission.id, 'voided', key), 'Commission voided.')}>Void</Pill>
    </Track>}
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
  return <div>
    <ul>
      {sessions.map((session) => <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2.5 last:border-b-0">
        <div className="min-w-0 text-sm"><p className="font-medium">{session.paymentProvider?.name || 'Payment provider'}</p><p className="text-xs text-muted-foreground">{session.status} · <span className="font-mono tabular-nums">{(session.amount / 100).toLocaleString('en-US', { style: 'currency', currency: session.currencyCode || 'USD' })}</span></p></div>
        <Track><Pill size="sm" disabled={pending} onClick={() => reconcile(session)}>{pendingId === session.id ? 'Checking…' : 'Check status'}</Pill></Track>
      </li>)}
    </ul>
    <Feedback outcome={outcome} />
  </div>;
}
