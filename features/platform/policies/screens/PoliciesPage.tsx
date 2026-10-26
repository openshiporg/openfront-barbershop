import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { formatShopDateTime } from '@/features/shared/shop-time';
import { DataTable, Empty, Notice, PageHeader, Section, StatusCell, Td, type Tone } from '@/features/platform/lib/ui';
import { getPoliciesAction, type BookingPolicyRow } from '../actions/policies';
import { NewNoShowPolicyButton, NoShowPolicyActions, PublishPolicyButton, RetirePolicy } from '../components/PolicyControls';

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'page' as const, label: 'Platform' },
  { type: 'page' as const, label: 'Policies' },
];
const money = (cents?: number | null) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100);
const hours = (minutes: number) => `${Number((minutes / 60).toFixed(1))} h`;
const depositRule: Record<string, string> = { refund: 'deposit refunded', forfeit: 'deposit kept', manual_review: 'deposit reviewed by staff' };

// Seeded first versions carry a placeholder start (the epoch or 2020-01-01), which
// reads as "Dec 31, 2019" in a US timezone. Show those as in force since setup.
const PLACEHOLDER_BEFORE = Date.UTC(2020, 0, 2);
function effectiveLabel(value: string | null | undefined, timeZone: string) {
  const time = value ? new Date(value).getTime() : NaN;
  if (!Number.isFinite(time) || time < PLACEHOLDER_BEFORE) return 'Since setup';
  return formatShopDateTime(value!, timeZone);
}

function inForce(policy: BookingPolicyRow, now: number) {
  return policy.status === 'active' && new Date(policy.effectiveFrom).getTime() <= now && (!policy.effectiveUntil || new Date(policy.effectiveUntil).getTime() > now);
}

