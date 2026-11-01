import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOnlineDepositsEnabled } from '../lib/data/deposits';
import { ArrowLeft } from 'lucide-react';
import { phoneHref } from '@/features/shared/storefront-settings';
import { getPublicStorefrontSettings } from '../lib/data/settings';
import { StorefrontShell } from './StorefrontShell';
import { getAllBarbers, getAllServices } from '../lib/data/services';
import { StorefrontImage } from '../components/StorefrontImage';
import { ServiceBooker } from '../components/ServiceBooker';
import { formatMoney, formatDuration } from '../lib/format';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = (await getAllServices().catch(() => [])).find(item => item.id === id);
  return service ? { title: service.name, description: service.description || undefined } : { title: 'Page not found' };
}

const FALLBACK = '/images/barbershop/antares/service-classic-cut.webp';

export default async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [services, allBarbers, onlineDeposits, settings] = await Promise.all([getAllServices(), getAllBarbers(), getOnlineDepositsEnabled(), getPublicStorefrontSettings()]);
  const telephone = phoneHref(settings?.phone);
  const service = services.find(item => item.id === id);
  if (!service) notFound();
  const image = service.imagePath?.endsWith('.svg') ? undefined : service.imagePath;
  const specialistIds = new Set((service.specialists || []).map((barber) => barber.id));
  const barbers = specialistIds.size ? allBarbers.filter((barber) => specialistIds.has(barber.id)) : allBarbers;
  const bookable = !service.depositRequired || onlineDeposits;
  const others = services.filter((item) => item.id !== service.id).slice(0, 2);
  const [first, ...rest] = service.name.split(/\s+/);

  return (
    <StorefrontShell>
      <main id="main-content" className="sf-detail">
        <section className="sf-detail-lead" aria-labelledby="service-title">
          <Link href="/services" className="sf-arrow-link"><ArrowLeft aria-hidden="true" /> Services</Link>
          <h1 id="service-title" className="sf-detail-title">
            {service.category?.name ? <span className="sf-detail-stamp" aria-hidden="true">{service.category.name}</span> : null}
            <span>{first}</span>{rest.length ? <span> {rest.join(' ')}</span> : null}
          </h1>
          <p className="sf-detail-facts">{formatDuration(service.durationMinutes).replace('min', 'minutes')} <span aria-hidden="true">|</span> {formatMoney(service.price)}</p>
          {service.description ? <p className="sf-detail-desc">{service.description}</p> : null}
          <div className="sf-detail-collage">
            <div className="sf-detail-photo">
              <StorefrontImage src={image} fallbackSrc={FALLBACK} alt={service.name} priority sizes="(max-width: 1024px) 90vw, 30vw" />
            </div>
            {barbers[0] ? <span className="sf-detail-label is-a">{barbers.length === 1 ? `With ${barbers[0].displayName}` : `${barbers.length} barbers`}</span> : null}
            {settings ? <span className="sf-detail-label is-b">{settings.name}</span> : null}
          </div>
          {others.length ? (
            <div className="sf-detail-more">
              <p className="sf-eyebrow">More services</p>
              {others.map((item) => <Link key={item.id} className="sf-link" href={`/services/${encodeURIComponent(item.id)}`}>{item.name} · {formatMoney(item.price)}</Link>)}
            </div>
          ) : null}
        </section>

        {bookable && settings ? (
          <ServiceBooker service={service} barbers={barbers} timeZone={settings.timezone} />
        ) : (
          <section className="sf-detail-mid">
            <h2 className="sf-detail-h">Booked by phone</h2>
            <p className="sf-lead">This service takes a {formatMoney(service.depositAmount || 0)} deposit, and the shop takes deposits by phone.</p>
            <div className="sf-actions">
              {telephone && settings?.phone ? <a className="sf-btn is-red" href={`tel:${telephone}`}>Call {settings.phone}</a> : null}
              <Link href="/queue" className="sf-btn">Join the line</Link>
            </div>
          </section>
        )}
      </main>
    </StorefrontShell>
  );
}
