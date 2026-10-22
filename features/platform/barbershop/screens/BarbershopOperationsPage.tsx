import Link from 'next/link';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { formatShopDateTime } from '@/features/shared/shop-time';
import { Empty as EmptyLine, PageHeader, PillLink, Readouts, Restricted, Section, StatusDot, Track, type Tone } from '@/features/platform/lib/ui';
import { InventoryReceiptControls } from './InventoryReceiptControls';
import { WaitlistControls } from './WaitlistControls';
import { CommissionControls, ReconciliationControls } from './OperationsControls';

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
  commissions: Array<{ id: string; commissionNumber: string; status: string; commissionAmount?: number | null; commissionRate?: string | null; barber?: Named | null }>;
  tips: Array<{ id: string; tipNumber: string; amount?: number | null; paymentMethod: string; barber?: Named | null; customer?: Named | null }>;
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
const label = (value?: string | null) => value?.replaceAll('_', ' ') || '—';

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'page' as const, label: 'Platform' },
  { type: 'page' as const, label: 'Shop operations' },
];

const statusTone = (status?: string | null): Tone => (status === 'active' || status === 'signed' || status === 'paid' ? 'live' : status === 'inactive' || status === 'retired' || status === 'expired' || status === 'voided' ? 'off' : status === 'maintenance' || status === 'projected' || status === 'waiting' || status === 'draft' || status === 'sent' ? 'wait' : 'info');

function header(shopName?: string, tone?: Tone) {
  return (
    <PageHeader
      title="Shop operations"
      tone={tone}
      meta={shopName}
      actions={<Track><PillLink href={`${basePath}/platform/booking`}>Booking board</PillLink><PillLink href={`${basePath}/platform/queue`}>Walk-ins</PillLink></Track>}
    />
  );
}

function Empty({ span, text }: { span: number; text: string }) { return <TableRow><TableCell colSpan={span} className="py-6 text-sm text-muted-foreground">{text}</TableCell></TableRow>; }

function More({ shown, total, slug, noun }: { shown: number; total: number | null | undefined; slug: string; noun: string }) {
  if (typeof total !== 'number' || total <= shown) return null;
  return <p className="pt-2 text-xs text-muted-foreground"><span className="font-mono tabular-nums">{shown} / {total}</span> {noun} · <Link className="font-medium text-foreground underline-offset-4 hover:underline" href={`${basePath}/${slug}`}>All</Link></p>;
}

function ViewAll({ slug }: { slug: string }) {
  return <Link className="text-xs font-medium underline-offset-4 hover:underline" href={`${basePath}/${slug}`}>All</Link>;
}

