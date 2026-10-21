import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { BarberCard } from '../components/BarberCard';
import { StorefrontImage } from '../components/StorefrontImage';
import { getAllBarbers, getServiceCategories } from '../lib/data/services';
import { formatDuration, formatMoney } from '../lib/format';
import { getPublicStorefrontSettings } from '../lib/data/settings';
import { StorefrontShell } from './StorefrontShell';

const photos = ['/images/barbershop/photo/scissor-cut.webp', '/images/barbershop/photo/clipper-fade.webp', '/images/barbershop/photo/beard-detail.webp'];

export default async function HomePage() {
  const [categories, barbers, settings] = await Promise.all([getServiceCategories(), getAllBarbers(), getPublicStorefrontSettings()]);
  if (!settings) return <StorefrontShell><></></StorefrontShell>;
  const featured = categories.flatMap(category => category.services).slice(0, 3);
  return <StorefrontShell><main id="main-content">
    <section className="sf-photo-hero">
      <StorefrontImage src="/images/barbershop/photo/shop-floor.webp" fallbackSrc="/images/barbershop/photo/shop-floor.webp" alt="Barber chairs and workstations" className="sf-photo-hero-media" imageClassName="sf-photo-hero-image" priority sizes="100vw" />
      <div className="sf-photo-hero-shade" aria-hidden="true" />
      <div className="sf-container sf-photo-hero-content"><div className="sf-photo-hero-copy"><p className="sf-photo-caption">{settings.address}</p><h1 className="sf-display">{settings.name}</h1><div className="sf-photo-hero-actions"><Link href="/book" className="sf-btn sf-btn-accent">Book a chair</Link><Link href="/services" className="sf-text-link sf-text-link-inverse">Services <ArrowUpRight aria-hidden="true" /></Link></div></div></div>
    </section>
    <section className="sf-container sf-service-index">
      <div className="sf-section-heading"><h2 className="sf-display">Services</h2><Link href="/services" className="sf-text-link">All services <ArrowUpRight aria-hidden="true" /></Link></div>
      <div className="sf-service-photo-grid">{featured.map((service, index) => <Link href={`/services/${service.id}`} className="sf-service-photo-card" key={service.id}><StorefrontImage src={service.imagePath?.endsWith('.svg') ? photos[index] : service.imagePath || photos[index]} fallbackSrc={photos[index]} alt={service.name} className="sf-service-photo" sizes="(max-width: 640px) 100vw, 33vw" /><div className="sf-service-photo-meta"><div><h3>{service.name}</h3><p>{formatDuration(service.durationMinutes)}</p></div><strong>{formatMoney(service.price)}</strong></div></Link>)}{!featured.length ? <p className="sf-empty">Service menu unavailable.</p> : null}</div>
    </section>
    <section className="sf-container sf-barber-roster"><div className="sf-section-heading"><h2 className="sf-display">Barbers</h2><Link href="/barbers" className="sf-text-link">All barbers <ArrowUpRight aria-hidden="true" /></Link></div><div className="sf-barber-grid">{barbers.map(barber => <BarberCard key={barber.id} barber={barber} />)}{!barbers.length ? <p className="sf-empty">No barbers available.</p> : null}</div></section>
  </main></StorefrontShell>;
}
