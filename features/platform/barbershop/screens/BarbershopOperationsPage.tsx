import Link from 'next/link';

import { ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { formatShopDateTime } from '@/features/shared/shop-time';
import { DataTable, Empty, PageHeader, PillLink, Restricted, Section, StatusCell, Td, type Tone } from '@/features/platform/lib/ui';
import { WaitlistControls } from './WaitlistControls';

type Access = 'granted' | 'restricted';
type Named = { id: string; name: string };
type NullableNamed = { id: string; name: string | null };
type Data = {
  shop: { id: string; name: string; timezone?: string | null; currencyCode?: string | null };
  access: { staff: Access; inventory: Access; queue: Access; customers: Access; policies: Access };
  chairs: Array<{ id: string; chairNumber: string; stationName?: string | null; status: string; assignedBarbers?: Named[] | null }> | null;
  lots: Array<{ id: string; lotNumber: string; quantityReceived?: number | null; quantityRemaining?: number | null; unitCost?: number | null; receivedAt?: string | null; expiresAt?: string | null; status: string; product?: Named | null; supplier?: Named | null }> | null;
  suppliers: Array<{ id: string; name: string; status: string; contactName?: string | null; email?: string | null; phone?: string | null }> | null;
  products: Array<{ id: string; name: string; sku?: string | null; cost?: number | null; onHand: number; reorderSuggested: boolean }> | null;
  commissions: Array<{ id: string; commissionNumber: string; status: string; commissionAmount?: number | null; commissionRate?: string | null; createdAt?: string | null; barber?: Named | null; appointment?: { startsAt?: string | null; serviceTitleSnapshot?: string | null } | null; transaction?: { completedAt?: string | null } | null }>;
  tips: Array<{ id: string; tipNumber: string; amount?: number | null; paymentMethod: string; createdAt?: string | null; barber?: Named | null; customer?: Named | null }>;
  policies: Array<{ id: string; name: string; status: string; feeAmount?: number | null; graceMinutes?: number | null; appliesToMemberships: boolean }> | null;
  waitlist: Array<{ id: string; customerName: string; phone?: string | null; status: string; preferredAt?: string | null; requestedService?: Named | null; requestedBarber?: Named | null }> | null;
  activeServices: Named[] | null;
  activeBarbers: Named[] | null;
  // Customer-note governed: null + restricted without current same-shop note authority;
  // customer/barber attribution is null + restricted without its own authority.
  notes: Array<{ id: string; title: string | null; noteType: string | null; privateToStaff: boolean | null; customer?: NullableNamed | null; barber?: NullableNamed | null }> | null;
  notesAccess?: Access;
  notesCustomerAccess?: Access;
  notesStaffAccess?: Access;
  waivers: Array<{ id: string; title: string; waiverType: string; status: string; signedByName?: string | null; customer?: Named | null }> | null;
  payouts: Array<{ id: string; payoutNumber: string; status?: string | null; totalAmount: number; commissionCount: number; paidAt: string; notes?: string | null; barber?: Named | null }>;
  paymentSessions: Array<{ id: string; status: string; amount: number; currencyCode: string; paymentProvider?: { name?: string | null } | null }>;
  reconciliations: Array<{ id: string; localStatusBefore: string; remoteStatus: string; localStatusAfter: string; changed: boolean; amount: number; observedAt: string }>;
  counts: Record<'chairs' | 'lots' | 'suppliers' | 'commissions' | 'payouts' | 'tips' | 'policies' | 'waitlist' | 'waivers' | 'reconciliations', number | null>;
  metrics: { inventoryUnits: number | null; payableCommission: number; tips: number; reconciliationChanges: number };
};

const query = `query BarbershopOperationsPage { platformOperations { success error data } }`;

const money = (cents?: number | null) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100);

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'page' as const, label: 'Platform' },
  { type: 'page' as const, label: 'Shop operations' },
];

function header(meta?: string, tone?: Tone) {
  return (
    <PageHeader
      title="Shop operations"
      tone={tone}
      meta={meta}
      actions={<div className="flex flex-wrap items-center gap-1.5"><PillLink href={`${basePath}/platform/queue`}>Walk-ins</PillLink><PillLink variant="primary" href={`${basePath}/platform/booking`}>Booking board</PillLink></div>}
    />
  );
}

