import Link from 'next/link';
import { BarberCard } from '../components/BarberCard';
import { getAllBarbers } from '../lib/data/services';
import { getPublicStorefrontSettings } from '../lib/data/settings';
import { StorefrontShell } from './StorefrontShell';

export default async function BarbersPage() {
  const [barbers, settings] = await Promise.all([getAllBarbers(), getPublicStorefrontSettings()]);
  if (!settings) return <StorefrontShell><></></StorefrontShell>;

  return (
    <StorefrontShell>
      <main id="main-content">
        <section className="sf-panel-inverse">
          <div className="sf-container py-[var(--space-3xl)]">
            <p className="sf-eyebrow text-[var(--color-accent)]">Meet the barbers</p>
            <h1 className="sf-display mt-3 max-w-[12ch] text-[var(--text-display)] text-[var(--color-inverse-ink)]">
              The barbers.
            </h1>

          </div>
        </section>

        <section className="sf-container py-[var(--space-3xl)]">
          <div className="mb-[var(--space-2xl)] flex flex-col gap-4 border-b border-[var(--color-rule)] pb-[var(--space-lg)] md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="sf-display text-[var(--text-title)]">Choose a barber.</h2>
            </div>
            <Link href="/book" className="sf-btn sf-btn-primary shrink-0">
              Open booking
            </Link>
          </div>

          <div className="grid gap-[var(--space-md)] md:grid-cols-2 lg:grid-cols-3">
            {barbers.map((barber) => (
              <BarberCard key={barber.id} barber={barber} />
            ))}
            {!barbers.length && (
              <p className="col-span-full border border-dashed border-[var(--color-rule-strong)] p-[var(--space-xl)] text-[var(--color-ink-muted)]">
                No barber profiles are available online at the moment.
              </p>
            )}
          </div>
        </section>

        <section className="border-t border-[var(--color-rule)] bg-[var(--color-paper-2)]">
          <div className="sf-container-narrow py-[var(--space-2xl)] text-center">
            <p className="text-[var(--text-small)] text-[var(--color-ink-muted)]">
              {settings.phone ? `Walk-in enquiries · ${settings.phone}` : 'Walk-in availability varies.'}
            </p>
          </div>
        </section>
      </main>
    </StorefrontShell>
  );
}
