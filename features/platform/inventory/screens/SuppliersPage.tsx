import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { DataTable, Empty, Notice, PageHeader, PillLink, StatusCell, Td, type Tone } from '@/features/platform/lib/ui';
import { getStockAction, getSuppliersAction } from '../actions/inventory';
import { NewSupplierButton, ReceiveFromSupplierButton, SupplierActions } from '../components/InventoryControls';

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'link' as const, label: 'Inventory', href: '/dashboard/platform/inventory' },
  { type: 'page' as const, label: 'Suppliers' },
];
const tone = (status: string): Tone => (status === 'active' ? 'live' : status === 'paused' ? 'wait' : 'off');
const STATUS: Record<string, string> = { active: 'In use', paused: 'Paused', archived: 'Archived' };

export default async function SuppliersPage() {
  const [data, stock] = await Promise.all([getSuppliersAction(), getStockAction({})]);
  const receivable = (stock?.products || []).filter((product) => product.inventoryTracked && product.status !== 'archived').map((product) => ({ id: product.id, name: product.name, cost: product.cost, onHand: product.onHand, low: product.low }));
  const active = data?.suppliers.filter((supplier) => supplier.status === 'active').length ?? 0;
  const header = <PageHeader title="Suppliers" meta={data ? `${active} in use${stock?.counts.low ? ` · ${stock.counts.low} products to reorder` : ''}` : undefined} actions={<div className="flex flex-wrap items-center gap-1.5"><PillLink href="/dashboard/platform/inventory">Inventory</PillLink>{data ? <NewSupplierButton /> : null}</div>} />;
  return (
    <PageContainer title="Suppliers" header={header} breadcrumbs={breadcrumbs}>
      <div className="px-4 pb-24 md:px-6">
        {!data ? <Notice tone="alert">Select an active shop first.</Notice> : !data.suppliers.length ? <Empty>No suppliers yet.</Empty> : (
          <DataTable label="Suppliers" className="relative" head={[
            { label: 'Supplier' },
            { label: 'Contact', className: 'hidden md:table-cell' },
            { label: 'Deliveries', className: 'hidden text-right sm:table-cell' },
            { label: 'Status', className: 'hidden sm:table-cell' },
            { label: <span className="sr-only">Actions</span>, className: 'w-px' },
          ]}>
            {data.suppliers.map((supplier) => (
              <tr key={supplier.id} className="hover:bg-muted/30">
                <Td className="align-middle">
                  <span className="block font-medium">{supplier.name}</span>
                  <span className="block truncate text-xs text-muted-foreground md:hidden">{supplier.contactName || supplier.phone || supplier.email || 'No contact'}</span>
                </Td>
                <Td className="hidden align-middle md:table-cell">
                  <span className="block">{supplier.contactName || <span className="text-muted-foreground">No contact</span>}</span>
                  <span className="block text-xs text-muted-foreground">{[supplier.phone, supplier.email].filter(Boolean).map((value, index) => <span key={value}>{index ? ' · ' : ''}{value?.includes('@') ? <a className="underline-offset-4 hover:underline" href={`mailto:${value}`}>{value}</a> : <a className="underline-offset-4 hover:underline" href={`tel:${value}`}>{value}</a>}</span>)}</span>
                </Td>
                <Td className="hidden align-middle text-right tabular-nums sm:table-cell">{supplier.inventoryLotsCount}</Td>
                <Td className="hidden align-middle sm:table-cell"><StatusCell tone={tone(supplier.status)}>{STATUS[supplier.status] || supplier.status}</StatusCell></Td>
                <Td className="align-middle text-right">
                  <span className="inline-flex items-center gap-1">
                    {supplier.status === 'active' ? <ReceiveFromSupplierButton supplier={{ id: supplier.id, name: supplier.name }} products={receivable} /> : null}
                    <SupplierActions supplier={supplier} />
                  </span>
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </PageContainer>
  );
}
