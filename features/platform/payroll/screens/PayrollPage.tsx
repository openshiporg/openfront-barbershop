import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { formatShopDateTime } from '@/features/shared/shop-time';
import { StatusTabs } from '@/features/platform/lib/forms';
import { Empty, Notice, PageHeader, Readouts, Section, selectClass, StatusDot, Track, Pill, type Tone } from '@/features/platform/lib/ui';
import { getPayrollAction } from '../actions/payroll';
import { BulkCommissionActions, CommissionRowActions, PayBarberButton } from '../components/PayrollControls';

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'page' as const, label: 'Platform' },
  { type: 'page' as const, label: 'Payroll' },
];
const money = (cents?: number | null) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100);
const tone: Record<string, Tone> = { projected: 'wait', approved: 'info', paid: 'live', voided: 'off' };

export default async function PayrollPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const data = await getPayrollAction({ status: typeof params.status === 'string' ? params.status : undefined, barberId: typeof params.barber === 'string' ? params.barber : undefined });
  const header = <PageHeader title="Payroll" tone={data ? (data.approvedByBarber.length ? 'wait' : 'live') : 'alert'} meta={data?.shopName} />;
  if (!data) return <PageContainer title="Payroll" header={header} breadcrumbs={breadcrumbs}><div className="px-4 pb-8 md:px-6"><Notice tone="alert">Payroll couldn’t load. Your role may not include payments.</Notice></div></PageContainer>;
  const href = (status: string, barber = data.barberId) => `?${new URLSearchParams({ ...(status ? { status } : {}), ...(barber ? { barber } : {}) }).toString()}`;
  const owed = data.approvedByBarber.reduce((sum, group) => sum + group.total, 0);
  const tipsByBarber = new Map<string, { name: string; total: number }>();
  for (const tip of data.tips) {
    const key = tip.barber?.id || 'none';
    const entry = tipsByBarber.get(key) || { name: tip.barber?.displayName || 'No barber', total: 0 };
    entry.total += tip.amount || 0;
    tipsByBarber.set(key, entry);
  }
  const shownIds = data.commissions.map((row) => row.id);
  return (
    <PageContainer title="Payroll" header={header} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-8 px-4 pb-8 md:px-6">
        <Readouts items={[
          { label: 'To approve', value: data.counts.projected, tone: data.counts.projected ? 'wait' : undefined },
          { label: 'Approved, unpaid', value: money(owed), tone: owed ? 'info' : undefined },
          { label: 'Tips, 30 days', value: money(data.tips.reduce((sum, tip) => sum + (tip.amount || 0), 0)) },
          { label: 'Payouts', value: data.payouts.length },
        ]} />

        <Section id="payroll-owed" title="Ready to pay" count={data.approvedByBarber.length}>
          {!data.approvedByBarber.length ? <Empty>Nothing approved and unpaid.</Empty> : (
            <ul>
              {data.approvedByBarber.map((group) => (
                <li key={group.barber.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0">
                  <span><span className="font-medium"><StatusDot tone="info" />{group.barber.displayName}</span><span className="block text-xs text-muted-foreground">{group.ids.length} approved · <span className="font-mono">{money(group.total)}</span></span></span>
                  <PayBarberButton name={group.barber.displayName} ids={group.ids.slice(0, 100)} total={money(group.total)} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="payroll-commissions" title="Commissions" count={data.commissions.length} actions={<BulkCommissionActions ids={shownIds} status={data.status} />}>
          <div className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <StatusTabs current={data.status} hrefFor={(value) => href(value)} tabs={[
              { value: 'projected', label: 'To approve', count: data.counts.projected, tone: 'wait' },
              { value: 'approved', label: 'Approved', count: data.counts.approved, tone: 'info' },
              { value: 'paid', label: 'Paid', count: data.counts.paid, tone: 'live' },
              { value: 'voided', label: 'Voided', count: data.counts.voided, tone: 'off' },
            ]} />
            <form className="flex items-center gap-2" action="/dashboard/platform/payroll">
              <input type="hidden" name="status" value={data.status} />
              <select name="barber" defaultValue={data.barberId} aria-label="Barber" className={`${selectClass} w-44`}><option value="">All barbers</option>{data.barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.displayName}</option>)}</select>
              <Track><Pill type="submit" size="sm">Show</Pill></Track>
            </form>
          </div>
          {!data.commissions.length ? <Empty>No commissions here.</Empty> : (
            <ul>
              {data.commissions.map((row) => {
                const when = row.appointment?.startsAt || row.transaction?.completedAt || row.createdAt;
                const customer = [row.appointment?.customer?.firstName, row.appointment?.customer?.lastName].filter(Boolean).join(' ');
                return (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-2.5 last:border-b-0">
                    <span className="min-w-0"><span className="text-sm font-medium"><StatusDot tone={tone[row.status] || 'off'} />{row.barber?.displayName || 'No barber'} · {row.appointment?.serviceTitleSnapshot || 'Retail sale'}</span><span className="block text-xs text-muted-foreground">{formatShopDateTime(when, data.timezone)}{customer ? ` · ${customer}` : ''} · {row.commissionRate ?? '0'}% of {money((row.serviceAmount || 0) + (row.productAmount || 0))}{row.paidAt ? ` · paid ${formatShopDateTime(row.paidAt, data.timezone)}` : ''}</span></span>
                    <span className="flex items-center gap-3"><span className="font-mono text-sm tabular-nums">{money(row.commissionAmount)}</span><CommissionRowActions id={row.id} status={row.status} /></span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <div className="grid min-w-0 gap-8 xl:grid-cols-2">
          <Section id="payroll-payouts" title="Payouts" count={data.payouts.length}>
            {!data.payouts.length ? <Empty>No payouts yet.</Empty> : (
              <ul>{data.payouts.map((payout) => <li key={payout.id} className="flex items-baseline justify-between gap-3 border-b py-2.5 text-sm last:border-b-0"><span className="min-w-0 truncate"><StatusDot tone={payout.status === 'paid' ? 'live' : 'off'} />{payout.barber?.displayName || '—'} <span className="text-xs text-muted-foreground">· {formatShopDateTime(payout.paidAt, data.timezone)} · {payout.commissionCount} · {payout.notes || '—'}</span></span><span className="font-mono tabular-nums">{money(payout.totalAmount)}</span></li>)}</ul>
            )}
          </Section>
          <Section id="payroll-tips" title="Tips, last 30 days" count={tipsByBarber.size}>
            {!tipsByBarber.size ? <Empty>No tips in the last 30 days.</Empty> : (
              <ul>{[...tipsByBarber.values()].sort((a, b) => b.total - a.total).map((entry) => <li key={entry.name} className="flex justify-between gap-3 border-b py-2.5 text-sm last:border-b-0"><span>{entry.name}</span><span className="font-mono tabular-nums">{money(entry.total)}</span></li>)}</ul>
            )}
          </Section>
        </div>
      </div>
    </PageContainer>
  );
}
