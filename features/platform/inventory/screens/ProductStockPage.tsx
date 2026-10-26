import { notFound } from 'next/navigation';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { formatShopDateTime } from '@/features/shared/shop-time';
import { DataTable, Empty, PageHeader, PillLink, Readouts, Section, StatusCell, Td, type Tone } from '@/features/platform/lib/ui';
import { getProductDetailAction } from '../actions/inventory';
import { AdjustStockButton, ReceiveDeliveryButton } from '../components/InventoryControls';

const money = (cents?: number | null) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100);
const MOVEMENT: Record<string, string> = { receive: 'Received', sale: 'Sold', return: 'Returned', waste: 'Waste', adjustment: 'Count correction' };

export default async function ProductStockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getProductDetailAction(id);
  if (!data) notFound();
  const { product, timezone } = data;
  const tone: Tone = product.low ? 'wait' : product.status === 'active' ? 'live' : 'off';
  const activeLots = data.lots.filter((lot) => lot.status === 'active' && (lot.quantityRemaining || 0) > 0);
  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'link' as const, label: 'Inventory', href: '/dashboard/platform/inventory' },
    { type: 'page' as const, label: product.name },
  ];
  const header = (
    <PageHeader title={product.name} tone={tone} meta={`${product.sku || 'No SKU'} · ${money(product.price)} · ${product.status === 'active' ? 'for sale' : product.status}`}
      actions={<div className="flex flex-wrap items-center gap-1.5"><PillLink href={`/dashboard/platform/services/products/${product.id}`}>Edit details</PillLink><AdjustStockButton productId={product.id} lots={activeLots} /><ReceiveDeliveryButton productId={product.id} suppliers={data.suppliers} cost={product.cost} /></div>} />
  );
  return (
    <PageContainer title={product.name} header={header} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-8 px-4 pb-24 md:px-6">
        <Readouts items={[
          { label: 'On hand', value: product.inventoryTracked ? product.onHand : '—', tone: product.low ? 'wait' : undefined },
          { label: 'Sold, 30 days', value: product.soldLast30 },
          { label: 'Margin', value: product.price ? `${Math.round(((product.price - product.cost) / product.price) * 100)}%` : '—' },
          { label: 'Value at cost', value: money(product.onHand * product.cost) },
        ]} />
        {product.description ? <p className="max-w-2xl text-sm text-muted-foreground">{product.description}</p> : null}

        <Section id="product-lots" title="Lots" count={data.lots.length}>
          {!data.lots.length ? <Empty>No deliveries received.</Empty> : (
            <DataTable label="Lots" className="relative" head={[
              { label: 'Lot' },
              { label: 'Supplier', className: 'hidden sm:table-cell' },
              { label: 'Received', className: 'hidden md:table-cell' },
              { label: 'Expires', className: 'hidden md:table-cell' },
              { label: 'Unit cost', className: 'hidden text-right sm:table-cell' },
              { label: 'Left / received', className: 'text-right' },
              { label: 'Status', className: 'hidden sm:table-cell' },
            ]}>
              {data.lots.map((lot) => (
                <tr key={lot.id}>
                  <Td className="font-mono text-xs">{lot.lotNumber}</Td>
                  <Td className="hidden sm:table-cell">{lot.supplier?.name || <span className="text-muted-foreground">No supplier</span>}</Td>
                  <Td className="hidden whitespace-nowrap tabular-nums md:table-cell">{lot.receivedAt ? formatShopDateTime(lot.receivedAt, timezone) : '—'}</Td>
                  <Td className="hidden whitespace-nowrap tabular-nums md:table-cell">{lot.expiresAt ? formatShopDateTime(lot.expiresAt, timezone) : '—'}</Td>
                  <Td className="hidden text-right tabular-nums sm:table-cell">{money(lot.unitCost)}</Td>
                  <Td className="text-right tabular-nums">{lot.quantityRemaining ?? 0} / {lot.quantityReceived ?? 0}</Td>
                  <Td className="hidden sm:table-cell"><StatusCell tone={lot.status === 'active' ? 'live' : 'off'}>{lot.status === 'active' ? 'In stock' : lot.status.replaceAll('_', ' ')}</StatusCell></Td>
                </tr>
              ))}
            </DataTable>
          )}
        </Section>

        <Section id="product-ledger" title="Stock ledger" count={data.movements.length}>
          {!data.movements.length ? <Empty>No stock movements yet.</Empty> : (
            <DataTable label="Stock ledger" className="relative" head={[
              { label: 'When' },
              { label: 'Movement' },
              { label: 'Lot', className: 'hidden sm:table-cell' },
              { label: 'Reason', className: 'hidden md:table-cell' },
              { label: 'Change', className: 'text-right' },
              { label: 'After', className: 'hidden text-right sm:table-cell' },
            ]}>
              {data.movements.map((movement) => (
                <tr key={movement.id}>
                  <Td className="whitespace-nowrap tabular-nums">{formatShopDateTime(movement.occurredAt, timezone)}</Td>
                  <Td>{MOVEMENT[movement.movementType] || movement.movementType}</Td>
                  <Td className="hidden font-mono text-xs sm:table-cell">{movement.inventoryLot?.lotNumber || '—'}</Td>
                  <Td className="hidden max-w-64 truncate text-muted-foreground md:table-cell">{movement.reason || '—'}</Td>
                  <Td className={`text-right tabular-nums ${movement.quantityDelta < 0 ? 'text-destructive' : ''}`}>{movement.quantityDelta > 0 ? '+' : ''}{movement.quantityDelta}</Td>
                  <Td className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">{movement.quantityAfter ?? '—'}</Td>
                </tr>
              ))}
            </DataTable>
          )}
        </Section>
      </div>
    </PageContainer>
  );
}
