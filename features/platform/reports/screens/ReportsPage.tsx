import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { formatShopDateTime } from '@/features/shared/shop-time';
import { Empty, PageHeader, Pill, Readouts, Section, Track, type Tone } from '@/features/platform/lib/ui';
import { getReportsSummary } from '../actions/reports';
import type { PerformanceRow } from '../lib/reportsTypes';

interface PageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'page' as const, label: 'Platform' },
  { type: 'page' as const, label: 'Reports' },
];

function header(meta?: React.ReactNode, tone?: Tone) {
  return <PageHeader title="Reports" tone={tone} meta={meta} />;
}

function RangeForm({ startDate, endDate }: { startDate?: string; endDate?: string }) {
  return (
    <form action={`${basePath}/platform/reports`} className="flex flex-wrap items-end gap-2">
      <div className="grid gap-1">
        <Label htmlFor="report-start" className="text-xs text-muted-foreground">From</Label>
        <Input id="report-start" type="date" name="start" defaultValue={startDate} className="w-40 font-mono" />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="report-end" className="text-xs text-muted-foreground">To</Label>
        <Input id="report-end" type="date" name="end" defaultValue={endDate} className="w-40 font-mono" />
      </div>
      <Track><Pill type="submit">Update</Pill></Track>
    </form>
  );
}

function Performance({ id, title, rows, money }: { id: string; title: string; rows: PerformanceRow[]; money: (cents: number) => string }) {
  const top = Math.max(1, ...rows.map((row) => row.revenue));
  return (
    <Section id={id} title={title} count={rows.length}>
      <ul>
        {rows.map((row) => (
          <li key={row.key} className="border-b py-2.5 last:border-b-0">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{row.name}{!row.linked && <span className="ml-2 text-xs font-normal text-muted-foreground">no linked record</span>}{row.linked && row.duplicateName && <span className="ml-2 text-xs font-normal text-muted-foreground">separate record, same name</span>}</span>
              <span className="shrink-0 font-mono tabular-nums">{money(row.revenue)}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-foreground/70" style={{ width: `${Math.max(2, Math.round((row.revenue / top) * 100))}%` }} /></span>
              <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">{row.appointments} {row.appointments === 1 ? 'visit' : 'visits'}</span>
            </div>
          </li>
        ))}
      </ul>
      {!rows.length ? <Empty>No settled service lines in this range.</Empty> : null}
    </Section>
  );
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const startDate = typeof params.start === 'string' ? params.start : undefined;
  const endDate = typeof params.end === 'string' ? params.end : undefined;
  const result = await getReportsSummary({ startDate, endDate });

  if (!result.ok) {
    const message = result.kind === 'forbidden'
      ? 'Reports access restricted. Ask a shop owner to review your role.'
      : result.kind === 'invalid' ? result.message || 'Choose a valid report range.' : 'Reports are temporarily unavailable. Refresh to try again.';
    return (
      <PageContainer title="Reports" header={header(undefined, 'alert')} breadcrumbs={breadcrumbs}>
        <div className="space-y-4 px-4 pb-8 md:px-6">
          {result.kind !== 'forbidden' && <RangeForm startDate={startDate} endDate={endDate} />}
          <Alert variant="destructive"><AlertDescription>{message}</AlertDescription></Alert>
        </div>
      </PageContainer>
    );
  }

  const summary = result.data;
  const { range } = summary;
  const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: range.currencyCode || 'USD' }).format(cents / 100);
  const groups: Array<{ id: string; title: string; rows: Array<[string, string]> }> = [
    { id: 'rep-money', title: 'Money', rows: [
      ['Net checkout totals', money(summary.revenue.paidTotal)],
      ['Checkout receipts', String(summary.revenue.transactionCount)],
      ['Tips collected', money(summary.revenue.tips)],
      ['Retail product sales', money(summary.revenue.productSales)],
      ['Commission payouts', money(summary.payouts.total)],
    ] },
    { id: 'rep-chairs', title: 'Chairs', rows: [
      ['Completed appointments', String(summary.appointments.completed || 0)],
      ['No-shows', String(summary.appointments.no_show || 0)],
      ['Cancellations', String(summary.appointments.cancelled || 0)],
      ['Walk-ins served', String(summary.queue.served || 0)],
      ['Walk-ins left', String(summary.queue.left || 0)],
    ] },
    { id: 'rep-balances', title: 'Open balances (current, estimate)', rows: [
      ['Unused balance value', money(summary.liabilities.memberships)],
      ['Active / paused balances', String(summary.liabilities.activeBalances)],
    ] },
  ];

  return (
    <PageContainer
      title="Reports"
      header={header(<><span className="font-mono tabular-nums">{range.startDate} → {range.endDate}</span> · {range.days} shop days · {range.timeZone}</>)}
      breadcrumbs={breadcrumbs}
    >
      <div className="flex min-w-0 flex-col gap-8 px-4 pb-8 md:px-6">
        <RangeForm startDate={range.startDate} endDate={range.endDate} />
        <Readouts items={[
          { label: 'Net checkout', value: money(summary.revenue.paidTotal) },
          { label: 'Completed', value: summary.appointments.completed || 0 },
          { label: 'Walk-ins served', value: summary.queue.served || 0 },
          { label: 'No-shows', value: summary.appointments.no_show || 0, tone: summary.appointments.no_show ? 'alert' : undefined },
        ]} />
        <p className="font-mono text-xs tabular-nums text-muted-foreground">{formatShopDateTime(range.start, range.timeZone)} – {formatShopDateTime(range.end, range.timeZone)}</p>
        <div className="grid min-w-0 gap-8 lg:grid-cols-3">
          {groups.map((group) => (
            <Section key={group.id} id={group.id} title={group.title}>
              <dl>
                {group.rows.map(([label, value]) => <div key={label} className="flex items-baseline justify-between gap-3 border-b py-2.5 text-sm last:border-b-0"><dt className="text-muted-foreground">{label}</dt><dd className="font-mono tabular-nums">{value}</dd></div>)}
              </dl>
            </Section>
          ))}
        </div>
        <div className="grid min-w-0 gap-8 lg:grid-cols-2">
          <Performance id="rep-services" title="Services" rows={summary.servicePerformance} money={money} />
          <Performance id="rep-barbers" title="Barbers" rows={summary.barberPerformance} money={money} />
        </div>
      </div>
    </PageContainer>
  );
}
