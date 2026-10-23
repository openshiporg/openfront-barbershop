'use client';

import { shopWallTime } from '../../shared/shop-time';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { managePublicAppointment, signPublicWaiver, type AppointmentChangeOutcome } from '../lib/data/public-appointments';
import { formatMoney } from '../lib/format';

/**
 * One request key per intent: retrying the same change (for example after a lost
 * response) reuses it, so the shop records it once. Different details get a new key.
 */
function useIntentKey() {
  const current = useRef<{ signature: string; key: string } | null>(null);
  return {
    keyFor(signature: string) {
      if (current.current?.signature !== signature) current.current = { signature, key: crypto.randomUUID() };
      return current.current.key;
    },
    reset() { current.current = null; },
  };
}

function depositMessage(consequence: AppointmentChangeOutcome['depositConsequence']) {
  if (consequence === 'refund_required') return 'Your deposit is due back under the shop’s policy. The shop will process the refund.';
  if (consequence === 'forfeiture_pending') return 'Under the shop’s policy your deposit may be kept. The shop will confirm.';
  if (consequence === 'manual_review') return 'The shop will review what happens to your deposit.';
  return null;
}

function feeMessage(feeAmount: number, preview: boolean) {
  if (!feeAmount) return preview ? 'No change fee applies.' : null;
  return preview ? `A late change fee of ${formatMoney(feeAmount)} applies. The shop collects it.` : `A late change fee of ${formatMoney(feeAmount)} applies. The shop will collect it.`;
}

export function AppointmentWaiver(props: {
  appointmentId: string;
  customerName: string;
  waiverSigned: boolean;
  waiverTemplateKey?: string | null;
  waiverTemplateVersion?: string | null;
  waiverTemplateText?: string | null;
}) {
  const router = useRouter();
  const intent = useIntentKey();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [signerName, setSignerName] = useState(props.customerName);
  const [signerRole, setSignerRole] = useState<'customer' | 'guardian'>('customer');
  const [guardianName, setGuardianName] = useState('');
  const [affirmation, setAffirmation] = useState(false);

  if (props.waiverSigned) return <section className="sf-block"><p className="sf-eyebrow"><span className="sf-dot is-live" aria-hidden="true" />Waiver signed</p></section>;

  async function sign() {
    setPending(true); setMessage('');
    const idempotencyKey = intent.keyFor(JSON.stringify({ signerName, signerRole, guardianName }));
    try {
      const result = await signPublicWaiver({ appointmentId: props.appointmentId, signerName, signerRole, guardianName, affirmation, idempotencyKey });
      setMessage(result.success ? 'Waiver signed.' : result.error || 'The waiver couldn’t be signed.');
      if (result.success) router.refresh();
    } catch { setMessage('We couldn’t confirm whether your signature was saved. Try again; it will only be recorded once.'); }
    finally { setPending(false); }
  }

  return (
    <section className="sf-block" aria-labelledby="waiver-heading">
      <h2 className="sf-eyebrow"><span className="sf-dot is-wait" aria-hidden="true" />Waiver required</h2>
      <h3 id="waiver-heading" className="font-semibold break-words">{props.waiverTemplateKey} · version {props.waiverTemplateVersion}</h3>
      <div className="max-h-48 overflow-auto whitespace-pre-wrap rounded-[var(--radius-sm)] bg-[var(--color-paper-2)] p-3 sf-small" tabIndex={0} aria-label="Waiver text">{props.waiverTemplateText}</div>
      <label className="sf-field"><span>Your full name</span><input className="sf-input" autoComplete="name" maxLength={160} value={signerName} onChange={(event) => setSignerName(event.target.value)} /></label>
      <div className="sf-track is-block" role="radiogroup" aria-label="Signing as">
        <button type="button" role="radio" aria-checked={signerRole === 'customer'} className="sf-pill is-flat" onClick={() => setSignerRole('customer')}>Customer</button>
        <button type="button" role="radio" aria-checked={signerRole === 'guardian'} className="sf-pill is-flat" onClick={() => setSignerRole('guardian')}>Parent or guardian</button>
      </div>
      {signerRole === 'guardian' && <label className="sf-field"><span>Guardian’s full name</span><input className="sf-input" maxLength={160} value={guardianName} onChange={(event) => setGuardianName(event.target.value)} /></label>}
      <label className="sf-check"><input type="checkbox" checked={affirmation} onChange={(event) => setAffirmation(event.target.checked)} />I have read this waiver and agree to it as the customer or their parent or guardian.</label>
      <div className="sf-track"><button type="button" className="sf-pill is-primary" disabled={pending || !affirmation} onClick={sign}>{pending ? 'Signing…' : 'Sign waiver'}</button></div>
      {message && <p role="status" className="sf-notice">{message}</p>}
    </section>
  );
}

