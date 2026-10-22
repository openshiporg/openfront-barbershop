import Link from 'next/link';
import { phoneHref } from '@/features/shared/storefront-settings';
import { MenuList } from '../components/MenuList';
import { getAllBarbers, getServiceCategories } from '../lib/data/services';
import { getPublicStorefrontSettings } from '../lib/data/settings';
import { StorefrontShell } from './StorefrontShell';

export default async function ServicesPage() {
  const [categories, barbers, settings] = await Promise.all([
    getServiceCategories(),
    getAllBarbers(),
    getPublicStorefrontSettings(),
  ]);
  if (!settings) return <StorefrontShell><></></StorefrontShell>;
  const serviceCount = categories.reduce((total, category) => total + category.services.length, 0);
  const telephoneHref = phoneHref(settings.phone);

  return (
    <StorefrontShell>
      <main id="main-content">
        <section className="sf-container sf-page-head">
          <p className="sf-eyebrow">{serviceCount} {serviceCount === 1 ? 'service' : 'services'} · {categories.filter((category) => category.services.length).length} categories</p>
          <div className="sf-page-head-row">
            <h1 className="sf-display">Services</h1>
            <div className="sf-track">
              <Link href="/book" className="sf-pill is-primary">Book a chair</Link>
              <Link href="/queue" className="sf-pill">Join walk-ins</Link>
            </div>
          </div>
        </section>

        <section className="sf-board sf-on-dark sf-section" aria-label="Price board">
          <div className="sf-container">
            {serviceCount ? (
              <MenuList categories={categories} barberCount={barbers.length} showDescriptions />
            ) : (
              <div className="grid gap-3">
                <p className="sf-subtitle">No services listed online</p>
                {telephoneHref && settings.phone ? <a className="sf-link" href={`tel:${telephoneHref}`}>Call {settings.phone}</a> : null}
              </div>
            )}
          </div>
        </section>
      </main>
    </StorefrontShell>
  );
}
