import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { formatShopDateTime } from '@/features/shared/shop-time';
import { DataTable, Empty, Notice, PageHeader, Pill, Section, selectClass, StatusCell, StatusTabs, Td, type Tone } from '@/features/platform/lib/ui';
import { getPayrollAction } from '../actions/payroll';
import { BulkCommissionActions, CommissionRowActions, PayBarberButton } from '../components/PayrollControls';

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'page' as const, label: 'Platform' },
  { type: 'page' as const, label: 'Payroll' },
];
const money = (cents?: number | null) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100);
const tone: Record<string, Tone> = { projected: 'wait', approved: 'info', paid: 'live', voided: 'off' };
const STATUS: Record<string, string> = { projected: 'To approve', approved: 'Approved', paid: 'Paid', voided: 'Voided' };
const num = 'text-right tabular-nums whitespace-nowrap';

export default async function PayrollPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const data = await getPayrollAction({ status: typeof params.status === 'string' ? params.status : undefined, barberId: typeof params.barber === 'string' ? params.barber : undefined });
  if (!data) {
    const header = <PageHeader title="Payroll" tone="alert" meta="Payroll couldn’t load" />;
    return <PageContainer title="Payroll" header={header} breadcrumbs={breadcrumbs}><div className="px-4 pb-8 md:px-6"><Notice tone="alert">Payroll couldn’t load. Your role may not include payments.</Notice></div></PageContainer>;
  }
  const href = (status: string, barber = data.barberId) => `?${new URLSearchParams({ ...(status ? { status } : {}), ...(barber ? { barber } : {}) }).toString()}`;
  const owed = data.approvedByBarber.reduce((sum, group) => sum + group.total, 0);

  // One row per barber: tips (30 days), last payout and what is approved and unpaid.
  const tips = new Map<string, number>();
  let unassignedTips = 0;
  for (const tip of data.tips) {
    if (tip.barber) tips.set(tip.barber.id, (tips.get(tip.barber.id) || 0) + (tip.amount || 0));
    else unassignedTips += tip.amount || 0;
  }
  const lastPayout = new Map<string, (typeof data.payouts)[number]>();
  for (const payout of data.payouts) if (payout.barber && !lastPayout.has(payout.barber.id)) lastPayout.set(payout.barber.id, payout);
  const due = new Map(data.approvedByBarber.map((group) => [group.barber.id, group]));
  const roster = [...data.barbers, ...data.approvedByBarber.map((group) => group.barber).filter((barber) => !data.barbers.some((row) => row.id === barber.id))]
    .map((barber) => ({ barber, tips: tips.get(barber.id) || 0, payout: lastPayout.get(barber.id), due: due.get(barber.id) }))
    .sort((a, b) => (b.due?.total || 0) - (a.due?.total || 0) || a.barber.displayName.localeCompare(b.barber.displayName));
  const shownIds = data.commissions.map((row) => row.id);

  const header = (
    <PageHeader
      title="Payroll"
      tone={owed ? 'wait' : undefined}
      meta={owed ? `${money(owed)} approved and unpaid · ${data.approvedByBarber.length} ${data.approvedByBarber.length === 1 ? 'barber' : 'barbers'}` : 'Nothing approved and unpaid'}
    />
  );

  return (
    <PageContainer title="Payroll" header={header} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-8 px-4 pb-24 md:px-6">
        <Section id="payroll-owed" title="Owed by barber" count={roster.length}>
          {!roster.length ? <Empty>No barbers yet.</Empty> : (
            <DataTable label="Owed by barber" className="relative" head={[
              { label: 'Barber' },
              { label: 'Tips, 30 days', className: 'text-right' },
              { label: 'Last payout', className: 'hidden text-right sm:table-cell' },
              { label: 'Due', className: 'text-right' },
              { label: <span className="sr-only">Pay</span>, className: 'w-px' },
            ]}>
              {roster.map((row) => (
                <tr key={row.barber.id} className="hover:bg-muted/30">
                  <Td className="align-middle">
                    <span className="block font-medium">{row.barber.displayName}</span>
                    <span className="block text-xs text-muted-foreground">{row.due ? `${row.due.ids.length} approved ${row.due.ids.length === 1 ? 'commission' : 'commissions'}` : 'Nothing approved'}</span>
                  </Td>
                  <Td className={`${num} align-middle`}>{row.tips ? money(row.tips) : <span className="text-muted-foreground">—</span>}</Td>
                  <Td className={`${num} hidden align-middle sm:table-cell`}>{row.payout ? <><span className="block">{money(row.payout.totalAmount)}</span><span className="block text-xs text-muted-foreground">{formatShopDateTime(row.payout.paidAt, data.timezone)}</span></> : <span className="text-muted-foreground">—</span>}</Td>
                  <Td className={`${num} align-middle font-semibold`}>{row.due ? money(row.due.total) : <span className="font-normal text-muted-foreground">{money(0)}</span>}</Td>
                  <Td className="align-middle text-right">{row.due ? <PayBarberButton name={row.barber.displayName} ids={row.due.ids.slice(0, 100)} total={money(row.due.total)} /> : null}</Td>
                </tr>
              ))}
            </DataTable>
          )}
          {unassignedTips ? <p className="pt-2 text-xs text-muted-foreground">Tips with no barber, 30 days: <span className="tabular-nums">{money(unassignedTips)}</span></p> : null}
        </Section>

        <Section id="payroll-commissions" title="Commissions" actions={<BulkCommissionActions ids={shownIds} status={data.status} />}>
          <div className="flex flex-col gap-3 pb-3 lg:flex-row lg:items-end lg:justify-between">
            <StatusTabs label="Commission status" current={data.status} hrefFor={(value) => href(value)} tabs={[
              { value: 'projected', label: 'To approve', count: data.counts.projected },
              { value: 'approved', label: 'Approved', count: data.counts.approved },
              { value: 'paid', label: 'Paid', count: data.counts.paid },
              { value: 'voided', label: 'Voided', count: data.counts.voided },
            ]} />
            <form className="flex items-center gap-2" action="/dashboard/platform/payroll">
              <input type="hidden" name="status" value={data.status} />
              <select name="barber" defaultValue={data.barberId} aria-label="Barber" className={`${selectClass} w-44`}><option value="">All barbers</option>{data.barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.displayName}</option>)}</select>
              <Pill type="submit" size="sm">Filter</Pill>
            </form>
          </div>
          {!data.commissions.length ? <Empty>No commissions here.</Empty> : (
            <DataTable label="Commissions" className="relative" head={[
              { label: 'When' },
              { label: 'Barber' },
              { label: 'Visit', className: 'hidden md:table-cell' },
              { label: 'Rate', className: 'hidden text-right sm:table-cell' },
              { label: 'Commission', className: 'text-right' },
              { label: 'Status', className: 'hidden sm:table-cell' },
              { label: <span className="sr-only">Actions</span>, className: 'w-px' },
            ]}>
              {data.commissions.map((row) => {
                const when = row.appointment?.startsAt || row.transaction?.completedAt || row.createdAt;
                const customer = [row.appointment?.customer?.firstName, row.appointment?.customer?.lastName].filter(Boolean).join(' ');
                return (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <Td className="whitespace-nowrap align-middle tabular-nums">{formatShopDateTime(when, data.timezone)}</Td>
                    <Td className="align-middle font-medium">{row.barber?.displayName || 'No barber'}</Td>
                    <Td className="hidden align-middle md:table-cell"><span className="block">{row.appointment?.serviceTitleSnapshot || 'Retail sale'}</span>{customer ? <span className="block text-xs text-muted-foreground">{customer}</span> : null}</Td>
                    <Td className={`${num} hidden align-middle text-muted-foreground sm:table-cell`}>{row.commissionRate ?? '0'}% of {money((row.serviceAmount || 0) + (row.productAmount || 0))}</Td>
                    <Td className={`${num} align-middle font-medium`}>{money(row.commissionAmount)}</Td>
                    <Td className="hidden align-middle sm:table-cell"><StatusCell tone={tone[row.status] || 'off'}>{STATUS[row.status] || row.status}</StatusCell>{row.paidAt ? <span className="block text-xs text-muted-foreground">{formatShopDateTime(row.paidAt, data.timezone)}</span> : null}</Td>
                    <Td className="align-middle text-right"><CommissionRowActions id={row.id} status={row.status} /></Td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </Section>

        <Section id="payroll-payouts" title="Payouts" count={data.payouts.length}>
          {!data.payouts.length ? <Empty>No payouts yet.</Empty> : (
            <DataTable label="Payouts" className="relative" head={[
              { label: 'Paid' },
              { label: 'Barber' },
              { label: 'Commissions', className: 'hidden text-right sm:table-cell' },
              { label: 'Reference', className: 'hidden md:table-cell' },
              { label: 'Amount', className: 'text-right' },
            ]}>
              {data.payouts.map((payout) => (
                <tr key={payout.id}>
                  <Td className="whitespace-nowrap tabular-nums">{formatShopDateTime(payout.paidAt, data.timezone)}</Td>
                  <Td>{payout.barber?.displayName || '—'}</Td>
                  <Td className={`${num} hidden sm:table-cell`}>{payout.commissionCount}</Td>
                  <Td className="hidden max-w-64 truncate text-muted-foreground md:table-cell">{payout.notes || '—'}</Td>
                  <Td className={`${num} font-medium`}>{money(payout.totalAmount)}</Td>
                </tr>
              ))}
            </DataTable>
          )}
        </Section>
      </div>
    </PageContainer>
  );
}
