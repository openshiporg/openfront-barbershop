import Link from 'next/link';
import { BarberCard } from '../components/BarberCard';
import { getAllBarbers } from '../lib/data/services';
import { getPublicStorefrontSettings } from '../lib/data/settings';
import { getStorefrontOnNowBarberIds } from '../lib/data/queue';
import { StorefrontShell } from './StorefrontShell';

export default async function BarbersPage() {
  const [barbers, settings, onNowIds] = await Promise.all([getAllBarbers(), getPublicStorefrontSettings(), getStorefrontOnNowBarberIds()]);
  if (!settings) return <StorefrontShell><></></StorefrontShell>;

  return (
    <StorefrontShell>
      <main id="main-content">
        <section className="sf-container sf-page-head">
          <div className="sf-page-head-row">
            <h1 className="sf-display">Barbers</h1>
            <div className="sf-actions">
              <Link href="/queue" className="sf-btn">Join the line</Link>
              <Link href="/book" className="sf-btn is-primary">Book first available</Link>
            </div>
          </div>
          <p className="sf-lead">{barbers.length} {barbers.length === 1 ? 'chair' : 'chairs'}. Pick a barber to see their week and what they cut.</p>
        </section>

        <section className="sf-container sf-section is-tight">
          {barbers.length ? (
            <div className="sf-chair-grid">
              {barbers.map((barber, index) => <BarberCard key={barber.id} barber={barber} priority={index < 3} onFloor={onNowIds ? onNowIds.includes(barber.id) : undefined} />)}
            </div>
          ) : (
            <p className="sf-muted">No barbers listed online.</p>
          )}
        </section>
      </main>
    </StorefrontShell>
  );
}