export default async function PoliciesPage() {
  const data = await getPoliciesAction();
  const now = data?.now ?? 0;
  const current = data?.booking.find((policy) => inForce(policy, now));
  const header = <PageHeader title="Policies" tone={data ? (current ? 'live' : 'alert') : 'alert'} meta={data ? (current ? `Booking policy ${current.version} in force · ${effectiveLabel(current.effectiveFrom, data.timezone) === 'Since setup' ? 'since setup' : `from ${effectiveLabel(current.effectiveFrom, data.timezone)}`}` : 'No booking policy in force: online booking is closed') : undefined} />;
  if (!data) return <PageContainer title="Policies" header={header} breadcrumbs={breadcrumbs}><div className="px-4 pb-8 md:px-6"><Notice tone="alert">Select an active shop first.</Notice></div></PageContainer>;
  const policyTone = (policy: BookingPolicyRow): Tone => (inForce(policy, now) ? 'live' : policy.status === 'active' ? 'wait' : 'off');
  return (
    <PageContainer title="Policies" header={header} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-8 px-4 pb-24 md:px-6">
        <Section id="booking-policy" title="Booking policy" tone={current ? 'live' : 'alert'} actions={<PublishPolicyButton current={current} jurisdictionCode={data.jurisdictionCode} />}>
          {current ? (
            <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-3 border-b py-1.5"><dt className="text-muted-foreground">Free cancellation</dt><dd className="font-mono">{hours(current.cancellationWindowMinutes)} before</dd></div>
              <div className="flex justify-between gap-3 border-b py-1.5"><dt className="text-muted-foreground">Late cancellation fee</dt><dd className="font-mono">{money(current.lateCancellationFeeAmount)}</dd></div>
              <div className="flex justify-between gap-3 border-b py-1.5"><dt className="text-muted-foreground">Free reschedule</dt><dd className="font-mono">{hours(current.rescheduleWindowMinutes)} before</dd></div>
              <div className="flex justify-between gap-3 border-b py-1.5"><dt className="text-muted-foreground">Late reschedule fee</dt><dd className="font-mono">{money(current.rescheduleFeeAmount)}</dd></div>
              <div className="flex justify-between gap-3 border-b py-1.5"><dt className="text-muted-foreground">Reschedules allowed</dt><dd className="font-mono">{current.maxCustomerReschedules ?? 0}</dd></div>
              <div className="flex justify-between gap-3 border-b py-1.5"><dt className="text-muted-foreground">Late cancellation</dt><dd>{depositRule[current.depositCancellationRule] || current.depositCancellationRule}</dd></div>
              <div className="flex justify-between gap-3 border-b py-1.5"><dt className="text-muted-foreground">Bookable online</dt><dd>{current.publicServiceEligibility === 'active_catalog' ? 'Services in an active category' : 'All active services'}</dd></div>
              <div className="flex justify-between gap-3 border-b py-1.5"><dt className="text-muted-foreground">Jurisdiction</dt><dd className="font-mono">{current.jurisdictionCode}</dd></div>
            </dl>
          ) : <Empty>No policy in force.</Empty>}
        </Section>

        <Section id="noshow-policies" title="No-show policies" count={data.noShow.length} actions={<NewNoShowPolicyButton />}>
          {!data.noShow.length ? <Empty>No no-show policy. No-shows are recorded without a fee.</Empty> : (
            <DataTable label="No-show policies" className="relative" head={[
              { label: 'Policy' },
              { label: 'Fee', className: 'text-right' },
              { label: 'Grace', className: 'hidden text-right sm:table-cell' },
              { label: 'Members', className: 'hidden md:table-cell' },
              { label: 'Recorded', className: 'hidden text-right md:table-cell' },
              { label: 'Status', className: 'hidden sm:table-cell' },
              { label: <span className="sr-only">Actions</span>, className: 'w-px' },
            ]}>
              {data.noShow.map((policy) => (
                <tr key={policy.id} className="hover:bg-muted/30">
                  <Td className="align-middle font-medium">{policy.name}</Td>
                  <Td className="align-middle text-right tabular-nums">{money(policy.feeAmount)}</Td>
                  <Td className="hidden align-middle text-right tabular-nums sm:table-cell">{policy.graceMinutes} min</Td>
                  <Td className="hidden align-middle md:table-cell">{policy.appliesToMemberships ? 'Charged' : 'Exempt'}</Td>
                  <Td className="hidden align-middle text-right tabular-nums md:table-cell">{policy.eventsCount}</Td>
                  <Td className="hidden align-middle sm:table-cell"><StatusCell tone={policy.status === 'active' ? 'live' : policy.status === 'paused' ? 'wait' : 'off'}>{policy.status === 'active' ? 'In use' : policy.status === 'paused' ? 'Paused' : 'Archived'}</StatusCell></Td>
                  <Td className="align-middle text-right"><NoShowPolicyActions policy={policy} /></Td>
                </tr>
              ))}
            </DataTable>
          )}
        </Section>

        <Section id="policy-history" title="Booking policy versions" count={data.booking.length}>
          {!data.booking.length ? <Empty>No versions yet.</Empty> : (
            <DataTable label="Booking policy versions" className="relative" head={[
              { label: 'Version' },
              { label: 'Name', className: 'hidden sm:table-cell' },
              { label: 'Effective' },
              { label: 'Status' },
              { label: <span className="sr-only">Actions</span>, className: 'w-px' },
            ]}>
              {data.booking.map((policy) => {
                const state = inForce(policy, now) ? 'In force' : policy.status === 'retired' ? 'Retired' : new Date(policy.effectiveFrom).getTime() > now ? 'Scheduled' : 'Ended';
                return (
                  <tr key={policy.id} className="hover:bg-muted/30">
                    <Td className="align-middle font-mono text-xs">{policy.version}</Td>
                    <Td className="hidden align-middle sm:table-cell">{policy.name}</Td>
                    <Td className="align-middle text-xs tabular-nums text-muted-foreground"><span className="block text-sm text-foreground">{effectiveLabel(policy.effectiveFrom, data.timezone)}</span>{policy.effectiveUntil ? <span className="block">until {formatShopDateTime(policy.effectiveUntil, data.timezone)}</span> : null}</Td>
                    <Td className="align-middle"><StatusCell tone={policyTone(policy)}>{state}</StatusCell></Td>
                    <Td className="align-middle text-right">{!inForce(policy, now) ? <RetirePolicy policy={policy} /> : null}</Td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </Section>
      </div>
    </PageContainer>
  );
}
