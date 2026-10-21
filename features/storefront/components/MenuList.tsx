import Link from 'next/link';
import { formatDuration, formatMoney } from '../lib/format';
import type { StorefrontService } from '../lib/data/services';
import { StorefrontImage } from './StorefrontImage';

type MenuListProps = {
  categories: Array<{
    id: string;
    name: string;
    description?: string | null;
    services: StorefrontService[];
  }>;
  barberCount: number;
};

const serviceFallbacks = [
  '/images/barbershop/photo/scissor-cut.webp',
  '/images/barbershop/photo/clipper-fade.webp',
  '/images/barbershop/photo/barber-at-work.webp',
  '/images/barbershop/photo/beard-detail.webp',
  '/images/barbershop/photo/chair-service.webp',
  '/images/barbershop/photo/shop-floor.webp',
];

export function MenuList({ categories, barberCount }: MenuListProps) {
  let serviceIndex = 0;
  return (
    <div className="space-y-[var(--space-3xl)]">
      {categories.map((category) => (
        <section key={category.id}>
          <div className="mb-[var(--space-lg)] flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="sf-display text-[var(--text-title)]">{category.name}</h2>
            {category.description && (
              <p className="max-w-md text-[var(--text-small)] text-[var(--color-ink-muted)]">{category.description}</p>
            )}
          </div>

          <ul className="divide-y divide-[var(--color-rule)] border-y border-[var(--color-rule)]">
            {category.services.map((service) => {
              const fallback = serviceFallbacks[serviceIndex++ % serviceFallbacks.length];
              const image = service.imagePath?.endsWith('.svg') ? fallback : service.imagePath;
              return (
              <li key={service.id}>
                <Link
                  href={`/services/${service.id}`}
                  className="group grid gap-4 py-[var(--space-lg)] no-underline transition-colors hover:bg-[var(--color-paper-2)] sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-start sm:gap-6 sm:px-3"
                >
                  <StorefrontImage
                    src={image}
                    fallbackSrc={fallback}
                    alt={`${service.name} service`}
                    className="aspect-[4/3] border border-[var(--color-rule)]"
                    sizes="(max-width: 640px) 100vw, 144px"
                  />
                  <div className="min-w-0">
                    <h3 className="sf-display text-[1.5rem] text-[var(--color-ink)] transition-colors group-hover:text-[var(--color-accent)]">
                      {service.name}
                    </h3>
                    {service.description && (
                      <p className="mt-2 max-w-2xl text-[var(--text-small)] leading-relaxed text-[var(--color-ink-muted)]">
                        {service.description}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[var(--text-caption)] font-medium uppercase tracking-[0.08em] text-[var(--color-ink-2)]">
                      <span>{formatDuration(service.durationMinutes)}</span>
                      <span>
                        {(service.specialists?.length || barberCount)} {(service.specialists?.length || barberCount) === 1 ? 'barber' : 'barbers'}
                      </span>
                      {service.depositRequired && (
                        <span>Deposit {formatMoney(service.depositAmount || 0)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:pt-1">
                    <span className="sf-display text-[1.75rem] tabular-nums text-[var(--color-ink)]">
                      {formatMoney(service.price)}
                    </span>
                    <span className="text-[var(--text-caption)] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">
                      Details ↗
                    </span>
                  </div>
                </Link>
              </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
