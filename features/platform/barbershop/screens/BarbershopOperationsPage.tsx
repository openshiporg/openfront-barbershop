import Link from 'next/link';
import type { ReactNode } from 'react';
import { ClipboardPen, ReceiptText, ShieldAlert, Truck } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { formatShopDateTime } from '@/features/shared/shop-time';
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

function header() {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Shop operations</h1>
        <p className="text-muted-foreground">Chairs, inventory, commissions, payouts, tips, waitlist, and care records.</p>
      </div>
      <div className="flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><Link href={`${basePath}/platform/booking`}>Booking board</Link></Button><Button asChild size="sm"><Link href={`${basePath}/platform/queue`}>Walk-in queue</Link></Button></div>
    </div>
  );
}

function Empty({ span, text }: { span: number; text: string }) { return <TableRow><TableCell colSpan={span} className="py-8 text-center text-sm text-muted-foreground">{text}</TableCell></TableRow>; }

function Restricted({ children }: { children: ReactNode }) { return <p role="status" className="text-sm text-muted-foreground">{children}</p>; }

function More({ shown, total, slug, noun }: { shown: number; total: number | null | undefined; slug: string; noun: string }) {
  if (typeof total !== 'number' || total <= shown) return null;
  return <p className="text-xs text-muted-foreground">Showing {shown} of {total} {noun}. <Link className="text-primary underline" href={`${basePath}/${slug}`}>View all</Link></p>;
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">{title}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>;
}

