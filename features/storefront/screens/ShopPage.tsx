import Link from 'next/link';
import { phoneHref } from '@/features/shared/storefront-settings';
import { StorefrontImage } from '../components/StorefrontImage';
import { productArt } from '../components/productArt';
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
          <div className="sf-page-head-row">
            <h1 className="sf-display">Shop</h1>
            {telephone && settings.phone ? <div className="sf-actions"><a href={`tel:${telephone}`} className="sf-btn">Call to hold one</a></div> : null}
          </div>
          <p className="sf-lead">Sold at the counter. There’s no online checkout; pick it up on your visit.</p>
        </section>
        <section className="sf-container sf-section is-tight">
          {products === null ? <p role="alert" className="sf-notice is-error">Products couldn’t load. Try again in a moment.</p>
            : !products.length ? <p className="sf-muted">No products listed.</p>
            : [...groups.entries()].map(([type, items]) => (
              <section key={type} aria-labelledby={`shop-${type}`} className="mb-[var(--space-2xl)]">
                <h2 id={`shop-${type}`} className="sf-subtitle mb-4 border-b-[3px] border-current pb-2">{TYPE[type] || type}</h2>
                <div className="sf-product-grid">
                  {items.map((product) => {
                    const art = productArt(product);
                    return (
                      <Link key={product.id} href={`/shop/${encodeURIComponent(product.id)}`} className="sf-product">
                        <div className="sf-product-art">
                          {art ? <StorefrontImage src={art} fallbackSrc={art} alt={product.name} sizes="(max-width: 640px) 50vw, 33vw" /> : <span className="sf-product-label" aria-hidden="true">{product.name}</span>}
                        </div>
                        <div className="sf-product-name"><h3>{product.name}</h3><span className="sf-product-price">{formatMoney(product.price)}</span></div>
                        {product.description ? <p className="sf-small sf-muted">{product.description}</p> : null}
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
        </section>
      </main>
    </StorefrontShell>
  );
}
