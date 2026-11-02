import Link from 'next/link';
import { ArrowRight, Check, Clock, MapPin, ShoppingBag, Star, User } from 'lucide-react';
import { QuickBook } from '../components/QuickBook';
import { ServiceGlyph } from '../components/ServiceGlyph';
import { StorefrontImage } from '../components/StorefrontImage';
import { productArt } from '../components/productArt';
import { getAllBarbers, getAllServices, getRetailProducts, type StorefrontProduct } from '../lib/data/services';
import { getPublicStorefrontSettings } from '../lib/data/settings';
import { getMembershipOffers, type PlanOffer, type PackageOffer } from '../lib/data/offers';
import { getOnlineDepositsEnabled } from '../lib/data/deposits';
import { getStorefrontQueueSummary } from '../lib/data/queue';
import { shopHours } from '../lib/hours';
import { formatDuration, formatMoney } from '../lib/format';
import { StorefrontShell } from './StorefrontShell';

const INTERVAL: Record<string, string> = { monthly: 'month', quarterly: 'quarter', annual: 'year' };
const STOCK = ['is-red', 'is-black', 'is-outline'] as const;
const HERO_PHOTO = '/images/barbershop/antares/hero-fade.webp';

/** Shop name set as the poster: every word in black, the last one in red. */
function splitName(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return { lead: [] as string[], last: words[0] || '' };
  const lead = words.slice(0, -1);
  // "Stack & Fade" reads STACK / & FADE: a joining ampersand travels with the red word.
  if (lead.length > 1 && /^(&|and|\+)$/i.test(lead[lead.length - 1])) return { lead: lead.slice(0, -1), last: `${lead[lead.length - 1]} ${words[words.length - 1]}` };
  return { lead, last: words[words.length - 1] };
}

type Offer = { id: string; name: string; price: number; per: string | null; lines: string[] };
function planOffer(plan: PlanOffer): Offer {
  const lines = [
    plan.includedVisits ? `${plan.includedVisits} ${plan.includedVisits === 1 ? 'visit' : 'visits'} a ${INTERVAL[plan.billingInterval] || plan.billingInterval}` : null,
    plan.discountPercent ? `${plan.discountPercent}% off other services` : null,
    'Used when you book',
  ].filter(Boolean) as string[];
  return { id: plan.id, name: plan.name, price: plan.price, per: INTERVAL[plan.billingInterval] || plan.billingInterval, lines };
}
function packageOffer(item: PackageOffer): Offer {
  return { id: item.id, name: item.name, price: item.price, per: null, lines: item.items.slice(0, 3).map((line) => `${line.quantity} × ${line.serviceName}`) };
}

