import Link from 'next/link';
import { StorefrontShell } from './StorefrontShell';

/** Where Stripe's card form returns after a payment taken at the chair. The shop's POS records the sale itself. */
export default async function CardPaymentReturnPage({ searchParams }: { searchParams?: Promise<{ result?: string }> }) {
  const result = (await searchParams)?.result;
  const paid = result === 'paid';
  return (
    <StorefrontShell allowUnavailableChildren>
      <main id="main-content" className="sf-container-narrow py-[var(--space-3xl)]">
        <h1 className="sf-display sf-h1">{paid ? 'Payment received' : 'Payment not taken'}</h1>
        <p className="sf-lead mt-3">
          {paid
            ? 'Thanks. Your card was charged and the shop has your receipt. You can hand the device back or close this page.'
            : 'No charge was made. Hand the device back to the shop to pay another way.'}
        </p>
        <div className="sf-actions mt-8">
          <Link href="/book" className="sf-btn is-primary">Book your next visit</Link>
          <Link href="/" className="sf-btn is-quiet">Home</Link>
        </div>
      </main>
    </StorefrontShell>
  );
}
