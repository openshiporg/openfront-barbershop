import { notFound } from 'next/navigation';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { formatShopDateTime } from '@/features/shared/shop-time';
import { Empty, PageHeader, PillLink, Readouts, Section, StatusDot, Track, type Tone } from '@/features/platform/lib/ui';
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
      actions={<Track><PillLink href={`/dashboard/platform/services/products/${product.id}`}>Edit details</PillLink><AdjustStockButton productId={product.id} lots={activeLots} /><ReceiveDeliveryButton productId={product.id} suppliers={data.suppliers} cost={product.cost} /></Track>} />
  );
  return (
    <PageContainer title={product.name} header={header} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-8 px-4 pb-8 md:px-6">
        <Readouts items={[
          { label: 'On hand', value: product.inventoryTracked ? product.onHand : '—', tone: product.low ? 'wait' : undefined },
          { label: 'Sold, 30 days', value: product.soldLast30 },
          { label: 'Margin', value: product.price ? `${Math.round(((product.price - product.cost) / product.price) * 100)}%` : '—' },
          { label: 'Value at cost', value: money(product.onHand * product.cost) },
        ]} />
        {product.description ? <p className="max-w-2xl text-sm text-muted-foreground">{product.description}</p> : null}

        <Section id="product-lots" title="Lots" count={data.lots.length}>
          {!data.lots.length ? <Empty>No deliveries received.</Empty> : (
            <ul>
              {data.lots.map((lot) => (
                <li key={lot.id} className="flex flex-wrap items-baseline justify-between gap-3 border-b py-2.5 text-sm last:border-b-0">
                  <span className="min-w-0"><span className="font-mono"><StatusDot tone={lot.status === 'active' ? 'live' : 'off'} />{lot.lotNumber}</span><span className="block text-xs text-muted-foreground">{lot.supplier?.name || 'No supplier'} · received {lot.receivedAt ? formatShopDateTime(lot.receivedAt, timezone) : '—'}{lot.expiresAt ? ` · expires ${formatShopDateTime(lot.expiresAt, timezone)}` : ''} · {money(lot.unitCost)} each</span></span>
                  <span className="font-mono tabular-nums">{lot.quantityRemaining ?? 0} / {lot.quantityReceived ?? 0}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="product-ledger" title="Stock ledger" count={data.movements.length}>
          {!data.movements.length ? <Empty>No stock movements yet.</Empty> : (
            <ul>
              {data.movements.map((movement) => (
                <li key={movement.id} className="flex flex-wrap items-baseline justify-between gap-3 border-b py-2.5 text-sm last:border-b-0">
                  <span className="min-w-0"><span className="font-medium">{MOVEMENT[movement.movementType] || movement.movementType}</span><span className="block text-xs text-muted-foreground">{formatShopDateTime(movement.occurredAt, timezone)}{movement.inventoryLot ? ` · ${movement.inventoryLot.lotNumber}` : ''}{movement.reason ? ` · ${movement.reason}` : ''}</span></span>
                  <span className={`font-mono tabular-nums ${movement.quantityDelta < 0 ? 'text-destructive' : ''}`}>{movement.quantityDelta > 0 ? '+' : ''}{movement.quantityDelta}{movement.quantityAfter != null ? <span className="text-xs text-muted-foreground"> → {movement.quantityAfter}</span> : null}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </PageContainer>
  );
}
