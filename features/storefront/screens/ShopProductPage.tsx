import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { phoneHref } from '@/features/shared/storefront-settings';
import { StorefrontImage } from '../components/StorefrontImage';
import { productArt } from '../components/productArt';
import { getRetailProducts } from '../lib/data/services';
import { getPublicStorefrontSettings } from '../lib/data/settings';
import { formatMoney } from '../lib/format';
import { StorefrontShell } from './StorefrontShell';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = (await getRetailProducts().catch(() => [])).find((item) => item.id === id);
  return product ? { title: product.name, description: product.description || undefined } : { title: 'Page not found' };
}

export default async function ShopProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [products, settings] = await Promise.all([getRetailProducts(), getPublicStorefrontSettings()]);
  const product = products.find((item) => item.id === id);
  if (!product || !settings) notFound();
  const telephone = phoneHref(settings.phone);
  const art = productArt(product);
  return (
    <StorefrontShell>
      <main id="main-content" className="sf-container pb-[var(--space-3xl)]">
        <Link href="/shop" className="sf-arrow-link mt-4"><ArrowLeft aria-hidden="true" /> Shop</Link>
        <div className="mt-4 grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="sf-product-art">
            {art ? <StorefrontImage src={art} fallbackSrc={art} alt={product.name} priority sizes="(max-width: 1024px) 100vw, 50vw" /> : <span className="sf-product-label" aria-hidden="true">{product.name}</span>}
          </div>
          <div className="grid content-start gap-6">
            <h1 className="sf-display sf-h1">{product.name}</h1>
            {product.description ? <p className="sf-lead">{product.description}</p> : null}
            <dl className="sf-ledger">
              <div><dt>Price</dt><dd className="sf-mono">{formatMoney(product.price)}</dd></div>
              {product.sku ? <div><dt>SKU</dt><dd className="sf-mono">{product.sku}</dd></div> : null}
              <div><dt>Buy</dt><dd>At the counter</dd></div>
            </dl>
            <div className="sf-actions">
              {telephone && settings.phone ? <a href={`tel:${telephone}`} className="sf-btn is-primary">Call to hold one</a> : null}
              <Link href="/book" className="sf-btn">Book a time</Link>
            </div>
          </div>
        </div>
      </main>
    </StorefrontShell>
  );
}
