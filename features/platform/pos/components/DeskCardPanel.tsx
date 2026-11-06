'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, CreditCard, ExternalLink, RotateCw, X } from 'lucide-react';
import { Notice, Pill, pillClass, Track } from '@/features/platform/lib/ui';
import { cancelDeskCardAction, checkDeskCardAction, openDeskCardAction, startDeskCardAction, type DeskCard } from '../actions/checkout';

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

/**
 * Charge card (Square/Booksy style): the POS prices the ticket, Stripe hosts the card form on this screen or
 * on the client's phone, and checkout records itself against the captured payment once Stripe confirms.
 */
export function DeskCardPanel({ appointmentId, ticket, disabled, onPaid }: {
  appointmentId: string;
  ticket: { tipAmount: number; discountAmount: number; taxAmount: number; notes: string } | null;
  disabled: boolean;
  onPaid: (text: string) => void;
}) {
  const router = useRouter();
  const [card, setCard] = useState<DeskCard | null>(null);
  const [busy, setBusy] = useState<'start' | 'check' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // A card page opened before a refresh comes back.
  useEffect(() => {
    let live = true;
    openDeskCardAction(appointmentId).then((result) => { if (live && result.success && result.data) setCard(result.data); });
    return () => { live = false; };
  }, [appointmentId]);

  const settle = (next: DeskCard) => {
    setCard(next);
    if (next.recorded) { onPaid(`Paid ${usd(next.amount)} by card through Stripe.${next.transactionId ? ` Receipt ${next.transactionId}.` : ''}`); router.refresh(); }
  };

  const waiting = card?.status === 'pending' ? card.sessionId : null;
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(async () => {
      const next = await checkDeskCardAction(waiting);
      if (next.data && (next.data.status !== 'pending' || next.data.recorded)) { settle(next.data); if (!next.success) setError(next.error); }
    }, 4000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting]);

  async function start() {
    if (!ticket) return;
    setBusy('start'); setError(null);
    const next = await startDeskCardAction({ appointmentId, ...ticket });
    setBusy(null);
    if (!next.success || !next.data) { setError(next.error || 'Card payment was not opened.'); return; }
    setCard(next.data);
    if (next.data.url) window.open(next.data.url, '_blank', 'noopener');
  }
  async function check() {
    if (!card) return;
    setBusy('check'); setError(null);
    const next = await checkDeskCardAction(card.sessionId);
    setBusy(null);
    if (!next.success || next.error) setError(next.error);
    if (next.data) settle(next.data);
  }
  async function cancel() {
    if (!card) return;
    setBusy('cancel'); setError(null);
    const next = await cancelDeskCardAction(card.sessionId);
    setBusy(null);
    if (!next.success) { setError(next.error); return; }
    setCard(null);
  }
  async function copy() {
    if (!card?.url) return;
    await navigator.clipboard.writeText(card.url).catch(() => undefined);
    setCopied(true); window.setTimeout(() => setCopied(false), 2000);
  }

  if (card?.recorded) return null;
  const idle = !card || ['cancelled', 'expired', 'refunded'].includes(card.status);

  return (
    <div className="grid gap-2">
      {idle ? (
        <>
          <Track block>
            <Pill variant="primary" className="h-11 text-base" onClick={start} disabled={busy !== null || disabled || !ticket}>
              <CreditCard />{busy === 'start' ? 'Opening card payment…' : 'Charge card'}
            </Pill>
          </Track>
          <p className="text-xs text-muted-foreground">Stripe card form for the balance, tip and tax above. The client pays on this screen or on their phone.</p>
        </>
      ) : card.status === 'pending' ? (
        <div className="grid gap-2 rounded-[6px] border p-3">
          <p className="text-sm font-medium">Waiting for card · {usd(card.amount)}</p>
          <p className="text-xs text-muted-foreground">Checkout completes itself as soon as Stripe confirms the payment.</p>
          <Track wrap>
            {card.url ? <a href={card.url} target="_blank" rel="noopener noreferrer" className={pillClass('primary', 'sm')}><ExternalLink />Open card form</a> : null}
            {card.url ? <Pill size="sm" onClick={copy}><Copy />{copied ? 'Link copied' : 'Copy pay link'}</Pill> : null}
            <Pill size="sm" onClick={check} disabled={busy !== null}><RotateCw />{busy === 'check' ? 'Checking…' : 'Check payment'}</Pill>
            <Pill size="sm" variant="flat" onClick={cancel} disabled={busy !== null}><X />{busy === 'cancel' ? 'Cancelling…' : 'Cancel'}</Pill>
          </Track>
        </div>
      ) : card.status === 'captured' ? (
        <div className="grid gap-2 rounded-[6px] border border-amber-300 p-3">
          <Notice tone="alert">Card paid {usd(card.amount)} but checkout isn&apos;t recorded yet.</Notice>
          <Track wrap>
            <Pill size="sm" variant="primary" onClick={check} disabled={busy !== null}><RotateCw />{busy === 'check' ? 'Recording…' : 'Record card payment'}</Pill>
            <Pill size="sm" variant="danger" onClick={cancel} disabled={busy !== null}>{busy === 'cancel' ? 'Refunding…' : 'Refund card'}</Pill>
          </Track>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