export default async function HomePage() {
  const [services, barbers, settings, offers, products, onlineDeposits, line] = await Promise.all([
    getAllServices(),
    getAllBarbers(),
    getPublicStorefrontSettings(),
    getMembershipOffers(),
    getRetailProducts().catch(() => [] as StorefrontProduct[]),
    getOnlineDepositsEnabled(),
    getStorefrontQueueSummary(),
  ]);
  if (!settings) return <StorefrontShell><></></StorefrontShell>;
  const { state, days } = shopHours(settings.hours, settings.timezone);
  const today = days.find((day) => day.today);
  const name = splitName(settings.name);
  const chips = services.slice(0, 3);
  const memberships: Offer[] = offers ? [...offers.plans.map(planOffer), ...offers.packages.map(packageOffer)].slice(0, 3) : [];
  const featured = products.map((product) => ({ product, art: productArt(product) })).filter((item): item is { product: StorefrontProduct; art: string } => Boolean(item.art)).slice(0, 3);
  const walkIns = line?.open ? (line.waiting ? `${line.waiting} waiting · about ${line.waitMinutes} min` : 'No wait right now') : line?.opensAt || null;

  return (
    <StorefrontShell>
      <main id="main-content" className="sf-home">
        <section className="sf-hero" aria-labelledby="home-title">
          <div className="sf-hero-head">
            <h1 id="home-title" className="sf-hero-title">
              {name.lead.map((word, index) => <span key={index} className="sf-hero-word">{word}</span>)}
              <span className="sf-hero-word is-red">{name.last}</span>
            </h1>
            {settings.tagline && settings.address ? (
              <p className="sf-hero-banner"><span className="sf-banner-wide">{settings.tagline}</span><span className="sf-banner-phone">{settings.address}</span></p>
            ) : settings.tagline || settings.address ? <p className="sf-hero-banner">{settings.tagline || settings.address}</p> : null}
            <Link href="/book" className="sf-hero-book" aria-label="Book a time">
              <span>Book</span>
              <svg viewBox="0 0 220 60" aria-hidden="true"><path d="M4 40 C 60 20, 120 18, 196 28" /><path d="M176 10 L 206 29 L 178 50" /></svg>
            </Link>
          </div>

          {state || today || settings.address ? (
            <p className="sf-hero-note">
              {state ? <span className="sf-hero-note-big">{state.label}</span> : null}
              <span className="sf-hero-note-small">{settings.tagline ? settings.address || (today ? `Today ${today.text}` : '') : today ? `Today ${today.text}` : settings.address}</span>
            </p>
          ) : null}

          <div className="sf-hero-photo">
            <StorefrontImage src={HERO_PHOTO} fallbackSrc={HERO_PHOTO} alt={`A fresh fade at ${settings.name}`} priority sizes="(max-width: 1024px) 60vw, 55vw" />
            <span className="sf-hero-seal" aria-hidden="true">
              <span>{name.lead.join(' ')}</span>
              <span className="is-red">{name.last}</span>
            </span>
          </div>
          {settings.tagline && settings.address ? <span className="sf-hero-burst" aria-hidden="true">{settings.tagline}</span> : null}

          {chips.length ? (
            <div className="sf-hero-chips">
              <p className="sf-hero-chips-label"><span className="is-red">Book</span> <span>appointment</span></p>
              <ul>
                {chips.map((service) => (
                  <li key={service.id}>
                    <Link href={`/services/${encodeURIComponent(service.id)}`} className="sf-chip">
                      <ServiceGlyph name={service.name} category={service.category?.name} />
                      <span className="sf-chip-name">{service.name}</span>
                      <span className="sf-chip-meta">{formatMoney(service.price)} · {formatDuration(service.durationMinutes)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="sf-hero-quick">
            <p className="sf-quick-head"><span>Book a haircut</span><Clock aria-hidden="true" /></p>
            <QuickBook services={services} barbers={barbers} timeZone={settings.timezone} onlineDeposits={onlineDeposits} />
          </div>
        </section>

        {memberships.length ? (
          <section className="sf-band" aria-labelledby="home-memberships">
            <div className="sf-band-head">
              <h2 id="home-memberships" className="sf-poster"><span className="sf-poster-ico" aria-hidden="true"><User /></span>Memberships</h2>
              <Link href="/memberships" className="sf-viewall">View all</Link>
            </div>
            <ul className="sf-plans">
              {memberships.map((offer, index) => (
                <li key={offer.id} className={`sf-plan ${STOCK[index % STOCK.length]}`}>
                  <h3>{offer.name}</h3>
                  <p className="sf-plan-price"><b>{formatMoney(offer.price)}</b>{offer.per ? <span> / {offer.per}</span> : null}</p>
                  <ul>{offer.lines.map((text) => <li key={text}><Check aria-hidden="true" />{text}</li>)}</ul>
                  <Link href="/memberships" className="sf-plan-choose">Choose</Link>
                </li>
              ))}
            </ul>
            <div className="sf-band-actions">
              <Link href="/memberships" className="sf-btn is-red">View all memberships <ArrowRight aria-hidden="true" /></Link>
              <Link href="/queue" className="sf-btn is-red">Join the walk-in line</Link>
            </div>
          </section>
        ) : null}

        <div className="sf-strip" aria-hidden="true">
          <div className="sf-strip-photo"><StorefrontImage src="/images/barbershop/antares/service-skin-fade.webp" fallbackSrc={HERO_PHOTO} alt="" sizes="30vw" /></div>
          <p className="sf-strip-name">{settings.name}</p>
          <p className="sf-strip-red">Book <span>now</span></p>
        </div>

        {featured.length ? (
          <section className="sf-band" aria-labelledby="home-featured">
            <div className="sf-band-head">
              <h2 id="home-featured" className="sf-poster"><span className="sf-poster-ico" aria-hidden="true"><ShoppingBag /></span>Featured<span className="sf-poster-extra"> products</span></h2>
              <Link href="/shop" className="sf-viewall">View all</Link>
            </div>
            <ul className="sf-featured">
              {featured.map(({ product, art }) => (
                <li key={product.id}>
                  <Link href={`/shop/${encodeURIComponent(product.id)}`} className="sf-feature">
                    <span className="sf-feature-art"><StorefrontImage src={art} fallbackSrc={art} alt={product.name} sizes="(max-width: 640px) 33vw, 20vw" /></span>
                    <span className="sf-feature-name">{product.name}</span>
                    <span className="sf-feature-price">{formatMoney(product.price)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="sf-band-actions">
              <Link href="/shop" className="sf-btn is-outline">View all products <ArrowRight aria-hidden="true" /></Link>
            </div>
          </section>
        ) : null}

        <section className="sf-closer" aria-label="Book or walk in">
          <Link href="/memberships" className="sf-closer-btn">Become a member</Link>
          <Link href="/book" className="sf-closer-book">Book now</Link>
          <Link href="/queue" className="sf-closer-btn">{walkIns ? <>Walk in <span className="sf-closer-sub">{walkIns}</span></> : 'Walk in'}</Link>
          {settings.address ? <p className="sf-closer-where"><MapPin aria-hidden="true" />{settings.address}{today ? <> · <Star aria-hidden="true" />Today {today.text}</> : null}</p> : null}
        </section>
        <p className="sf-edge-name" aria-hidden="true">{settings.name}</p>
      </main>
    </StorefrontShell>
  );
}
