import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { Empty, Notice, PageHeader, PillLink, Section, StatusDot, Track } from '@/features/platform/lib/ui';
import { getSuppliersAction } from '../actions/inventory';
import { NewSupplierButton, SupplierActions } from '../components/InventoryControls';

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'link' as const, label: 'Inventory', href: '/dashboard/platform/inventory' },
  { type: 'page' as const, label: 'Suppliers' },
];

export default async function SuppliersPage() {
  const data = await getSuppliersAction();
  const header = <PageHeader title="Suppliers" meta={data?.shopName} actions={<Track><PillLink href="/dashboard/platform/inventory">Inventory</PillLink>{data ? <NewSupplierButton /> : null}</Track>} />;
  return (
    <PageContainer title="Suppliers" header={header} breadcrumbs={breadcrumbs}>
      <div className="px-4 pb-8 md:px-6">
        {!data ? <Notice tone="alert">Select an active shop first.</Notice> : (
          <Section title="Suppliers" count={data.suppliers.length}>
            {!data.suppliers.length ? <Empty>No suppliers yet.</Empty> : (
              <ul>
                {data.suppliers.map((supplier) => (
                  <li key={supplier.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0">
                    <span className="min-w-0"><span className="font-medium"><StatusDot tone={supplier.status === 'active' ? 'live' : supplier.status === 'paused' ? 'wait' : 'off'} />{supplier.name}</span><span className="block truncate text-xs text-muted-foreground">{supplier.contactName || 'No contact'} · {supplier.email || supplier.phone || 'no details'} · {supplier.inventoryLotsCount} {supplier.inventoryLotsCount === 1 ? 'delivery' : 'deliveries'}</span></span>
                    <SupplierActions supplier={supplier} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}
      </div>
    </PageContainer>
  );
}
