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
          <div className="sf-page-head-row">
            <h1 className="sf-display">Services</h1>
            <div className="sf-actions">
              <Link href="/queue" className="sf-btn">Join the line</Link>
              <Link href="/book" className="sf-btn is-primary">Book a time</Link>
            </div>
          </div>
          <p className="sf-lead">{serviceCount} {serviceCount === 1 ? 'service' : 'services'}. Deposits are listed where a service takes one.</p>
        </section>

        <section className="sf-section is-tight" aria-label="Price board">
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
