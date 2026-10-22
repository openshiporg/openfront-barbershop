import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { StorefrontBarber } from '../lib/data/services';
import { StorefrontImage } from './StorefrontImage';

type BarberCardProps = {
  barber: StorefrontBarber;
  priority?: boolean;
};

const barberFallbacks: Record<string, string> = {
  'Maya Brooks': '/images/barbershop/photo/clipper-fade.webp',
  'Andre Miles': '/images/barbershop/photo/scissor-cut.webp',
  'Leo Chen': '/images/barbershop/photo/barber-at-work.webp',
};

export function barberPhoto(barber: Pick<StorefrontBarber, 'displayName' | 'imagePath'>) {
  const fallback = barberFallbacks[barber.displayName] || '/images/barbershop/photo/barber-at-work.webp';
  return { src: barber.imagePath?.endsWith('.svg') ? fallback : barber.imagePath, fallback };
}

/** A chair on the floor: photo, chair number, barber, what they cut. */
export function BarberCard({ barber, priority = false }: BarberCardProps) {
  const photo = barberPhoto(barber);
  const specialties = (barber.specialties || []).slice(0, 3);

  return (
    <Link href={`/book?barber=${encodeURIComponent(barber.id)}`} className="sf-chair">
      <div className="sf-chair-photo">
        <StorefrontImage
          src={photo.src}
          fallbackSrc={photo.fallback}
          alt={`${barber.displayName} at ${barber.chairNumber ? `chair ${barber.chairNumber}` : 'the shop'}`}
          priority={priority}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {barber.chairNumber ? <span className="sf-chair-no">Chair {barber.chairNumber}</span> : null}
      </div>
      <div className="sf-chair-name">
        <h3 className="sf-subtitle">{barber.displayName}</h3>
        <ArrowUpRight aria-hidden="true" />
      </div>
      {barber.bio ? <p className="sf-small sf-muted">{barber.bio}</p> : null}
      {specialties.length ? <ul className="sf-chair-tags" aria-label={`${barber.displayName} services`}>{specialties.map((service) => <li key={service.id} className="sf-tag">{service.name}</li>)}</ul> : null}
    </Link>
  );
}
