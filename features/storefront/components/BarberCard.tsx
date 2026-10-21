import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { StorefrontBarber } from '../lib/data/services';
import { StorefrontImage } from './StorefrontImage';

type BarberCardProps = {
  barber: StorefrontBarber;
  variant?: 'light' | 'dark';
};

const barberFallbacks: Record<string, string> = {
  'Maya Brooks': '/images/barbershop/photo/clipper-fade.webp',
  'Andre Miles': '/images/barbershop/photo/scissor-cut.webp',
  'Leo Chen': '/images/barbershop/photo/barber-at-work.webp',
};

export function BarberCard({ barber, variant = 'light' }: BarberCardProps) {
  const image = barber.imagePath?.endsWith('.svg') ? barberFallbacks[barber.displayName] : barber.imagePath;

  return (
    <Link href={`/book?barber=${barber.id}`} className={`sf-barber-card ${variant === 'dark' ? 'is-dark' : ''}`}>
      <StorefrontImage
        src={image}
        fallbackSrc={barberFallbacks[barber.displayName] || '/images/barbershop/photo/barber-at-work.webp'}
        alt={`${barber.displayName} working at ${barber.chairNumber ? `chair ${barber.chairNumber}` : 'the shop'}`}
        className="sf-barber-photo"
        priority
        sizes="(max-width: 640px) 100vw, 33vw"
      />
      <div className="sf-barber-meta">
        <div className="sf-barber-name-row">
          <div>
            <p>{barber.chairNumber ? `Chair ${barber.chairNumber}` : 'Bookable barber'}</p>
            <h3>{barber.displayName}</h3>
          </div>
          <ArrowUpRight aria-hidden="true" />
        </div>
        <p className="sf-barber-bio">{barber.bio || 'Choose this barber to view live service times.'}</p>
        <p className="sf-barber-specialties">{(barber.specialties || []).slice(0, 3).map((service) => service.name).join(' · ') || 'General barbering'}</p>
      </div>
    </Link>
  );
}
