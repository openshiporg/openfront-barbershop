'use client';

import { useActionState, useState } from 'react';
import { buyGiftCardAction } from '../lib/data/giftCards';

const usd = (cents: number) => `$${cents / 100}`;

export function GiftCardBuy({ amounts }: { amounts: number[] }) {
  const [amount, setAmount] = useState(amounts[1] ?? amounts[0]);
  const [forSomeone, setForSomeone] = useState(true);
  const [state, action, pending] = useActionState(buyGiftCardAction, null);
  return (
    <form action={action} className="sf-form">
      <fieldset className="grid gap-2">
        <legend className="sf-field mb-2"><span>Amount</span></legend>
        <div className="sf-slot-row" role="group" aria-label="Gift card amount">
          {amounts.map((value) => (
            <button key={value} type="button" className="sf-slot" aria-pressed={value === amount} onClick={() => setAmount(value)}>{usd(value)}</button>
          ))}
        </div>
        <input type="hidden" name="amount" value={amount} />
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sf-field"><span>Your name</span><input className="sf-input" name="purchaserName" required maxLength={120} autoComplete="name" /></label>
        <label className="sf-field"><span>Your email</span><input className="sf-input" name="purchaserEmail" type="email" required maxLength={254} autoComplete="email" /></label>
      </div>
      <div className="sf-actions" role="group" aria-label="Who is it for">
        <button type="button" className="sf-btn is-flat" aria-pressed={forSomeone} onClick={() => setForSomeone(true)}>Send to someone</button>
        <button type="button" className="sf-btn is-flat" aria-pressed={!forSomeone} onClick={() => setForSomeone(false)}>Keep it myself</button>
      </div>
      {forSomeone ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sf-field"><span>Their name</span><input className="sf-input" name="recipientName" required maxLength={120} /></label>
            <label className="sf-field"><span>Their email</span><input className="sf-input" name="recipientEmail" type="email" required maxLength={254} /></label>
          </div>
          <label className="sf-field"><span>Message (optional)</span><textarea className="sf-textarea" name="message" maxLength={500} rows={3} /></label>
        </>
      ) : null}
      {state?.error ? <p role="alert" className="sf-notice is-error">{state.error}</p> : null}
      <div className="sf-actions">
        <button type="submit" className="sf-btn is-primary" disabled={pending}>{pending ? 'Opening checkout…' : `Buy ${usd(amount)} gift card`}</button>
      </div>
      <p className="sf-small sf-muted">Paid securely with Stripe. The code appears on the next page as soon as payment clears; share it {forSomeone ? 'with them' : 'when you use it'}. It works at checkout for a year.</p>
    </form>
  );
}
