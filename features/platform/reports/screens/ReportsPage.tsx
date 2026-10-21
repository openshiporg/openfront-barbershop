import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { formatShopDateTime } from '@/features/shared/shop-time';
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

function header(description?: string) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Reports</h1>
      <p className="text-muted-foreground">{description || 'Revenue, appointments, walk-ins, and performance for a shop-local date range.'}</p>
    </div>
  );
}

function RangeForm({ startDate, endDate }: { startDate?: string; endDate?: string }) {
  return (
    <form action={`${basePath}/platform/reports`} className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1">
        <Label htmlFor="report-start">From</Label>
        <Input id="report-start" type="date" name="start" defaultValue={startDate} className="w-44" />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="report-end">To</Label>
        <Input id="report-end" type="date" name="end" defaultValue={endDate} className="w-44" />
      </div>
      <Button type="submit" variant="outline">Update report</Button>
    </form>
  );
}

function Performance({ title, rows, money }: { title: string; rows: PerformanceRow[]; money: (cents: number) => string }) {
  return <section className="min-w-0 rounded-lg border bg-card p-5"><h2 className="mb-4 font-semibold">{title}</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="py-3">Name</th><th>Service lines</th><th className="text-right">Net service value</th></tr></thead><tbody>{rows.map(row => <tr key={row.key} className="border-t"><td className="py-3">{row.name}{!row.linked && <span className="ml-2 text-xs text-muted-foreground">(no linked record)</span>}{row.linked && row.duplicateName && <span className="ml-2 text-xs text-muted-foreground">(separate record with the same name)</span>}</td><td>{row.appointments}</td><td className="text-right">{money(row.revenue)}</td></tr>)}</tbody></table>{!rows.length ? <p className="py-3 text-sm text-muted-foreground">No settled service lines in this range.</p> : null}</div></section>;
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
      <PageContainer title="Reports" header={header()} breadcrumbs={breadcrumbs}>
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
  const rows = [
    ['Net checkout totals', money(summary.revenue.paidTotal)],
    ['Checkout receipts', String(summary.revenue.transactionCount)],
    ['Completed appointments', String(summary.appointments.completed || 0)],
    ['Tips collected', money(summary.revenue.tips)],
    ['No-shows', String(summary.appointments.no_show || 0)],
    ['Cancellations', String(summary.appointments.cancelled || 0)],
    ['Walk-ins served', String(summary.queue.served || 0)],
    ['Walk-ins left', String(summary.queue.left || 0)],
    ['Retail product sales', money(summary.revenue.productSales)],
    ['Commission payouts', money(summary.payouts.total)],
    ['Estimated unused balance value', money(summary.liabilities.memberships)],
    ['Active/paused balances', String(summary.liabilities.activeBalances)],
  ];

  return (
    <PageContainer title="Reports" header={header()} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-6 px-4 pb-8 md:px-6">
        <RangeForm startDate={range.startDate} endDate={range.endDate} />
        <dl className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <div><dt className="font-medium text-foreground">Reporting period</dt><dd>{range.startDate} to {range.endDate} ({range.days} shop days, {range.timeZone}) · {formatShopDateTime(range.start, range.timeZone)} – {formatShopDateTime(range.end, range.timeZone)}</dd></div>
          <div><dt className="font-medium text-foreground">Balance valuation</dt><dd>Current active/paused balances, not limited to this period · estimate, not an accounting liability</dd></div>
        </dl>
        <section className="rounded-lg border bg-card p-5"><h2 className="mb-4 font-semibold">Shop activity</h2><table className="w-full text-left text-sm"><thead><tr><th className="pb-3">Measure</th><th className="pb-3 text-right">Value</th></tr></thead><tbody>{rows.map(([label, value]) => <tr key={label} className="border-t"><th className="py-3 font-normal">{label}</th><td className="py-3 text-right tabular-nums">{value}</td></tr>)}</tbody></table></section>
        <div className="grid min-w-0 gap-4 lg:grid-cols-2"><Performance title="Service performance" rows={summary.servicePerformance} money={money} /><Performance title="Barber performance" rows={summary.barberPerformance} money={money} /></div>
      </div>
    </PageContainer>
  );
}