const tableClass = 'overflow-x-auto [&_th]:h-9 [&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wider';

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
  const when = (value: string) => (timeZone ? formatShopDateTime(value, timeZone) : new Date(value).toISOString());
  const notes = data.notes ?? [];
  const waivers = data.waivers ?? [];
  const notesAccess = data.notesAccess === 'granted' ? 'granted' : 'restricted';
  const noteCustomerRestricted = data.notesCustomerAccess !== 'granted', noteBarberRestricted = data.notesStaffAccess !== 'granted';
  const reorder = (data.products || []).filter((product) => product.reorderSuggested);

  return (
    <PageContainer title="Shop operations" header={header(data.shop.name, 'live')} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-8 px-4 pb-8 md:px-6">
        <Readouts items={[
          { label: 'Units in stock', value: data.metrics.inventoryUnits === null ? '—' : data.metrics.inventoryUnits, tone: reorder.length ? 'wait' : undefined },
          { label: 'Commission to pay', value: money(data.metrics.payableCommission) },
          { label: 'Tips, all time', value: money(data.metrics.tips) },
          { label: 'Status changes', value: data.metrics.reconciliationChanges },
        ]} />

        <div className="grid min-w-0 gap-8 xl:grid-cols-2">
          <Section id="ops-chairs" title="Chairs" count={data.counts.chairs ?? undefined} actions={<ViewAll slug="barber-chairs" />}>
            {data.chairs === null ? <Restricted>Chairs restricted for your role.</Restricted> : <>
              <ul>
                {data.chairs.map((chair) => (
                  <li key={chair.id} className="flex min-w-0 items-baseline justify-between gap-3 border-b py-2.5 text-sm last:border-b-0">
                    <Link className="min-w-0 truncate font-medium hover:underline" href={`${basePath}/barber-chairs/${chair.id}`}><StatusDot tone={statusTone(chair.status)} />Chair <span className="font-mono">{chair.chairNumber}</span>{chair.stationName ? <span className="ml-1.5 font-normal text-muted-foreground">{chair.stationName}</span> : null}</Link>
                    <span className="truncate text-muted-foreground">{chair.assignedBarbers?.map((barber) => barber.name).join(', ') || 'Unassigned'}</span>
                  </li>
                ))}
              </ul>
              {!data.chairs.length && <EmptyLine>No chairs yet.</EmptyLine>}
              <More shown={data.chairs.length} total={data.counts.chairs} slug="barber-chairs" noun="chairs" />
            </>}
          </Section>

          <Section id="ops-waitlist" title="Waitlist" tone={data.waitlist?.length ? 'wait' : undefined} count={data.counts.waitlist ?? undefined} actions={<ViewAll slug="waitlist-entries" />}>
            {data.waitlist === null ? <Restricted>Waitlist restricted for your role.</Restricted> : <>
              <WaitlistControls entries={data.waitlist} services={data.activeServices || []} barbers={data.activeBarbers || []} timeZone={timeZone} />
              <More shown={data.waitlist.length} total={data.counts.waitlist} slug="waitlist-entries" noun="open requests" />
            </>}
          </Section>
        </div>

        <Section id="ops-inventory" title="Stock" tone={reorder.length ? 'wait' : undefined} count={data.counts.lots ?? undefined} actions={<ViewAll slug="inventory-lots" />}>
          {data.lots === null ? <Restricted>Inventory restricted for your role.</Restricted> : <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="min-w-0">
              {reorder.length > 0 && <p className="mb-3 text-sm"><StatusDot tone="wait" />Reorder: {reorder.map((product) => `${product.name} (${product.onHand})`).join(', ')}</p>}
              <div className={tableClass}><Table><TableHeader><TableRow><TableHead>Lot</TableHead><TableHead>Product</TableHead><TableHead>Supplier</TableHead><TableHead className="text-right">Left</TableHead></TableRow></TableHeader><TableBody>{data.lots.length ? data.lots.map(x => <TableRow key={x.id}><TableCell><Link className="font-mono text-xs hover:underline" href={`${basePath}/inventory-lots/${x.id}`}>{x.lotNumber}</Link><div className="text-xs text-muted-foreground">{x.status}{x.expiresAt ? ` · exp ${when(x.expiresAt)}` : ''}</div></TableCell><TableCell>{x.product?.name ?? '—'}</TableCell><TableCell>{x.supplier?.name ?? '—'}</TableCell><TableCell className="text-right font-mono tabular-nums">{x.quantityRemaining ?? 0}/{x.quantityReceived ?? 0}</TableCell></TableRow>) : <Empty span={4} text="No inventory lots yet."/>}</TableBody></Table></div>
              <More shown={data.lots.length} total={data.counts.lots} slug="inventory-lots" noun="lots" />
              <h3 className="mt-6 border-b pb-2 text-sm font-semibold">Suppliers <span className="ml-1 font-mono text-xs font-normal text-muted-foreground">{data.counts.suppliers ?? ''}</span></h3>
              <ul className="grid gap-x-6 sm:grid-cols-2">{(data.suppliers || []).slice(0, 6).map(x => <li key={x.id} className="border-b py-2.5 text-sm"><Link href={`${basePath}/suppliers/${x.id}`} className="font-medium hover:underline"><StatusDot tone={statusTone(x.status)} />{x.name}</Link><p className="truncate text-xs text-muted-foreground">{x.contactName ?? 'No contact'} · {x.email || x.phone || 'no details'}</p></li>)}</ul>
              {!data.suppliers?.length && <EmptyLine>No suppliers yet.</EmptyLine>}
              <More shown={Math.min(6, data.suppliers?.length || 0)} total={data.counts.suppliers} slug="suppliers" noun="suppliers" />
            </div>
            <InventoryReceiptControls products={data.products || []} suppliers={data.suppliers || []} supplierTotal={data.counts.suppliers} timeZone={timeZone} />
          </div>}
        </Section>

        <div className="grid min-w-0 gap-8 xl:grid-cols-2">
          <Section id="ops-commissions" title="Open commissions" count={data.counts.commissions ?? undefined} actions={<ViewAll slug="commissions" />}>
            <div className={tableClass}><Table><TableHeader><TableRow><TableHead>Commission</TableHead><TableHead>Barber</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{data.commissions.length ? data.commissions.map(x => <TableRow key={x.id}><TableCell className="align-top"><span className="font-mono text-xs"><StatusDot tone={statusTone(x.status)} />{x.commissionNumber}</span><div className="text-xs text-muted-foreground">{x.status} · {x.commissionRate ?? '0'}%</div><CommissionControls commission={x} /></TableCell><TableCell className="align-top">{x.barber?.name ?? '—'}</TableCell><TableCell className="text-right align-top font-mono tabular-nums">{money(x.commissionAmount)}</TableCell></TableRow>) : <Empty span={3} text="No open commissions."/>}</TableBody></Table></div>
            <More shown={data.commissions.length} total={data.counts.commissions} slug="commissions" noun="open commissions" />
          </Section>

          <Section id="ops-tips" title="Tips" count={data.counts.tips ?? undefined} actions={<ViewAll slug="tips" />}>
            <div className={tableClass}><Table><TableHeader><TableRow><TableHead>Tip</TableHead><TableHead>Barber</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{data.tips.length ? data.tips.map(x => <TableRow key={x.id}><TableCell><span className="font-mono text-xs">{x.tipNumber}</span><div className="text-xs text-muted-foreground">{x.paymentMethod}</div></TableCell><TableCell>{x.barber?.name ?? '—'}</TableCell><TableCell>{x.customer?.name ?? '—'}</TableCell><TableCell className="text-right font-mono tabular-nums">{money(x.amount)}</TableCell></TableRow>) : <Empty span={4} text="No tips yet."/>}</TableBody></Table></div>
            <More shown={data.tips.length} total={data.counts.tips} slug="tips" noun="tips" />
          </Section>
        </div>

        <Section id="ops-payouts" title="Payouts recorded" count={data.counts.payouts ?? undefined} actions={<ViewAll slug="commission-payouts" />}>
          <div className={tableClass}><Table><TableHeader><TableRow><TableHead>Payout</TableHead><TableHead>Barber</TableHead><TableHead>Paid</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{data.payouts.length ? data.payouts.map(x => <TableRow key={x.id}><TableCell><Link className="font-mono text-xs hover:underline" href={`${basePath}/commission-payouts/${x.id}`}>{x.payoutNumber}</Link><div className="text-xs text-muted-foreground">{x.commissionCount} commission{x.commissionCount === 1 ? '' : 's'}{x.status ? ` · ${label(x.status)}` : ''}</div></TableCell><TableCell>{x.barber?.name ?? '—'}</TableCell><TableCell className="whitespace-nowrap">{when(x.paidAt)}</TableCell><TableCell className="max-w-48 truncate">{x.notes || '—'}</TableCell><TableCell className="text-right font-mono tabular-nums">{money(x.totalAmount)}</TableCell></TableRow>) : <Empty span={5} text="No payouts recorded."/>}</TableBody></Table></div>
          <More shown={data.payouts.length} total={data.counts.payouts} slug="commission-payouts" noun="payouts" />
        </Section>

        {(data.paymentSessions.length > 0 || data.reconciliations.length > 0) && (
          <div className="grid min-w-0 gap-8 xl:grid-cols-2">
            {data.paymentSessions.length > 0 && (
              <Section id="ops-processor" title="Open card payments" tone="wait" count={data.paymentSessions.length}>
                <ReconciliationControls sessions={data.paymentSessions} />
              </Section>
            )}
            {data.reconciliations.length > 0 && (
              <Section id="ops-reconciliations" title="Processor checks" count={data.counts.reconciliations ?? undefined} actions={<ViewAll slug="payment-reconciliations" />}>
                <div className={tableClass}><Table><TableHeader><TableRow><TableHead>Checked</TableHead><TableHead>Before</TableHead><TableHead>Processor</TableHead><TableHead>After</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{data.reconciliations.map(x => <TableRow key={x.id}><TableCell className="whitespace-nowrap">{x.changed && <StatusDot tone="wait" />}{when(x.observedAt)}</TableCell><TableCell>{label(x.localStatusBefore)}</TableCell><TableCell>{label(x.remoteStatus)}</TableCell><TableCell>{label(x.localStatusAfter)}</TableCell><TableCell className="text-right font-mono tabular-nums">{money(x.amount)}</TableCell></TableRow>)}</TableBody></Table></div>
                <More shown={data.reconciliations.length} total={data.counts.reconciliations} slug="payment-reconciliations" noun="checks" />
              </Section>
            )}
          </div>
        )}

        <div className="grid min-w-0 gap-8 xl:grid-cols-2">
          <Section id="ops-policies" title="No-show policies" count={data.counts.policies ?? undefined} actions={<ViewAll slug="no-show-policies" />}>
            {data.policies === null ? <Restricted>No-show policies restricted for your role.</Restricted> : <>
              <ul>{data.policies.map(x => <li key={x.id} className="flex min-w-0 items-baseline justify-between gap-3 border-b py-2.5 text-sm last:border-b-0"><Link href={`${basePath}/no-show-policies/${x.id}`} className="min-w-0 truncate font-medium hover:underline"><StatusDot tone={statusTone(x.status)} />{x.name}</Link><span className="shrink-0 text-muted-foreground"><span className="font-mono tabular-nums">{money(x.feeAmount)}</span> · {x.graceMinutes ?? 0}m grace{x.appliesToMemberships ? ' · memberships' : ''}</span></li>)}</ul>
              {!data.policies.length && <EmptyLine>No no-show policies. <Link className="underline" href={`${basePath}/no-show-policies/create`}>Add a policy</Link></EmptyLine>}
              <More shown={data.policies.length} total={data.counts.policies} slug="no-show-policies" noun="policies" />
            </>}
          </Section>

          <Section id="ops-care" title="Care records" count={notes.length + waivers.length}>
            {notesAccess === 'restricted' && <Restricted>Client notes restricted.</Restricted>}
            {data.waivers === null && <Restricted>Waivers restricted for your role.</Restricted>}
            <ul>
              {notes.map(x => <li key={x.id} className="border-b py-2.5 text-sm last:border-b-0"><p className="font-medium"><StatusDot tone={x.privateToStaff ? 'off' : 'info'} />{x.title ?? 'Untitled note'}{x.privateToStaff ? <span className="ml-2 text-xs font-normal text-muted-foreground">staff only</span> : null}</p><p className="text-xs text-muted-foreground">{x.noteType ?? '—'} · {x.customer ? x.customer.name ?? 'Customer unavailable' : noteCustomerRestricted ? 'Customer restricted' : '—'} · {x.barber ? x.barber.name ?? 'Barber unavailable' : noteBarberRestricted ? 'Barber restricted' : '—'}</p></li>)}
              {waivers.map(x => { const signed = Boolean(x.signedByName) || x.status === 'signed'; return <li key={x.id} className="border-b py-2.5 text-sm last:border-b-0"><p className="font-medium"><StatusDot tone={signed ? 'live' : 'wait'} />{x.title}</p><p className="text-xs text-muted-foreground">{label(x.waiverType)} · {signed ? 'signed' : ['draft', 'sent'].includes(x.status) ? 'awaiting signature' : label(x.status)} · {x.customer?.name ?? '—'}{x.signedByName ? ` · by ${x.signedByName}` : ''}</p></li>; })}
            </ul>
            {!notes.length && !waivers.length && (notesAccess === 'granted' || data.waivers !== null) && <EmptyLine>No care records yet.</EmptyLine>}
            <More shown={waivers.length} total={data.counts.waivers} slug="waiver-forms" noun="waivers" />
          </Section>
        </div>
      </div>
    </PageContainer>
  );
}
