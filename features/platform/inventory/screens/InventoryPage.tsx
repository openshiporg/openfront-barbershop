import Link from 'next/link';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { Input } from '@/components/ui/input';
import { DataTable, Empty, Notice, PageHeader, Pill, PillLink, Section, StatusCell, StatusTabs, Td, type Tone } from '@/features/platform/lib/ui';
import { getStockAction, type StockProduct } from '../actions/inventory';
import { ReceiveDeliveryButton } from '../components/InventoryControls';

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'page' as const, label: 'Platform' },
  { type: 'page' as const, label: 'Inventory' },
];
const money = (cents?: number | null) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100);
const num = 'text-right tabular-nums whitespace-nowrap';

function status(product: StockProduct): { tone: Tone; text: string } {
  if (product.low) return { tone: 'wait', text: product.onHand ? 'Low' : 'Out' };
  if (product.status === 'active') return { tone: 'live', text: 'For sale' };
  if (product.status === 'draft') return { tone: 'info', text: 'Draft' };
  return { tone: 'off', text: 'Archived' };
}

function ProductTable({ label, products, suppliers }: { label: string; products: StockProduct[]; suppliers: Array<{ id: string; name: string }> }) {
  return (
    <DataTable label={label} className="relative" head={[
      { label: 'Product' },
      { label: 'On hand', className: 'text-right' },
      { label: 'Sold, 30 days', className: 'hidden text-right sm:table-cell' },
      { label: 'Price', className: 'hidden text-right md:table-cell' },
      { label: 'Cost', className: 'hidden text-right lg:table-cell' },
      { label: 'Status', className: 'hidden sm:table-cell' },
      { label: <span className="sr-only">Actions</span>, className: 'w-px' },
    ]}>
      {products.map((product) => {
        const state = status(product);
        return (
          <tr key={product.id} className="hover:bg-muted/30">
            <Td className="align-middle">
              <Link href={`/dashboard/platform/inventory/${product.id}`} className="block truncate font-medium underline-offset-4 hover:underline">{product.name}</Link>
              <span className="block font-mono text-xs text-muted-foreground">{product.sku || 'No SKU'}</span>
            </Td>
            <Td className={`${num} align-middle font-medium ${product.low ? 'text-amber-700 dark:text-amber-400' : ''}`}>{product.inventoryTracked ? product.onHand : <span className="font-normal text-muted-foreground">Not tracked</span>}</Td>
            <Td className={`${num} hidden align-middle sm:table-cell`}>{product.soldLast30}</Td>
            <Td className={`${num} hidden align-middle md:table-cell`}>{money(product.price)}</Td>
            <Td className={`${num} hidden align-middle text-muted-foreground lg:table-cell`}>{money(product.cost)}</Td>
            <Td className="hidden align-middle sm:table-cell"><StatusCell tone={state.tone}>{state.text}</StatusCell></Td>
            <Td className="align-middle text-right">{product.inventoryTracked && product.status !== 'archived' ? <ReceiveDeliveryButton compact productId={product.id} productName={product.name} suppliers={suppliers} cost={product.cost} /> : null}</Td>
          </tr>
        );
      })}
    </DataTable>
  );
}

export default async function InventoryPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const data = await getStockAction({ status: typeof params.status === 'string' ? params.status : undefined, search: typeof params.q === 'string' ? params.q : undefined });
  const actions = <div className="flex flex-wrap items-center gap-1.5"><PillLink href="/dashboard/platform/inventory/suppliers">Suppliers</PillLink><PillLink variant="primary" href="/dashboard/platform/services/new-product">New product</PillLink></div>;
  if (!data) return <PageContainer title="Inventory" header={<PageHeader title="Inventory" tone="alert" meta="Inventory couldn’t load" actions={actions} />} breadcrumbs={breadcrumbs}><div className="px-4 pb-8 md:px-6"><Notice tone="alert">Inventory couldn’t load.</Notice></div></PageContainer>;
  const href = (value: string) => `?${new URLSearchParams({ ...(value ? { status: value } : {}), ...(data.search ? { q: data.search } : {}) }).toString()}`;
  const value = data.products.filter((product) => product.status === 'active').reduce((sum, product) => sum + product.onHand * product.cost, 0);
  const low = !data.status && !data.search ? data.products.filter((product) => product.low).sort((a, b) => a.onHand - b.onHand || b.soldLast30 - a.soldLast30) : [];
  const header = (
    <PageHeader
      title="Inventory"
      tone={data.counts.low ? 'wait' : undefined}
      meta={`${data.counts.low ? `${data.counts.low} to reorder` : 'Nothing to reorder'} · ${money(value)} at cost on hand`}
      actions={actions}
    />
  );
  return (
    <PageContainer title="Inventory" header={header} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-8 px-4 pb-24 md:px-6">
        {low.length ? (
          <Section id="inventory-low" title="Needs reordering" tone="wait" count={low.length}>
            <ProductTable label="Needs reordering" products={low} suppliers={data.suppliers} />
          </Section>
        ) : null}

        <Section id="inventory-all" title="Products">
          <div className="flex flex-col gap-3 pb-3 lg:flex-row lg:items-end lg:justify-between">
            <StatusTabs label="Product status" current={data.status} hrefFor={href} tabs={[
              { value: '', label: 'All', count: data.counts[''] },
              { value: 'active', label: 'For sale', count: data.counts.active },
              { value: 'low', label: 'Low stock', count: data.counts.low, tone: data.counts.low ? 'wait' : undefined },
              { value: 'draft', label: 'Draft', count: data.counts.draft },
              { value: 'archived', label: 'Archived', count: data.counts.archived },
            ]} />
            <form role="search" action="/dashboard/platform/inventory" className="flex items-center gap-2">
              {data.status ? <input type="hidden" name="status" value={data.status} /> : null}
              <Input name="q" defaultValue={data.search} aria-label="Find a product" placeholder="Name or SKU" className="h-9 w-full rounded-[6px] sm:w-56" />
              <Pill type="submit" size="sm">Search</Pill>
            </form>
          </div>
          {!data.products.length ? <Empty>{data.search ? `No products match “${data.search}”.` : 'No products here.'}</Empty> : <ProductTable label="Products" products={data.products} suppliers={data.suppliers} />}
        </Section>
      </div>
    </PageContainer>
  );
}