type Attention = { key: string; tone: Tone; state: string; item: string; detail: string; href: string; action: string };
const DAY = 86400_000;
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

export default async function BarbershopOperationsPage() {
  const response = await keystoneClient<{ platformOperations: { success: boolean; error?: string; data?: Data } }>(query, {}, { cache: 'no-store' });
  const result = response.data?.platformOperations;

  if (!response.success || !result?.success || !result.data) {
    return (
      <PageContainer title="Shop operations" header={header(undefined, 'alert')} breadcrumbs={breadcrumbs}>
        <div className="px-4 pb-8 md:px-6"><Alert variant="destructive"><AlertDescription>Unable to load operations: {result?.error || response.error || 'Refresh to try again.'}</AlertDescription></Alert></div>
      </PageContainer>
    );
  }

  const data = result.data;
  const timeZone = data.shop.timezone || null;
  const when = (value: string) => (timeZone ? formatShopDateTime(value, timeZone) : new Date(value).toISOString().slice(0, 10));
  const now = Date.now();
  const items: Attention[] = [];

  // Stock: what to reorder, and lots about to expire.
  for (const product of (data.products || []).filter((row) => row.reorderSuggested).sort((a, b) => a.onHand - b.onHand)) {
    items.push({ key: `stock-${product.id}`, tone: 'wait', state: product.onHand ? 'Low stock' : 'Out of stock', item: product.name, detail: `${product.onHand} on hand`, href: `${basePath}/platform/inventory/${product.id}`, action: 'Receive' });
  }
  for (const lot of (data.lots || []).filter((row) => row.status === 'active' && (row.quantityRemaining || 0) > 0 && row.expiresAt && new Date(row.expiresAt).getTime() - now < 30 * DAY)) {
    const expired = new Date(lot.expiresAt!).getTime() < now;
    items.push({ key: `lot-${lot.id}`, tone: expired ? 'alert' : 'wait', state: expired ? 'Expired' : 'Expiring', item: lot.product?.name || lot.lotNumber, detail: `Lot ${lot.lotNumber} · ${lot.quantityRemaining} left · ${expired ? 'expired' : 'expires'} ${when(lot.expiresAt!)}`, href: lot.product ? `${basePath}/platform/inventory/${lot.product.id}` : `${basePath}/platform/inventory`, action: 'Adjust' });
  }

  // Money owed to barbers.
  const toApprove = data.commissions.filter((row) => row.status === 'projected');
  const approved = data.commissions.filter((row) => row.status === 'approved');
  if (approved.length || data.metrics.payableCommission) {
    items.push({ key: 'payroll-approved', tone: 'info', state: 'Unpaid', item: 'Barber payouts', detail: `${money(data.metrics.payableCommission)} to pay${approved.length ? ` · ${plural(approved.length, 'approved commission')}` : ''}`, href: `${basePath}/platform/payroll?status=approved`, action: 'Pay' });
  }
  if (toApprove.length) {
    items.push({ key: 'payroll-projected', tone: 'wait', state: 'To approve', item: 'Commissions', detail: `${plural(toApprove.length, 'commission')}${data.counts.commissions && data.counts.commissions > data.commissions.length ? ' (latest shown)' : ''} · ${money(toApprove.reduce((sum, row) => sum + (row.commissionAmount || 0), 0))}`, href: `${basePath}/platform/payroll`, action: 'Review' });
  }

  // Card payments still open with the processor.
  if (data.paymentSessions.length) {
    items.push({ key: 'payments-open', tone: 'wait', state: 'Open', item: 'Card payments', detail: `${plural(data.paymentSessions.length, 'payment')} awaiting processor status · ${money(data.paymentSessions.reduce((sum, row) => sum + row.amount, 0))}`, href: `${basePath}/platform/payments`, action: 'Check' });
  }

  // Policy gaps.
  if (data.policies !== null && !data.policies.some((policy) => policy.status === 'active')) {
    items.push({ key: 'policy-noshow', tone: 'alert', state: 'Missing', item: 'No-show policy', detail: data.policies.length ? 'No policy in use' : 'No-shows are recorded without a fee', href: `${basePath}/platform/policies`, action: 'Set up' });
  }

  // Chairs out of service or without a barber.
  for (const chair of (data.chairs || []).filter((row) => row.status === 'maintenance' || (row.status === 'active' && !row.assignedBarbers?.length))) {
    items.push({ key: `chair-${chair.id}`, tone: chair.status === 'maintenance' ? 'wait' : 'off', state: chair.status === 'maintenance' ? 'Maintenance' : 'Unassigned', item: `Chair ${chair.chairNumber}`, detail: chair.stationName || (chair.status === 'maintenance' ? 'Out of service' : 'No barber assigned'), href: `${basePath}/platform/staff/chairs`, action: 'Open' });
  }

  // Waivers waiting on a signature.
  const unsigned = (data.waivers || []).filter((waiver) => !waiver.signedByName && ['draft', 'sent'].includes(waiver.status));
  if (unsigned.length) {
    items.push({ key: 'waivers', tone: 'wait', state: 'Unsigned', item: 'Waivers', detail: `${plural(unsigned.length, 'waiver')} awaiting signature${unsigned[0]?.customer?.name ? ` · ${unsigned.map((waiver) => waiver.customer?.name).filter(Boolean).slice(0, 3).join(', ')}` : ''}`, href: `${basePath}/waiver-forms`, action: 'Open' });
  }

  const waiting = (data.waitlist || []).filter((entry) => ['waiting', 'notified'].includes(entry.status));
  const restricted = [data.lots === null || data.products === null ? 'stock' : null, data.waitlist === null ? 'waitlist' : null, data.policies === null ? 'policies' : null, data.chairs === null ? 'chairs' : null, data.waivers === null ? 'waivers' : null].filter(Boolean);
  const meta = [items.length ? `${plural(items.length, 'item')} need attention` : 'Nothing needs attention', waiting.length ? `${waiting.length} on the waitlist` : null].filter(Boolean).join(' · ');

  return (
    <PageContainer title="Shop operations" header={header(meta, items.some((item) => item.tone === 'alert') ? 'alert' : items.length ? 'wait' : undefined)} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-8 px-4 pb-24 md:px-6">
        <Section id="ops-attention" title="Needs attention" count={items.length}>
          {!items.length ? <Empty>Stock, payouts, policies, chairs and waivers are all in order.</Empty> : (
            <DataTable label="Needs attention" className="relative" head={[
              { label: 'Status', className: 'w-32' },
              { label: 'Item' },
              { label: 'Detail', className: 'hidden md:table-cell' },
              { label: <span className="sr-only">Open</span>, className: 'w-px' },
            ]}>
              {items.map((item) => (
                <tr key={item.key} className="hover:bg-muted/30">
                  <Td className="align-middle"><StatusCell tone={item.tone}>{item.state}</StatusCell></Td>
                  <Td className="align-middle"><Link href={item.href} className="font-medium underline-offset-4 hover:underline">{item.item}</Link><span className="block text-xs text-muted-foreground md:hidden">{item.detail}</span></Td>
                  <Td className="hidden align-middle text-muted-foreground tabular-nums md:table-cell">{item.detail}</Td>
                  <Td className="align-middle text-right"><PillLink size="sm" href={item.href}>{item.action}<ChevronRight /></PillLink></Td>
                </tr>
              ))}
            </DataTable>
          )}
          {restricted.length ? <Restricted>Not shown for your role: {restricted.join(', ')}.</Restricted> : null}
        </Section>

        <Section id="ops-waitlist" title="Waitlist" tone={waiting.length ? 'wait' : undefined} count={data.counts.waitlist ?? undefined} actions={<Link className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href={`${basePath}/waitlist-entries`}>All requests</Link>}>
          {data.waitlist === null ? <Restricted>Waitlist restricted for your role.</Restricted> : <>
            <WaitlistControls entries={data.waitlist} services={data.activeServices || []} barbers={data.activeBarbers || []} timeZone={timeZone} />
            {typeof data.counts.waitlist === 'number' && data.counts.waitlist > data.waitlist.length ? <p className="pt-2 text-xs text-muted-foreground"><span className="tabular-nums">{data.waitlist.length} of {data.counts.waitlist}</span> open requests shown</p> : null}
          </>}
        </Section>
      </div>
    </PageContainer>
  );
}
