import Link from 'next/link';
import { getMembershipOffers } from '../lib/data/offers';
import { getPublicStorefrontSettings } from '../lib/data/settings';
import { formatMoney } from '../lib/format';
import { StorefrontShell } from './StorefrontShell';

const INTERVAL: Record<string, string> = { monthly: 'month', quarterly: 'quarter', annual: 'year' };

/** Packages and memberships are sold in the shop and used when booking. */
export default async function MembershipsPage() {
  const [settings, offers] = await Promise.all([getPublicStorefrontSettings(), getMembershipOffers()]);
  if (!settings) return <StorefrontShell><></></StorefrontShell>;
  return (
    <StorefrontShell>
      <main id="main-content">
        <section className="sf-container sf-page-head">
          <p className="sf-eyebrow">Bought in the shop</p>
          <div className="sf-page-head-row">
            <h1 className="sf-display">Memberships</h1>
            <div className="sf-track"><Link href="/account" className="sf-pill">Your balances</Link><Link href="/book" className="sf-pill is-primary">Book a chair</Link></div>
          </div>
        </section>
        <section className="sf-container sf-section grid gap-[var(--space-2xl)] pt-[var(--space-xl)] lg:grid-cols-2">
          {offers === null ? <p role="alert" className="sf-notice is-error lg:col-span-2">Memberships couldn’t load. Try again in a moment.</p> : null}
          {offers ? (
            <section aria-labelledby="plans">
              <h2 id="plans" className="sf-title mb-4">Memberships</h2>
              {!offers.plans.length ? <p className="sf-muted">No memberships offered.</p> : (
                <ul className="grid gap-4">
                  {offers.plans.map((plan) => (
                    <li key={plan.id} className="sf-card-dark sf-on-dark grid gap-2">
                      <div className="flex items-baseline justify-between gap-3"><h3 className="sf-subtitle">{plan.name}</h3><span className="sf-mono">{formatMoney(plan.price)}/{INTERVAL[plan.billingInterval] || plan.billingInterval}</span></div>
                      <p className="sf-small">{plan.includedVisits ? `${plan.includedVisits} ${plan.includedVisits === 1 ? 'visit' : 'visits'} included` : 'No visits included'}{plan.discountPercent ? ` · ${plan.discountPercent}% off other services` : ''}</p>
                      {plan.description ? <p className="sf-small text-[var(--color-inverse-muted)]">{plan.description}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
          {offers ? (
            <section aria-labelledby="packages">
              <h2 id="packages" className="sf-title mb-4">Packages</h2>
              {!offers.packages.length ? <p className="sf-muted">No packages offered.</p> : (
                <ul className="grid gap-4">
                  {offers.packages.map((item) => (
                    <li key={item.id} className="sf-card grid gap-2">
                      <div className="flex items-baseline justify-between gap-3"><h3 className="sf-subtitle">{item.name}</h3><span className="sf-mono">{formatMoney(item.price)}</span></div>
                      <ul className="sf-small sf-muted">{item.items.map((line) => <li key={line.serviceId}>{line.quantity} × <Link className="sf-link" href={`/services/${line.serviceId}`}>{line.serviceName}</Link></li>)}</ul>
                      {item.description ? <p className="sf-small sf-muted">{item.description}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </section>
      </main>
    </StorefrontShell>
  );
}