export default async function BarbershopOperationsPage() {
  const response = await keystoneClient<{ platformOperations: { success: boolean; error?: string; data?: Data } }>(query, {}, { cache: 'no-store' });
  const result = response.data?.platformOperations;

  if (!response.success || !result?.success || !result.data) {
    return (
      <PageContainer title="Shop operations" header={header()} breadcrumbs={breadcrumbs}>
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

  return (
    <PageContainer title="Shop operations" header={header()} breadcrumbs={breadcrumbs}>
      <div className="space-y-6 px-4 pb-8 md:px-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Units in stock (active lots)" value={data.metrics.inventoryUnits === null ? 'Restricted' : String(data.metrics.inventoryUnits)} />
          <Metric title="Approved commission to pay" value={money(data.metrics.payableCommission)} />
          <Metric title="Tips recorded (all time)" value={money(data.metrics.tips)} />
          <Metric title="Reconciliations that changed status" value={String(data.metrics.reconciliationChanges)} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="min-w-0">
            <CardHeader><CardTitle>Floor and inventory</CardTitle><CardDescription>Chairs, stock lots, and suppliers.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {data.chairs === null ? <Restricted>Chairs restricted. Your role does not include staff access for this shop.</Restricted> : <>
                <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Chair</TableHead><TableHead>Status</TableHead><TableHead>Assigned</TableHead></TableRow></TableHeader><TableBody>{data.chairs.length ? data.chairs.map(x => <TableRow key={x.id}><TableCell><Link className="hover:underline" href={`${basePath}/barber-chairs/${x.id}`}>Chair {x.chairNumber}</Link><div className="text-xs text-muted-foreground">{x.stationName || 'No station name'}</div></TableCell><TableCell><Badge variant={x.status === 'active' ? 'default' : 'secondary'}>{x.status}</Badge></TableCell><TableCell>{x.assignedBarbers?.map((barber) => barber.name).join(', ') || 'Unassigned'}</TableCell></TableRow>) : <Empty span={3} text="No chairs yet."/>}</TableBody></Table></div>
                <More shown={data.chairs.length} total={data.counts.chairs} slug="barber-chairs" noun="chairs" />
              </>}
              {data.lots === null ? <Restricted>Inventory restricted. Your role does not include catalog access for this shop.</Restricted> : <>
                <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Lot</TableHead><TableHead>Product</TableHead><TableHead>Supplier</TableHead><TableHead>Remaining</TableHead></TableRow></TableHeader><TableBody>{data.lots.length ? data.lots.map(x => <TableRow key={x.id}><TableCell className="font-mono text-xs"><Link className="hover:underline" href={`${basePath}/inventory-lots/${x.id}`}>{x.lotNumber}</Link><div className="font-sans text-muted-foreground">{x.status}{x.expiresAt ? ` · expires ${when(x.expiresAt)}` : ''}</div></TableCell><TableCell>{x.product?.name ?? '—'}</TableCell><TableCell>{x.supplier?.name ?? '—'}</TableCell><TableCell>{x.quantityRemaining ?? 0}/{x.quantityReceived ?? 0}</TableCell></TableRow>) : <Empty span={4} text="No inventory lots yet."/>}</TableBody></Table></div>
                <More shown={data.lots.length} total={data.counts.lots} slug="inventory-lots" noun="lots" />
                <InventoryReceiptControls products={data.products || []} suppliers={data.suppliers || []} supplierTotal={data.counts.suppliers} timeZone={timeZone} />
                <div className="grid gap-3 md:grid-cols-2">{(data.suppliers || []).slice(0, 6).map(x => <Link key={x.id} href={`${basePath}/suppliers/${x.id}`} className="rounded-lg border p-4 hover:bg-muted/50"><Truck className="mb-2 size-4" aria-hidden="true"/><div className="font-medium">{x.name}</div><p className="text-sm text-muted-foreground">{x.status} · {x.contactName ?? 'No contact'}</p><p className="text-xs text-muted-foreground">{x.email || x.phone || 'No contact details'}</p></Link>)}</div>
                <More shown={Math.min(6, data.suppliers?.length || 0)} total={data.counts.suppliers} slug="suppliers" noun="suppliers" />
              </>}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader><CardTitle>Commissions and tips</CardTitle><CardDescription>Approve, pay, or void open commissions. Oldest open commissions are listed first.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Commission</TableHead><TableHead>Barber</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{data.commissions.length ? data.commissions.map(x => <TableRow key={x.id}><TableCell>{x.commissionNumber}<div className="text-xs text-muted-foreground">Rate {x.commissionRate ?? '0'}%</div><CommissionControls commission={x} /></TableCell><TableCell>{x.barber?.name ?? '—'}</TableCell><TableCell><Badge variant="secondary">{x.status}</Badge></TableCell><TableCell className="text-right">{money(x.commissionAmount)}</TableCell></TableRow>) : <Empty span={4} text="No open commissions."/>}</TableBody></Table></div>
              <More shown={data.commissions.length} total={data.counts.commissions} slug="commissions" noun="open commissions" />
              <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Tip</TableHead><TableHead>Barber</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{data.tips.length ? data.tips.map(x => <TableRow key={x.id}><TableCell>{x.tipNumber}<div className="text-xs text-muted-foreground">{x.paymentMethod}</div></TableCell><TableCell>{x.barber?.name ?? '—'}</TableCell><TableCell>{x.customer?.name ?? '—'}</TableCell><TableCell className="text-right">{money(x.amount)}</TableCell></TableRow>) : <Empty span={4} text="No tips yet."/>}</TableBody></Table></div>
              <More shown={data.tips.length} total={data.counts.tips} slug="tips" noun="tips" />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Payout history</CardTitle><CardDescription>Payouts you recorded. These record your own cash or payroll payment; no money is transferred by the system.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Payout</TableHead><TableHead>Barber</TableHead><TableHead>Paid</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{data.payouts.length ? data.payouts.map(x => <TableRow key={x.id}><TableCell><Link className="hover:underline" href={`${basePath}/commission-payouts/${x.id}`}>{x.payoutNumber}</Link><div className="text-xs text-muted-foreground">{x.commissionCount} commission{x.commissionCount === 1 ? '' : 's'}{x.status ? ` · ${label(x.status)}` : ''}</div></TableCell><TableCell>{x.barber?.name ?? '—'}</TableCell><TableCell>{when(x.paidAt)}</TableCell><TableCell className="max-w-48 truncate">{x.notes || '—'}</TableCell><TableCell className="text-right">{money(x.totalAmount)}</TableCell></TableRow>) : <Empty span={5} text="No payouts recorded."/>}</TableBody></Table></div>
            <More shown={data.payouts.length} total={data.counts.payouts} slug="commission-payouts" noun="payouts" />
          </CardContent>
        </Card>

        {data.paymentSessions.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Card processor payments</CardTitle><CardDescription>Check the processor for the latest status of open card payments.</CardDescription></CardHeader>
            <CardContent><ReconciliationControls sessions={data.paymentSessions} /></CardContent>
          </Card>
        )}
        {data.reconciliations.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Reconciliation history</CardTitle><CardDescription>Processor status checks and the local status before and after each one.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Checked</TableHead><TableHead>Before</TableHead><TableHead>Processor</TableHead><TableHead>After</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{data.reconciliations.map(x => <TableRow key={x.id}><TableCell>{when(x.observedAt)}{x.changed && <Badge className="ml-2" variant="secondary">changed</Badge>}</TableCell><TableCell>{label(x.localStatusBefore)}</TableCell><TableCell>{label(x.remoteStatus)}</TableCell><TableCell>{label(x.localStatusAfter)}</TableCell><TableCell className="text-right">{money(x.amount)}</TableCell></TableRow>)}</TableBody></Table></div>
              <More shown={data.reconciliations.length} total={data.counts.reconciliations} slug="payment-reconciliations" noun="checks" />
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>No-show policies and waitlist</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {data.policies === null ? <Restricted>No-show policies restricted. Your role does not include appointment access for this shop.</Restricted> : <>
                <div className="grid gap-3 md:grid-cols-2">{data.policies.map(x => <Link key={x.id} href={`${basePath}/no-show-policies/${x.id}`} className="rounded-lg border p-4 hover:bg-muted/50"><ShieldAlert className="mb-2 size-4" aria-hidden="true"/><div className="font-medium">{x.name}</div><p className="text-sm text-muted-foreground">{x.status} · {money(x.feeAmount)} · {x.graceMinutes ?? 0}m grace</p>{x.appliesToMemberships && <Badge className="mt-2">Memberships</Badge>}</Link>)}</div>
                {!data.policies.length && <p className="text-sm text-muted-foreground">No no-show policies. <Link className="text-primary underline" href={`${basePath}/no-show-policies/create`}>Add a policy</Link></p>}
                <More shown={data.policies.length} total={data.counts.policies} slug="no-show-policies" noun="policies" />
              </>}
              {data.waitlist === null ? <Restricted>Waitlist restricted. Your role does not include queue access for this shop.</Restricted> : <>
                <WaitlistControls entries={data.waitlist} services={data.activeServices || []} barbers={data.activeBarbers || []} timeZone={timeZone} />
                {!data.waitlist.length && <p className="text-sm text-muted-foreground">No one is waiting.</p>}
                <More shown={data.waitlist.length} total={data.counts.waitlist} slug="waitlist-entries" noun="open waitlist requests" />
              </>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Client care records</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {notesAccess === 'restricted' && <Restricted>Client notes restricted.</Restricted>}
              {data.waivers === null && <Restricted>Waivers restricted. Your role does not include customer access for this shop.</Restricted>}
              <div className="grid gap-3 md:grid-cols-2">
                {notes.map(x => <div key={x.id} className="rounded-lg border p-4"><ReceiptText className="mb-2 size-4" aria-hidden="true"/><div className="font-medium">{x.title ?? 'Untitled note'}</div><p className="text-sm text-muted-foreground">{x.noteType ?? '—'} · {x.customer ? x.customer.name ?? 'Customer unavailable' : noteCustomerRestricted ? 'Customer restricted' : '—'} · {x.barber ? x.barber.name ?? 'Barber unavailable' : noteBarberRestricted ? 'Barber restricted' : '—'}</p>{x.privateToStaff && <Badge className="mt-2" variant="secondary">Staff private</Badge>}</div>)}
                {waivers.map(x => <div key={x.id} className="rounded-lg border p-4"><ClipboardPen className="mb-2 size-4" aria-hidden="true"/><div className="font-medium">{x.title}</div><p className="text-sm text-muted-foreground">{label(x.waiverType)} · {x.signedByName || x.status === 'signed' ? 'signed' : ['draft', 'sent'].includes(x.status) ? 'awaiting signature' : label(x.status)} · {x.customer?.name ?? '—'}</p><p className="text-xs text-muted-foreground">{x.signedByName ? `Signed by ${x.signedByName}` : 'Not signed'}</p></div>)}
              </div>
              {!notes.length && !waivers.length && (notesAccess === 'granted' || data.waivers !== null) && <p className="text-sm text-muted-foreground">No care records yet.</p>}
              <More shown={waivers.length} total={data.counts.waivers} slug="waiver-forms" noun="waivers" />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
