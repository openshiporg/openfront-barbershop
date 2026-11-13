import Link from 'next/link';
import { confirmProductOrder } from '../lib/data/productOrders';
import { formatMoney } from '../lib/format';
import { StorefrontShell } from './StorefrontShell';

/** Stripe returns here; the order is read back from Stripe before it is shown as paid. */
export default async function ProductOrderPage({ searchParams }: { searchParams?: Promise<{ id?: string; token?: string; result?: string }> }) {
  const params = (await searchParams) || {};
  const { order, error } = params.id && params.token ? await confirmProductOrder(params.id, params.token) : { order: null, error: 'We couldn’t find that order.' };
  const paid = order && ['captured', 'partially_refunded', 'refunded'].includes(order.status);
  const closed = order && ['expired', 'cancelled', 'failed'].includes(order.status);
  const heading = !order ? 'Order not found' : paid ? 'Order paid' : closed || params.result === 'cancelled' ? 'No charge made' : 'Confirming payment';
  return (
    <StorefrontShell allowUnavailableChildren>
      <main id="main-content" className="sf-container-narrow py-[var(--space-3xl)]">
        <h1 className="sf-display sf-h1">{heading}</h1>
        {!order ? <p className="sf-lead mt-3">{error}</p>
          : paid ? <p className="sf-lead mt-3">{order.name} · {formatMoney(order.amount)}. Pick it up on your next visit.</p>
          : closed || params.result === 'cancelled' ? <p className="sf-lead mt-3">Checkout was cancelled, so your card wasn’t charged.</p>
          : <p className="sf-lead mt-3">Stripe is still confirming your payment. Refresh this page in a moment.</p>}
        <div className="sf-actions mt-8">
          <Link href="/shop" className="sf-btn">Shop</Link>
          <Link href="/book" className="sf-btn is-primary">Book a time</Link>
        </div>
      </main>
    </StorefrontShell>
  );
}
