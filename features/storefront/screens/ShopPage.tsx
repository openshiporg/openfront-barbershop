import Link from 'next/link';
import { phoneHref } from '@/features/shared/storefront-settings';
import { StorefrontImage } from '../components/StorefrontImage';
import { getRetailProducts, type StorefrontProduct } from '../lib/data/services';
import { getPublicStorefrontSettings } from '../lib/data/settings';
import { formatMoney } from '../lib/format';
import { StorefrontShell } from './StorefrontShell';

const TYPE: Record<string, string> = { pomade: 'Pomade', beard_care: 'Beard care', shampoo: 'Shampoo', tool: 'Tools', other: 'Other' };

/** Retail for sale at the counter; there is no online checkout. */
export default async function ShopPage() {
  const [settings, products] = await Promise.all([getPublicStorefrontSettings(), getRetailProducts().catch(() => null as StorefrontProduct[] | null)]);
  if (!settings) return <StorefrontShell><></></StorefrontShell>;
  const telephone = phoneHref(settings.phone);
  const groups = new Map<string, StorefrontProduct[]>();
  for (const product of products || []) {
    const key = product.productType || 'other';
    groups.set(key, [...(groups.get(key) || []), product]);
  }
  return (
    <StorefrontShell>
      <main id="main-content">
        <section className="sf-container sf-page-head">
          <p className="sf-eyebrow">Sold at the counter</p>
          <div className="sf-page-head-row">
            <h1 className="sf-display">Shop</h1>
            <div className="sf-track">
              <Link href="/book" className="sf-pill is-primary">Book a chair</Link>
              {telephone && settings.phone ? <a href={`tel:${telephone}`} className="sf-pill">Call {settings.phone}</a> : null}
            </div>
          </div>
        </section>
        <section className="sf-container sf-section pt-[var(--space-xl)]">
          {products === null ? <p role="alert" className="sf-notice is-error">Products couldn’t load. Try again in a moment.</p>
            : !products.length ? <p className="sf-muted">No products listed.</p>
            : [...groups.entries()].map(([type, items]) => (
              <section key={type} aria-labelledby={`shop-${type}`} className="mb-[var(--space-2xl)]">
                <h2 id={`shop-${type}`} className="sf-eyebrow mb-4">{TYPE[type] || type}</h2>
                <div className="sf-chair-grid">
                  {items.map((product) => (
                    <Link key={product.id} href={`/shop/${encodeURIComponent(product.id)}`} className="sf-chair">
                      <div className="sf-chair-photo"><StorefrontImage src={product.imagePath?.endsWith('.svg') ? undefined : product.imagePath} fallbackSrc="/images/barbershop/photo/shop-floor.webp" alt={product.name} sizes="(max-width: 640px) 100vw, 33vw" /></div>
                      <div className="sf-chair-name"><h3 className="sf-subtitle">{product.name}</h3><span className="sf-mono">{formatMoney(product.price)}</span></div>
                      {product.description ? <p className="sf-small sf-muted">{product.description}</p> : null}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
        </section>
      </main>
    </StorefrontShell>
  );
}
