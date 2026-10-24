import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOnlineDepositsEnabled } from '../lib/data/deposits';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { StorefrontShell } from './StorefrontShell';
import { getAllServices } from '../lib/data/services';
import { StorefrontImage } from '../components/StorefrontImage';
import { formatMoney, formatDuration } from '../lib/format';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = (await getAllServices().catch(() => [])).find(item => item.id === id);
  return service ? { title: service.name, description: service.description || undefined } : { title: 'Page not found' };
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [services, onlineDeposits] = await Promise.all([getAllServices(), getOnlineDepositsEnabled()]);
  const service = services.find(item => item.id === id);
  if (!service) notFound();
  const image = service.imagePath?.endsWith('.svg') ? undefined : service.imagePath;

  return (
    <StorefrontShell>
      <main id="main-content" className="sf-container pb-[var(--space-3xl)]">
        <Link href="/services" className="sf-arrow-link mt-4"><ArrowLeft aria-hidden="true" /> Services</Link>
        <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
          <StorefrontImage src={image} fallbackSrc="/images/barbershop/photo/scissor-cut.webp" alt={service.name} className="aspect-[4/3] rounded-[var(--radius-lg)] lg:aspect-[4/5]" priority sizes="(max-width: 1024px) 100vw, 50vw" />
          <div className="grid content-start gap-6">
            {service.category?.name ? <p className="sf-eyebrow">{service.category.name}</p> : null}
            <h1 className="sf-display text-[var(--text-display-s)]">{service.name}</h1>
            {service.description ? <p className="sf-lead">{service.description}</p> : null}
            <dl className="sf-ledger">
              <div><dt>Price</dt><dd className="sf-mono">{formatMoney(service.price)}</dd></div>
              <div><dt>Time in chair</dt><dd className="sf-mono">{formatDuration(service.durationMinutes)}</dd></div>
              {service.depositRequired ? <div><dt>Deposit</dt><dd className="sf-mono">{formatMoney(service.depositAmount || 0)}</dd></div> : null}
            </dl>
            {service.depositRequired && !onlineDeposits
              ? <p role="status" className="sf-notice">Online booking unavailable for deposit-required services.</p>
              : <div className="sf-track"><Link href={`/book?service=${encodeURIComponent(service.id)}`} className="sf-pill is-primary">Choose a time</Link><Link href="/queue" className="sf-pill">Join walk-ins</Link></div>}
            {service.specialists?.length ? (
              <section aria-labelledby="service-barbers" className="grid gap-2">
                <h2 id="service-barbers" className="sf-eyebrow">Barbers</h2>
                <ul>
                  {service.specialists.map((barber) => (
                    <li key={barber.id}>
                      <Link className="sf-booking-row" href={`/book?service=${encodeURIComponent(service.id)}&barber=${encodeURIComponent(barber.id)}`}>
                        <span className="sf-subtitle text-[1.3rem]">{barber.displayName}</span>
                        <span className="flex items-center gap-2 sf-small sf-muted">{barber.chairNumber ? <span className="sf-mono">Chair {barber.chairNumber}</span> : null}<ArrowUpRight aria-hidden="true" className="size-4" /></span>
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
