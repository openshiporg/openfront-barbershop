import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { phoneHref } from '@/features/shared/storefront-settings';
import { BarberCard } from '../components/BarberCard';
import { MenuList } from '../components/MenuList';
import { NowServingBoard } from '../components/NowServingBoard';
import { StorefrontImage } from '../components/StorefrontImage';
import { TicketLink } from '../components/TicketLink';
import { getAllBarbers, getServiceCategories } from '../lib/data/services';
import { getPublicStorefrontSettings } from '../lib/data/settings';
import { getStorefrontOnNowBarberIds, getStorefrontQueueSummary } from '../lib/data/queue';
import { shopHours } from '../lib/hours';
import { shopTodayStub } from '../lib/format';
import { StorefrontShell } from './StorefrontShell';

export default async function HomePage() {
  const [categories, barbers, settings, onNowIds, line] = await Promise.all([getServiceCategories(), getAllBarbers(), getPublicStorefrontSettings(), getStorefrontOnNowBarberIds(), getStorefrontQueueSummary()]);
  if (!settings) return <StorefrontShell><></></StorefrontShell>;
  const { days, state } = shopHours(settings.hours, settings.timezone);
  const telephoneHref = phoneHref(settings.phone);
  const call = telephoneHref && settings.phone ? <a href={`tel:${telephoneHref}`} className="sf-link">{settings.phone}</a> : null;
  const serviceCount = categories.reduce((total, category) => total + category.services.length, 0);
  const today = shopTodayStub(settings.timezone);
  const walkInsOpen = Boolean(line?.open);
  const onFloor = onNowIds ? onNowIds.length : null;

  const joinSub = !line
    ? 'Line status unavailable · take a number online'
    : !line.open
      ? line.opensAt || 'Walk-ins closed now'
      : line.waiting
        ? `${line.waiting} ahead of you · about ${line.waitMinutes} min`
        : 'No one waiting right now';

  return (
    <StorefrontShell>
      <main id="main-content">
        <section className="sf-container sf-dispenser" aria-label="Walk in or book">
          <NowServingBoard summary={line} barbersOnNow={walkInsOpen ? onFloor : null} phone={call} />
          <div className="sf-dispenser-tickets">
            <TicketLink
              href="/queue"
              title="Join the line"
              numeral={walkInsOpen && line ? String(line.waiting + 1) : '--'}
              unit={walkInsOpen ? 'your place' : 'closed'}
              sub={joinSub}
              sign={!walkInsOpen}
            />
            <TicketLink
              href="/book"
              title="Book a time"
              numeral={today?.day || '--'}
              unit={today?.month}
              sub="Choose your barber and a time"
              sign={walkInsOpen}
            />
          </div>
        </section>

        <div className="sf-photo-band">
          <StorefrontImage src="/images/barbershop/photo/shop-floor.webp" fallbackSrc="/images/barbershop/photo/shop-floor.webp" alt={`${settings.name} shop floor`} priority sizes="100vw" />
        </div>

        <section className="sf-container sf-section" aria-labelledby="home-services">
          <div className="sf-board-head">
            <h2 id="home-services" className="sf-title">Prices</h2>
            <Link href="/services" className="sf-arrow-link">{serviceCount > 8 ? `All ${serviceCount} services` : 'Service details'} <ArrowRight aria-hidden="true" /></Link>
          </div>
          {serviceCount ? <MenuList categories={categories} barberCount={barbers.length} limit={8} /> : <p className="sf-muted">No services listed online.</p>}
        </section>

        <section className="sf-container sf-section pt-0" aria-labelledby="home-barbers">
          <div className="sf-section-head">
            <h2 id="home-barbers" className="sf-title">The chairs</h2>
            {barbers.length > 3 ? <Link href="/barbers" className="sf-arrow-link">All barbers <ArrowRight aria-hidden="true" /></Link> : null}
          </div>
          {barbers.length ? <div className="sf-chair-grid">{barbers.slice(0, 3).map((barber) => <BarberCard key={barber.id} barber={barber} onFloor={onNowIds ? onNowIds.includes(barber.id) : undefined} />)}</div> : <p className="sf-muted">No barbers listed online.</p>}
        </section>

        <section className="sf-container sf-section pt-0" aria-labelledby="home-visit">
          <div className="sf-visit">
            <div className="grid content-start gap-6">
              <h2 id="home-visit" className="sf-title">Visit</h2>
              <dl className="sf-facts">
                {settings.address ? <div><dt className="sf-eyebrow">Address</dt><dd>{settings.address}</dd></div> : null}
                {call ? <div><dt className="sf-eyebrow">Phone</dt><dd>{call}</dd></div> : null}
              </dl>
              <div className="sf-actions">
                <Link href="/appointment" className="sf-btn">My appointment</Link>
              </div>
            </div>
            {days.length ? (
              <div className="grid content-start gap-3">
                <h3 className="sf-subtitle">{state ? <><span className={`sf-dot ${state.open ? 'is-live' : 'is-alert'}`} aria-hidden="true" />Hours · {state.label}</> : 'Hours'}</h3>
                <ul className="sf-hours">
                  {days.map((day) => <li key={day.key} className={day.today ? 'is-today' : undefined}><span>{day.label}{day.today ? ' · today' : ''}</span><span>{day.text}</span></li>)}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </StorefrontShell>
  );
}
