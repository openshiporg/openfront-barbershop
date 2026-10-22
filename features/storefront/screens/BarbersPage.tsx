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
        <section className="sf-container sf-page-head">
          <p className="sf-eyebrow">{barbers.length} {barbers.length === 1 ? 'chair' : 'chairs'}</p>
          <div className="sf-page-head-row">
            <h1 className="sf-display">Barbers</h1>
            <div className="sf-track">
              <Link href="/book" className="sf-pill is-primary">First available</Link>
              <Link href="/queue" className="sf-pill">Join walk-ins</Link>
            </div>
          </div>
        </section>

        <section className="sf-container sf-section pt-[var(--space-xl)]">
          {barbers.length ? (
            <div className="sf-chair-grid">
              {barbers.map((barber, index) => <BarberCard key={barber.id} barber={barber} priority={index < 3} />)}
            </div>
          ) : (
            <p className="sf-muted">No barbers listed online.</p>
          )}
        </section>
      </main>
    </StorefrontShell>
  );
}
