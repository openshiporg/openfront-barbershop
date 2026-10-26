import Link from 'next/link';
import { phoneHref } from '@/features/shared/storefront-settings';
import { StorefrontImage } from '../components/StorefrontImage';
import { productArt } from '../components/productArt';
import { getRetailProducts, type StorefrontProduct } from '../lib/data/services';
import { getPublicStorefrontSettings } from '../lib/data/settings';
import { formatMoney } from '../lib/format';
import { StorefrontShell } from './StorefrontShell';

const TYPE: Record<string, string> = { pomade: 'Pomade', beard_care: 'Beard care', shampoo: 'Shampoo', tool: 'Tools', other: 'Other' };
const typeLabel = (type: string) => TYPE[type] || type;

/** Products with their own image: shown as the product itself. */
function ProductGrid({ items }: { items: Array<{ product: StorefrontProduct; art: string }> }) {
  if (!items.length) return null;
  return (
    <div className="sf-product-grid">
      {items.map(({ product, art }) => (
        <Link key={product.id} href={`/shop/${encodeURIComponent(product.id)}`} className="sf-product">
          <div className="sf-product-art">
            <StorefrontImage src={art} fallbackSrc={art} alt={product.name} sizes="(max-width: 640px) 50vw, 33vw" />
          </div>
          <div className="sf-product-name"><h3>{product.name}</h3><span className="sf-product-price">{formatMoney(product.price)}</span></div>
          {product.description ? <p className="sf-small sf-muted">{product.description}</p> : null}
        </Link>
      ))}
    </div>
  );
}

/** Products without an image: set on the price-board rail (name · kind · price), no empty plate. */
function ProductRail({ items, showType }: { items: StorefrontProduct[]; showType: boolean }) {
  if (!items.length) return null;
  return (
    <ul className="sf-rail">
      {items.map((product) => (
        <li key={product.id}>
          <Link href={`/shop/${encodeURIComponent(product.id)}`} className="sf-board-row">
            <span className="sf-board-name">{product.name}</span>
            <span className="sf-board-dur">{showType ? typeLabel(product.productType || 'other') : ''}</span>
            <span className="sf-board-price">{formatMoney(product.price)}</span>
            {product.description ? <span className="sf-board-desc">{product.description}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

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
  const split = (items: StorefrontProduct[]) => {
    const pictured: Array<{ product: StorefrontProduct; art: string }> = [];
    const plain: StorefrontProduct[] = [];
    for (const product of items) {
      const art = productArt(product);
      if (art) pictured.push({ product, art });
      else plain.push(product);
    }
    return { pictured, plain };
  };
  /** One item per kind would leave each row two-thirds empty: set them as one list. */
  const flat = groups.size > 1 && [...groups.values()].every((items) => items.length === 1);
  const all = flat ? split(products || []) : null;
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
            : all ? (
              <div className="sf-shop-list">
                <ProductGrid items={all.pictured} />
                <ProductRail items={all.plain} showType />
              </div>
            )
            : [...groups.entries()].map(([type, items]) => {
              const { pictured, plain } = split(items);
              return (
                <section key={type} aria-labelledby={`shop-${type}`} className="sf-shop-list mb-[var(--space-2xl)]">
                  <h2 id={`shop-${type}`} className="sf-subtitle border-b-[3px] border-current pb-2">{typeLabel(type)}</h2>
                  <ProductGrid items={pictured} />
                  <ProductRail items={plain} showType={false} />
                </section>
              );
            })}
        </section>
      </main>
    </StorefrontShell>
  );
}
