import Link from 'next/link';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { Input } from '@/components/ui/input';
import { StatusTabs } from '@/features/platform/lib/forms';
import { Empty, Notice, PageHeader, Pill, PillLink, Readouts, Section, StatusDot, Track, type Tone } from '@/features/platform/lib/ui';
import { getStockAction } from '../actions/inventory';

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'page' as const, label: 'Platform' },
  { type: 'page' as const, label: 'Inventory' },
];
const money = (cents?: number | null) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100);
const tone = (status: string, low: boolean): Tone => (low ? 'wait' : status === 'active' ? 'live' : status === 'draft' ? 'info' : 'off');

export default async function InventoryPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const data = await getStockAction({ status: typeof params.status === 'string' ? params.status : undefined, search: typeof params.q === 'string' ? params.q : undefined });
  const header = <PageHeader title="Inventory" tone={data ? (data.counts.low ? 'wait' : 'live') : 'alert'} meta={data?.shopName} actions={<Track><PillLink href="/dashboard/platform/inventory/suppliers">Suppliers</PillLink><PillLink variant="primary" href="/dashboard/platform/services/new-product">New product</PillLink></Track>} />;
  if (!data) return <PageContainer title="Inventory" header={header} breadcrumbs={breadcrumbs}><div className="px-4 pb-8 md:px-6"><Notice tone="alert">Inventory couldn’t load.</Notice></div></PageContainer>;
  const href = (status: string) => `?${new URLSearchParams({ ...(status ? { status } : {}), ...(data.search ? { q: data.search } : {}) }).toString()}`;
  const active = data.products.filter((product) => product.status === 'active');
  return (
    <PageContainer title="Inventory" header={header} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-6 px-4 pb-8 md:px-6">
        <Readouts items={[
          { label: 'Products for sale', value: data.counts.active },
          { label: 'Low stock', value: data.counts.low, tone: data.counts.low ? 'wait' : undefined },
          { label: 'Units on hand', value: data.products.reduce((sum, product) => sum + product.onHand, 0) },
          { label: 'Stock value at cost', value: money(active.reduce((sum, product) => sum + product.onHand * product.cost, 0)) },
        ]} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <StatusTabs current={data.status} hrefFor={href} tabs={[
            { value: '', label: 'All', count: data.counts[''] },
            { value: 'active', label: 'For sale', count: data.counts.active, tone: 'live' },
            { value: 'low', label: 'Low stock', count: data.counts.low, tone: 'wait' },
            { value: 'draft', label: 'Draft', count: data.counts.draft, tone: 'info' },
            { value: 'archived', label: 'Archived', count: data.counts.archived, tone: 'off' },
          ]} />
          <form role="search" action="/dashboard/platform/inventory" className="flex items-center gap-2">
            {data.status ? <input type="hidden" name="status" value={data.status} /> : null}
            <Input name="q" defaultValue={data.search} aria-label="Find a product" placeholder="Name or SKU" className="w-48" />
            <Track><Pill type="submit" size="sm">Search</Pill></Track>
          </form>
        </div>
        <Section title="Products" count={data.products.length}>
          {!data.products.length ? <Empty>No products here.</Empty> : (
            <ul>
              {data.products.map((product) => (
                <li key={product.id}>
                  <Link href={`/dashboard/platform/inventory/${product.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-b py-2.5 hover:bg-muted/40">
                    <span className="min-w-0 truncate font-medium"><StatusDot tone={tone(product.status, product.low)} />{product.name}<span className="ml-2 font-mono text-xs font-normal text-muted-foreground">{product.sku || ''}</span></span>
                    <span className="font-mono tabular-nums">{product.inventoryTracked ? `${product.onHand} on hand` : 'Not tracked'}</span>
                    <span className="col-span-2 pl-4 text-xs text-muted-foreground">{money(product.price)} · cost {money(product.cost)} · {product.soldLast30} sold in 30 days{product.low ? ' · reorder' : ''}{product.status !== 'active' ? ` · ${product.status}` : ''}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </PageContainer>
  );
}
