import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { formatShopDateTime } from '@/features/shared/shop-time';
import { Empty, Notice, PageHeader, Section, StatusDot, Track, type Tone } from '@/features/platform/lib/ui';
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

function inForce(policy: BookingPolicyRow, now: number) {
  return policy.status === 'active' && new Date(policy.effectiveFrom).getTime() <= now && (!policy.effectiveUntil || new Date(policy.effectiveUntil).getTime() > now);
}

export default async function PoliciesPage() {
  const data = await getPoliciesAction();
  const now = data?.now ?? 0;
  const current = data?.booking.find((policy) => inForce(policy, now));
  const header = <PageHeader title="Policies" tone={data ? (current ? 'live' : 'alert') : 'alert'} meta={data ? (current ? `Booking policy ${current.version} in force` : 'No booking policy in force: online booking is closed') : undefined} />;
  if (!data) return <PageContainer title="Policies" header={header} breadcrumbs={breadcrumbs}><div className="px-4 pb-8 md:px-6"><Notice tone="alert">Select an active shop first.</Notice></div></PageContainer>;
  const policyTone = (policy: BookingPolicyRow): Tone => (inForce(policy, now) ? 'live' : policy.status === 'active' ? 'wait' : 'off');
  return (
    <PageContainer title="Policies" header={header} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-8 px-4 pb-8 md:px-6">
        <Section id="booking-policy" title="Booking policy" tone={current ? 'live' : 'alert'} actions={<Track><PublishPolicyButton current={current} jurisdictionCode={data.jurisdictionCode} /></Track>}>
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

        <Section id="policy-history" title="Versions" count={data.booking.length}>
          {!data.booking.length ? <Empty>No versions yet.</Empty> : (
            <ul>
              {data.booking.map((policy) => (
                <li key={policy.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-2.5 text-sm last:border-b-0">
                  <span className="min-w-0"><span className="font-medium"><StatusDot tone={policyTone(policy)} />{policy.name}</span> <span className="font-mono text-xs text-muted-foreground">{policy.version}</span><span className="block text-xs text-muted-foreground">{inForce(policy, now) ? 'In force' : policy.status === 'retired' ? 'Retired' : new Date(policy.effectiveFrom).getTime() > now ? 'Scheduled' : 'Ended'} · from {formatShopDateTime(policy.effectiveFrom, data.timezone)}{policy.effectiveUntil ? ` to ${formatShopDateTime(policy.effectiveUntil, data.timezone)}` : ''}</span></span>
                  {!inForce(policy, now) ? <RetirePolicy policy={policy} /> : null}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="noshow-policies" title="No-show policies" count={data.noShow.length} actions={<Track><NewNoShowPolicyButton /></Track>}>
          {!data.noShow.length ? <Empty>No no-show policy. No-shows are recorded without a fee.</Empty> : (
            <ul>
              {data.noShow.map((policy) => (
                <li key={policy.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0">
                  <span className="min-w-0"><span className="font-medium"><StatusDot tone={policy.status === 'active' ? 'live' : policy.status === 'paused' ? 'wait' : 'off'} />{policy.name}</span><span className="block text-xs text-muted-foreground"><span className="font-mono">{money(policy.feeAmount)}</span> after {policy.graceMinutes} min grace{policy.appliesToMemberships ? ' · members too' : ' · not members'} · {policy.eventsCount} recorded</span></span>
                  <NoShowPolicyActions policy={policy} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </PageContainer>
  );
}
