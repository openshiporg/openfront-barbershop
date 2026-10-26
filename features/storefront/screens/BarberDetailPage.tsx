import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { barberPhoto } from '../components/BarberCard';
import { StorefrontImage } from '../components/StorefrontImage';
import { getAllBarbers, getAllServices } from '../lib/data/services';
import { getBarberWeek } from '../lib/data/offers';
import { formatDuration, formatMoney } from '../lib/format';
import { StorefrontShell } from './StorefrontShell';

const DAYS: Array<[string, string]> = [['monday', 'Mon'], ['tuesday', 'Tue'], ['wednesday', 'Wed'], ['thursday', 'Thu'], ['friday', 'Fri'], ['saturday', 'Sat'], ['sunday', 'Sun']];
const clock = (minute: number | null) => (minute == null ? '' : `${Math.floor(minute / 60) % 12 || 12}:${String(minute % 60).padStart(2, '0')} ${minute >= 720 ? 'PM' : 'AM'}`);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const barber = (await getAllBarbers().catch(() => [])).find((item) => item.id === id);
  return barber ? { title: barber.displayName, description: barber.bio || undefined } : { title: 'Page not found' };
}

export default async function BarberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [barbers, services, week] = await Promise.all([getAllBarbers(), getAllServices(), getBarberWeek(id)]);
  const barber = barbers.find((item) => item.id === id);
  if (!barber) notFound();
  const photo = barberPhoto(barber);
  const offered = services.filter((service) => !service.specialists?.length || service.specialists.some((specialist) => specialist.id === barber.id));
  const byDay = new Map(week.map((day) => [day.dayOfWeek, day]));
  return (
    <StorefrontShell>
      <main id="main-content" className="sf-container pb-[var(--space-3xl)]">
        <Link href="/barbers" className="sf-arrow-link mt-4"><ArrowLeft aria-hidden="true" /> Barbers</Link>
        <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
          <div className="sf-chair-photo is-tall">
            <StorefrontImage src={photo.src} fallbackSrc={photo.fallback} alt={barber.displayName} priority sizes="(max-width: 1024px) 100vw, 45vw" />
            {barber.chairNumber ? <span className="sf-chair-no">Chair<b>{barber.chairNumber}</b></span> : null}
          </div>
          <div className="grid content-start gap-6">
            <h1 className="sf-display sf-h1">{barber.displayName}</h1>
            {barber.bio ? <p className="sf-lead">{barber.bio}</p> : null}
            <div className="sf-actions">
              <Link href={`/book?barber=${encodeURIComponent(barber.id)}`} className="sf-btn is-accent">Book with {barber.displayName.split(' ')[0]}</Link>
              <Link href="/queue" className="sf-btn">Join the line</Link>
            </div>
            {week.length ? (
              <section aria-labelledby="barber-week" className="grid gap-2">
                <h2 id="barber-week" className="sf-subtitle">In the chair</h2>
                <dl className="sf-ledger">
                  {DAYS.map(([day, label]) => {
                    const hours = byDay.get(day);
                    return <div key={day}><dt>{label}</dt><dd className="sf-mono">{hours ? `${clock(hours.startMinute)} – ${clock(hours.endMinute)}` : 'Off'}</dd></div>;
                  })}
                </dl>
              </section>
            ) : null}
            {offered.length ? (
              <section aria-labelledby="barber-services" className="grid gap-2">
                <h2 id="barber-services" className="sf-subtitle">Services</h2>
                <ul className="sf-ledger">
                  {offered.map((service) => (
                    <li key={service.id}>
                      <Link href={service.depositRequired ? `/services/${service.id}` : `/book?service=${encodeURIComponent(service.id)}&barber=${encodeURIComponent(barber.id)}`} className="w-full justify-between gap-3">
                        <span>{service.name} <span className="sf-muted sf-mono">· {formatDuration(service.durationMinutes)}</span></span>
                        <span className="sf-mono">{formatMoney(service.price)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </main>
    </StorefrontShell>
  );
}
