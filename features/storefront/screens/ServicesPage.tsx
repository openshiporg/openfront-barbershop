import Link from 'next/link';
import { MenuList } from '../components/MenuList';
import { getAllBarbers, getServiceCategories } from '../lib/data/services';
import { getPublicStorefrontSettings } from '../lib/data/settings';
import { StorefrontShell } from './StorefrontShell';

export default async function ServicesPage() {
  const [categories, barbers, settings] = await Promise.all([
    getServiceCategories(),
    getAllBarbers(),
    getPublicStorefrontSettings(),
  ]);
  if (!settings) return <StorefrontShell><></></StorefrontShell>;

  return (
    <StorefrontShell>
      <main id="main-content">
        <section className="border-b border-[var(--color-rule)]">
          <div className="sf-container grid gap-[var(--space-xl)] py-[var(--space-3xl)] lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="sf-eyebrow">Services</p>
              <h1 className="sf-display mt-3 text-[var(--text-display-s)]">The service menu.</h1>
            </div>
            <Link href="/book" className="sf-btn sf-btn-primary shrink-0">
              Book a service
            </Link>
          </div>
        </section>

        <section className="sf-container py-[var(--space-3xl)]">
          {categories.length ? (
            <MenuList categories={categories} barberCount={barbers.length} />
          ) : (
            <div className="border border-dashed border-[var(--color-rule-strong)] p-[var(--space-3xl)] text-center">
              <p className="sf-display text-[var(--text-title)]">No services are listed online yet</p>
              <p className="mt-3 text-[var(--color-ink-muted)]">{settings.phone ? `Call ${settings.phone} and the shop can help choose the right appointment.` : 'Contact the shop for help choosing the right appointment.'}</p>
            </div>
          )}
        </section>

        <section className="sf-panel-inverse">
          <div className="sf-container flex flex-col gap-4 py-[var(--space-2xl)] md:flex-row md:items-center md:justify-between">
            <p className="text-[var(--text-lead)] text-[var(--color-inverse-muted)]">
              {settings.name}{settings.address ? ` · ${settings.address}` : ''}
            </p>
            <Link href="/book" className="sf-btn sf-btn-accent shrink-0">
              Book a visit
            </Link>
          </div>
        </section>
      </main>
    </StorefrontShell>
  );
}