export function AppointmentSelfService(props: { timeZone: string; appointmentId: string }) {
  const router = useRouter();
  const intent = useIntentKey();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [reason, setReason] = useState('');
  const [review, setReview] = useState<(AppointmentChangeOutcome & { action: 'cancel' | 'reschedule' }) | null>(null);

  function request(action: 'cancel' | 'reschedule') {
    let nextStartsAt: string | undefined;
    if (action === 'reschedule') {
      nextStartsAt = shopWallTime(startsAt.slice(0, 10), Number(startsAt.slice(11, 13)) * 60 + Number(startsAt.slice(14, 16)), props.timeZone).toISOString();
    }
    return { appointmentId: props.appointmentId, action, startsAt: nextStartsAt, reason: reason.trim(), idempotencyKey: intent.keyFor(JSON.stringify({ action, nextStartsAt, reason: reason.trim() })) };
  }

  // Step 1: show the exact fee and deposit outcome before anything changes.
  async function startReview(action: 'cancel' | 'reschedule') {
    setPending(true); setMessage(''); setReview(null);
    try {
      const result = await managePublicAppointment({ ...request(action), preview: true });
      if (result.success && result.data) setReview({ ...result.data, action });
      else setMessage(result.error || 'This change can’t be made online. Contact the shop.');
    } catch (error) { setMessage(error instanceof Error && error.message.includes('does not exist') ? error.message : 'This change couldn’t be checked. Try again.'); }
    finally { setPending(false); }
  }

  // Step 2: confirm with the fee the customer reviewed; a different fee is refused.
  async function confirm() {
    if (!review) return;
    setPending(true); setMessage('');
    try {
      const result = await managePublicAppointment({ ...request(review.action), acceptedFeeAmount: review.feeAmount });
      if (result.success && result.data) {
        const outcome = result.data;
        setMessage([review.action === 'cancel' ? 'Appointment cancelled.' : 'Appointment rescheduled.', feeMessage(outcome.feeAmount, false), depositMessage(outcome.depositConsequence)].filter(Boolean).join(' '));
        setReview(null);
        intent.reset();
        router.refresh();
      } else {
        setReview(null);
        setMessage(result.error || 'The appointment couldn’t be changed.');
      }
    } catch { setMessage('We couldn’t confirm whether your change went through. Reload this page to check before trying again.'); }
    finally { setPending(false); }
  }

  return (
    <section className="sf-block" aria-labelledby="change-heading">
      <h2 id="change-heading" className="sf-eyebrow">Change this visit</h2>
      <label className="sf-field"><span>New time ({props.timeZone})</span><input className="sf-input sf-mono" type="datetime-local" value={startsAt} onChange={(event) => { setStartsAt(event.target.value); setReview(null); }} /></label>
      <label className="sf-field"><span>Reason (required)</span><input className="sf-input" value={reason} required minLength={2} maxLength={1000} onChange={(event) => { setReason(event.target.value); setReview(null); }} /></label>
      {!review ? (
        <div className="sf-track">
          <button type="button" className="sf-pill is-primary" disabled={pending || !startsAt || reason.trim().length < 2} onClick={() => startReview('reschedule')}>Review new time</button>
          <button type="button" className="sf-pill is-danger" disabled={pending || reason.trim().length < 2} onClick={() => startReview('cancel')}>Review cancellation</button>
        </div>
      ) : (
        <div className="sf-card-dark sf-on-dark" role="status">
          <p className="sf-subtitle">{review.action === 'cancel' ? 'Cancel this appointment?' : 'Move this appointment?'}</p>
          <dl className="sf-ledger">
            <div><dt>Change fee</dt><dd className="sf-mono">{review.feeAmount ? formatMoney(review.feeAmount) : 'None'}</dd></div>
            {depositMessage(review.depositConsequence) ? <div><dt>Deposit</dt><dd>{depositMessage(review.depositConsequence)}</dd></div> : null}
            {review.policyName ? <div><dt>Policy</dt><dd>{review.policyName}{review.policyVersion ? ` · v${review.policyVersion}` : ''}</dd></div> : null}
          </dl>
          <div className="sf-track">
            <button type="button" className="sf-pill is-primary" disabled={pending} onClick={confirm}>{review.action === 'cancel' ? 'Confirm cancellation' : 'Confirm new time'}</button>
            <button type="button" className="sf-pill" disabled={pending} onClick={() => setReview(null)}>Go back</button>
          </div>
        </div>
      )}
      {message && <p role="status" className="sf-notice">{message}</p>}
    </section>
  );
}
