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
          <div className="sf-page-head-row">
            <h1 className="sf-display">Memberships</h1>
            <div className="sf-actions"><Link href="/account" className="sf-btn">Your balances</Link><Link href="/book" className="sf-btn is-primary">Book a time</Link></div>
          </div>
          <p className="sf-lead">Bought in the shop, used when you book.</p>
        </section>
        <section className="sf-container sf-section is-tight grid gap-[var(--space-2xl)] lg:grid-cols-2">
          {offers === null ? <p role="alert" className="sf-notice is-error lg:col-span-2">Memberships couldn’t load. Try again in a moment.</p> : null}
          {offers ? (
            <section aria-labelledby="plans">
              <h2 id="plans" className="sf-title mb-4">Plans</h2>
              {!offers.plans.length ? <p className="sf-muted">No memberships offered.</p> : (
                <ul className="grid gap-4">
                  {offers.plans.map((plan) => (
                    <li key={plan.id} className="sf-card-dark sf-on-dark grid gap-2">
                      <div className="flex items-baseline justify-between gap-3"><h3 className="sf-subtitle">{plan.name}</h3><span className="sf-product-price whitespace-nowrap">{formatMoney(plan.price)}<span className="sf-small font-semibold">/{INTERVAL[plan.billingInterval] || plan.billingInterval}</span></span></div>
                      <p className="sf-small">{plan.includedVisits ? `${plan.includedVisits} ${plan.includedVisits === 1 ? 'visit' : 'visits'} included` : 'No visits included'}{plan.discountPercent ? ` · ${plan.discountPercent}% off other services` : ''}</p>
                      {plan.description ? <p className="sf-small sf-muted">{plan.description}</p> : null}
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
                      <div className="flex items-baseline justify-between gap-3"><h3 className="sf-subtitle">{item.name}</h3><span className="sf-product-price">{formatMoney(item.price)}</span></div>
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
