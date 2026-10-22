import Link from 'next/link';
import { formatDuration, formatMoney } from '../lib/format';
import type { StorefrontService } from '../lib/data/services';

type MenuListProps = {
  categories: Array<{
    id: string;
    name: string;
    description?: string | null;
    services: StorefrontService[];
  }>;
  barberCount: number;
  /** Caps the number of services shown across all categories (home page). */
  limit?: number;
  showDescriptions?: boolean;
};

/** The shop's price board: service, dotted leader, price; duration and barbers below. */
export function MenuList({ categories, barberCount, limit, showDescriptions = false }: MenuListProps) {
  const cap = limit ?? Number.POSITIVE_INFINITY;
  const offsets = categories.map((_, index) => categories.slice(0, index).reduce((total, category) => total + category.services.length, 0));
  return (
    <div>
      {categories.map((category, index) => {
        const services = category.services.slice(0, Math.max(0, cap - offsets[index]));
        if (!services.length) return null;
        return (
          <section key={category.id} className="sf-board-group" aria-labelledby={`category-${category.id}`}>
            <h3 id={`category-${category.id}`} className="sf-eyebrow">{category.name}</h3>
            {showDescriptions && category.description ? <p className="sf-board-desc mb-2">{category.description}</p> : null}
            <ul>
              {services.map((service) => {
                const barbers = service.specialists?.length || barberCount;
                return (
                  <li key={service.id}>
                    <Link href={`/services/${service.id}`} className="sf-board-row">
                      <span className="sf-board-name"><span>{service.name}</span></span>
                      <span className="sf-board-price">{formatMoney(service.price)}</span>
                      <span className="sf-board-meta">
                        <span className="sf-mono">{formatDuration(service.durationMinutes)}</span>
                        <span>{barbers} {barbers === 1 ? 'barber' : 'barbers'}</span>
                        {service.depositRequired ? <span>Deposit {formatMoney(service.depositAmount || 0)}</span> : null}
                      </span>
                      {showDescriptions && service.description ? <span className="sf-board-desc">{service.description}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
