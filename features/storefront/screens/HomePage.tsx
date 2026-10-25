import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { phoneHref } from '@/features/shared/storefront-settings';
import { BarberCard } from '../components/BarberCard';
import { MenuList } from '../components/MenuList';
import { StorefrontImage } from '../components/StorefrontImage';
import { getAllBarbers, getServiceCategories } from '../lib/data/services';
import { getPublicStorefrontSettings } from '../lib/data/settings';
import { getStorefrontOnNowBarberIds } from '../lib/data/queue';
import { shopHours } from '../lib/hours';
import { StorefrontShell } from './StorefrontShell';

export default async function HomePage() {
  const [categories, barbers, settings, onNowIds] = await Promise.all([getServiceCategories(), getAllBarbers(), getPublicStorefrontSettings(), getStorefrontOnNowBarberIds()]);
  // Only barbers working right now are on the floor.
  const onFloor = onNowIds ? barbers.filter((barber) => onNowIds.includes(barber.id)) : [];
  if (!settings) return <StorefrontShell><></></StorefrontShell>;
  const { days, state } = shopHours(settings.hours, settings.timezone);
  const telephoneHref = phoneHref(settings.phone);
  const serviceCount = categories.reduce((total, category) => total + category.services.length, 0);

  return (
    <StorefrontShell>
      <main id="main-content">
        <section className="sf-hero" aria-labelledby="home-title">
          <div className="sf-hero-media">
            <StorefrontImage src="/images/barbershop/photo/shop-floor.webp" fallbackSrc="/images/barbershop/photo/shop-floor.webp" alt={`${settings.name} shop floor`} priority sizes="100vw" />
          </div>
          <div className="sf-container sf-hero-inner">
            <div className="sf-hero-copy">
              {state ? <p className="sf-eyebrow"><span className={`sf-dot ${state.open ? 'is-live' : ''}`} aria-hidden="true" />{state.label}</p> : null}
              <h1 id="home-title" className="sf-display">{settings.name}</h1>
              {settings.tagline ? <p className="sf-lead">{settings.tagline}</p> : null}
              <div className="sf-track self-start">
                <Link href="/book" className="sf-pill is-primary">Book a chair</Link>
                <Link href="/queue" className="sf-pill">Join walk-ins</Link>
              </div>
              <div className="sf-hero-meta">
                {settings.address ? <span>{settings.address}</span> : null}
                {telephoneHref && settings.phone ? <a href={`tel:${telephoneHref}`} className="sf-mono"><strong>{settings.phone}</strong></a> : null}
              </div>
            </div>
            {onFloor.length ? (
              <div className="sf-hero-board">
                <p className="sf-eyebrow mb-1">On the floor</p>
                <ul>
                  {onFloor.slice(0, 4).map((barber) => (
                    <li key={barber.id}>
                      <span className="sf-mono">{barber.chairNumber ? `CH ${barber.chairNumber.padStart(2, '0')}` : 'CH --'}</span>
                      <span className="truncate">{barber.displayName}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        <section className="sf-board sf-on-dark sf-section" aria-labelledby="home-services">
          <div className="sf-container">
            <div className="sf-board-head">
              <h2 id="home-services" className="sf-title">Services</h2>
              {serviceCount > 8 ? <Link href="/services" className="sf-arrow-link">All {serviceCount} services <ArrowUpRight aria-hidden="true" /></Link> : <Link href="/services" className="sf-arrow-link">Service details <ArrowUpRight aria-hidden="true" /></Link>}
            </div>
            {serviceCount ? <MenuList categories={categories} barberCount={barbers.length} limit={8} /> : <p className="sf-muted">No services listed online.</p>}
          </div>
        </section>

        <section className="sf-container sf-section" aria-labelledby="home-barbers">
          <div className="sf-section-head">
            <h2 id="home-barbers" className="sf-title">The chairs</h2>
            {barbers.length > 3 ? <Link href="/barbers" className="sf-arrow-link">All barbers <ArrowUpRight aria-hidden="true" /></Link> : null}
          </div>
          {barbers.length ? <div className="sf-chair-grid">{barbers.slice(0, 3).map((barber) => <BarberCard key={barber.id} barber={barber} />)}</div> : <p className="sf-muted">No barbers listed online.</p>}
        </section>

        <section className="sf-container sf-section pt-0" aria-labelledby="home-visit">
          <div className="sf-visit">
            <div className="grid content-start gap-6">
              <h2 id="home-visit" className="sf-title">Visit</h2>
              <dl className="sf-facts">
                {settings.address ? <div><dt className="sf-eyebrow">Address</dt><dd>{settings.address}</dd></div> : null}
                {telephoneHref && settings.phone ? <div><dt className="sf-eyebrow">Phone</dt><dd><a href={`tel:${telephoneHref}`} className="sf-mono">{settings.phone}</a></dd></div> : null}
              </dl>
              <div className="sf-track">
                <Link href="/book" className="sf-pill is-primary">Book a chair</Link>
                <Link href="/appointment" className="sf-pill">My appointment</Link>
              </div>
            </div>
            {days.length ? (
              <div>
                <h3 className="sf-eyebrow mb-2">{state ? <><span className={`sf-dot ${state.open ? 'is-live' : ''}`} aria-hidden="true" />Hours · {state.label}</> : 'Hours'}</h3>
                <ul className="sf-hours">
                  {days.map((day) => <li key={day.key} className={day.today ? 'is-today' : undefined}><span>{day.label}</span><span className="sf-mono">{day.text}</span></li>)}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </StorefrontShell>
  );
}
