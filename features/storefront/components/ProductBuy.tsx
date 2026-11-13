'use client';

import { useActionState } from 'react';
import { buyProductAction } from '../lib/data/productOrders';

export function ProductBuy({ productId, price }: { productId: string; price: string }) {
  const [state, action, pending] = useActionState(buyProductAction, null);
  return (
    <form action={action} className="sf-form">
      <input type="hidden" name="productId" value={productId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sf-field"><span>Your name</span><input className="sf-input" name="buyerName" required maxLength={120} autoComplete="name" /></label>
        <label className="sf-field"><span>Your email</span><input className="sf-input" name="buyerEmail" type="email" required maxLength={254} autoComplete="email" /></label>
      </div>
      {state?.error ? <p role="alert" className="sf-notice is-error">{state.error}</p> : null}
      <div className="sf-actions">
        <button type="submit" className="sf-btn is-primary" disabled={pending}>{pending ? 'Opening checkout…' : `Buy for ${price}`}</button>
      </div>
      <p className="sf-small sf-muted">Paid securely with Stripe. Pick it up on your next visit.</p>
    </form>
  );
}
