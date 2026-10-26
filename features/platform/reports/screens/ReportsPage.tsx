import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { DataTable, Empty, PageHeader, Pill, Section, Td, type Tone } from '@/features/platform/lib/ui';
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
        <Input id="report-start" type="date" name="start" defaultValue={startDate} className="h-9 w-40 rounded-[6px] tabular-nums" />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="report-end" className="text-xs text-muted-foreground">To</Label>
        <Input id="report-end" type="date" name="end" defaultValue={endDate} className="h-9 w-40 rounded-[6px] tabular-nums" />
      </div>
      <Pill type="submit">Show range</Pill>
    </form>
  );
}

/** "Oct 1 – 25, 2026": one format for the whole page, read from the shop-day keys. */
function rangeLabel(startDate: string, endDate: string) {
  const parse = (key: string) => new Date(`${key}T12:00:00Z`);
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).formatRange(parse(startDate), parse(endDate));
  } catch { return `${startDate} – ${endDate}`; }
}

function Performance({ id, title, noun, rows, money }: { id: string; title: string; noun: string; rows: PerformanceRow[]; money: (cents: number) => string }) {
  const total = rows.reduce((sum, row) => sum + row.revenue, 0);
  return (
    <Section id={id} title={title} count={rows.length}>
      {!rows.length ? <Empty>No settled service lines in this range.</Empty> : (
        <DataTable label={title} className="relative" head={[
          { label: noun },
          { label: 'Visits', className: 'text-right' },
          { label: 'Revenue', className: 'text-right' },
          { label: 'Share', className: 'hidden w-40 sm:table-cell' },
        ]}>
          {rows.map((row) => {
            const share = total ? Math.round((row.revenue / total) * 100) : 0;
            return (
              <tr key={row.key}>
                <Td className="align-middle"><span className="font-medium">{row.name}</span>{!row.linked ? <span className="block text-xs text-muted-foreground">No linked record</span> : row.duplicateName ? <span className="block text-xs text-muted-foreground">Separate record, same name</span> : null}</Td>
                <Td className="align-middle text-right tabular-nums">{row.appointments}</Td>
                <Td className="align-middle text-right font-medium tabular-nums">{money(row.revenue)}</Td>
                <Td className="hidden align-middle sm:table-cell">
                  <span className="flex items-center gap-2"><span className="h-1.5 flex-1 overflow-hidden rounded-[2px] bg-muted"><span className="block h-full bg-foreground/70" style={{ width: `${Math.max(share ? 2 : 0, share)}%` }} /></span><span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{share}%</span></span>
                </Td>
              </tr>
            );
          })}
        </DataTable>
      )}
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
      header={header(<><span className="tabular-nums">{rangeLabel(range.startDate, range.endDate)}</span> · {range.days} shop {range.days === 1 ? 'day' : 'days'} · {money(summary.revenue.paidTotal)} net · {summary.appointments.completed || 0} completed</>)}
      breadcrumbs={breadcrumbs}
    >
      <div className="flex min-w-0 flex-col gap-8 px-4 pb-24 md:px-6">
        <RangeForm startDate={range.startDate} endDate={range.endDate} />
        <div className="grid min-w-0 gap-8 xl:grid-cols-2">
          <Performance id="rep-barbers" title="By barber" noun="Barber" rows={summary.barberPerformance} money={money} />
          <Performance id="rep-services" title="By service" noun="Service" rows={summary.servicePerformance} money={money} />
        </div>
        <div className="grid min-w-0 gap-8 lg:grid-cols-3">
          {groups.map((group) => (
            <Section key={group.id} id={group.id} title={group.title}>
              <dl>
                {group.rows.map(([label, value]) => <div key={label} className="flex items-baseline justify-between gap-3 border-b py-2.5 text-sm last:border-b-0"><dt className="text-muted-foreground">{label}</dt><dd className="tabular-nums">{value}</dd></div>)}
              </dl>
            </Section>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
