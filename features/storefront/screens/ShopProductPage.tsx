import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { phoneHref } from '@/features/shared/storefront-settings';
import { StorefrontImage } from '../components/StorefrontImage';
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
  return (
    <StorefrontShell>
      <main id="main-content" className="sf-container pb-[var(--space-3xl)]">
        <Link href="/shop" className="sf-arrow-link mt-4"><ArrowLeft aria-hidden="true" /> Shop</Link>
        <div className="mt-4 grid gap-8 lg:grid-cols-2 lg:gap-12">
          <StorefrontImage src={product.imagePath?.endsWith('.svg') ? undefined : product.imagePath} fallbackSrc="/images/barbershop/photo/shop-floor.webp" alt={product.name} className="aspect-square rounded-[var(--radius-lg)]" priority sizes="(max-width: 1024px) 100vw, 50vw" />
          <div className="grid content-start gap-6">
            <h1 className="sf-display text-[var(--text-display-s)]">{product.name}</h1>
            {product.description ? <p className="sf-lead">{product.description}</p> : null}
            <dl className="sf-ledger">
              <div><dt>Price</dt><dd className="sf-mono">{formatMoney(product.price)}</dd></div>
              {product.sku ? <div><dt>SKU</dt><dd className="sf-mono">{product.sku}</dd></div> : null}
              <div><dt>Buy</dt><dd>At the counter</dd></div>
            </dl>
            <div className="sf-track">
              <Link href="/book" className="sf-pill is-primary">Book a chair</Link>
              {telephone && settings.phone ? <a href={`tel:${telephone}`} className="sf-pill">Call to hold one</a> : null}
            </div>
          </div>
        </div>
      </main>
    </StorefrontShell>
  );
}
