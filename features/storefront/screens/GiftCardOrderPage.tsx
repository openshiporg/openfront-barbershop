import Link from 'next/link';
import { confirmGiftCardOrder } from '../lib/data/giftCards';
import { StorefrontShell } from './StorefrontShell';

const usd = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

/** Stripe returns here; the order is read back from Stripe before the code is shown. */
export default async function GiftCardOrderPage({ searchParams }: { searchParams?: Promise<{ id?: string; token?: string; result?: string }> }) {
  const params = (await searchParams) || {};
  const { order, error } = params.id && params.token ? await confirmGiftCardOrder(params.id, params.token) : { order: null, error: 'We couldn’t find that gift card order.' };
  const cancelled = params.result === 'cancelled' && order?.status !== 'active';
  const heading = !order ? 'Order not found' : order.status === 'active' || order.status === 'redeemed' ? 'Gift card ready' : cancelled || order.status === 'cancelled' ? 'No charge made' : 'Confirming payment';
  return (
    <StorefrontShell allowUnavailableChildren>
      <main id="main-content" className="sf-container-narrow py-[var(--space-3xl)]">
        <h1 className="sf-display sf-h1">{heading}</h1>
        {!order ? <p className="sf-lead mt-3">{error}</p>
          : order.code ? (
            <div className="mt-6 grid gap-4">
              <p className="sf-lead">{usd(order.amount)} gift card{order.recipientName ? ` for ${order.recipientName}` : ''}. {order.recipientEmail ? `We emailed the code to ${order.recipientEmail}.` : ''}</p>
              <div className="sf-card">
                <span className="sf-small sf-muted">Code</span>
                <p className="sf-title tabular-nums" style={{ letterSpacing: '0.08em' }}>{order.code}</p>
                {order.expiresAt ? <p className="sf-small sf-muted">Valid until {new Date(order.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Show it at checkout.</p> : null}
              </div>
            </div>
          ) : cancelled || order.status === 'cancelled'
            ? <p className="sf-lead mt-3">Checkout was cancelled, so your card wasn’t charged.</p>
            : <p className="sf-lead mt-3">Stripe is still confirming your payment. Refresh this page in a moment. We’ll email the code once it clears.</p>}
        <div className="sf-actions mt-8">
          {order && !order.code ? <Link href="/gift-cards" className="sf-btn">Gift cards</Link> : null}
          <Link href="/book" className="sf-btn is-primary">Book a time</Link>
        </div>
      </main>
    </StorefrontShell>
  );
}
