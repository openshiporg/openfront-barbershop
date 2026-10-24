import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { Empty, PageHeader, PillLink, Readouts, Section, StatusDot, Tag, Track, type Tone } from '@/features/platform/lib/ui';
import { WorkforceControls } from './WorkforceControls';
import { BarberAccountLink } from './BarberAccountLink';

type Schedule = { id: string; dayOfWeek: string; isWorking: boolean; startMinute?: number | null; endMinute?: number | null; breakStartMinute?: number | null; breakEndMinute?: number | null };
type Data = {
  timeZone: string | null;
  barbers: Array<{ id: string; displayName: string; status: string; bookingEnabled: boolean; chairNumber?: string; chair?: { id: string; chairNumber?: string; status: string } | null; serviceCommissionRateBps?: number; projectedCommission: number | null; specialties: Array<{ id: string; name: string }>; schedules: Schedule[]; shifts: Array<{ id: string; status: string; scheduledStart: string; scheduledEnd: string; clockedInAt?: string | null }>; scheduleExceptions: Array<{ id: string; exceptionType: string; startsAt: string; endsAt: string; reason: string }>; openShiftCount: number; upcomingExceptionCount: number; accountLinked?: boolean; linkedUserId?: string | null }>;
  // Active shop members for account linking; null unless the viewer is an owner or manager.
  members?: Array<{ id: string; name: string; email: string | null }> | null;
  shopWideExceptions: Array<{ id: string; exceptionType: string; startsAt: string; endsAt: string; reason: string }>;
  shopWideExceptionCount: number;
  metrics: { total: number; bookable: number; workingDays: number; projectedCommission: number | null; openShifts: number; upcomingExceptions: number };
  // Commission figures require current payment authority; null means not shown, never zero.
  commissionAccess?: 'granted' | 'restricted';
  commissionTruncated?: boolean;
};

const money = (value?: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((value || 0) / 100);
const commissionLabel = (value: number | null | undefined, access?: 'granted' | 'restricted') =>
  typeof value === 'number' ? money(value) : access === 'granted' ? 'Unavailable' : 'Restricted';
const DAYS: Record<string, string> = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
const clock = (minute?: number | null) => minute == null ? '—' : `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const filterBy = (field: string, id: string) => `?!${field}_is=${encodeURIComponent(JSON.stringify(id))}`;

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'page' as const, label: 'Platform' },
  { type: 'page' as const, label: 'Barbers & schedules' },
];

function header(tone?: Tone) {
  return (
    <PageHeader
      title="Barbers & schedules"
      tone={tone}
      actions={<Track><PillLink variant="primary" href="/dashboard/platform/staff/new"><Plus /> Barber</PillLink><PillLink href="/dashboard/platform/staff/chairs">Chairs</PillLink></Track>}
    />
  );
}

function MoreLink({ shown, total, href, label }: { shown: number; total: number; href: string; label: string }) {
  if (total <= shown) return null;
  return <p className="pt-2 text-xs text-muted-foreground"><span className="font-mono tabular-nums">{shown} / {total}</span> {label} · <Link className="font-medium text-foreground underline-offset-4 hover:underline" href={href}>All</Link></p>;
}

export default async function StaffPage() {
  const response = await keystoneClient<{ platformStaff: { success: boolean; error?: string; data?: Data } }>(`query StaffProjection { platformStaff { success error data } }`, {}, { cache: 'no-store' });
  const result = response.data?.platformStaff;

  if (!response.success || !result?.success || !result.data) {
    return (
      <PageContainer title="Barbers & schedules" header={header('alert')} breadcrumbs={breadcrumbs}>
        <div className="px-4 pb-8 md:px-6">
          <Alert variant="destructive"><AlertDescription>{result?.error || response.error || 'The staff roster is temporarily unavailable. Refresh to try again.'}</AlertDescription></Alert>
        </div>
      </PageContainer>
    );
  }

  const data = result.data;
  return (
    <PageContainer title="Barbers & schedules" header={header()} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-8 px-4 pb-8 md:px-6">
        <Readouts items={[
          { label: 'Barbers', value: data.metrics.total },
          { label: 'Bookable', value: data.metrics.bookable, tone: data.metrics.bookable ? 'live' : 'off' },
          { label: 'Open shifts', value: data.metrics.openShifts },
          { label: 'Projected commission', value: commissionLabel(data.metrics.projectedCommission ?? null, data.commissionAccess) },
        ]} />

        <Section id="staff-closures" title="Shop closures" tone={data.shopWideExceptions.length ? 'wait' : undefined} count={data.shopWideExceptionCount}>
          <WorkforceControls timeZone={data.timeZone} shifts={[]} exceptions={data.shopWideExceptions} />
          <MoreLink shown={data.shopWideExceptions.length} total={data.shopWideExceptionCount} href={`${basePath}/schedule-exceptions`} label="closures" />
        </Section>

        {!data.barbers.length && (
          <Section id="staff-empty" title="Roster" count={0}>
            <Empty>No barbers yet. <Link className="underline" href="/dashboard/platform/staff/new">Add a barber</Link></Empty>
          </Section>
        )}

        <div className="grid min-w-0 gap-x-10 gap-y-10 xl:grid-cols-2">
          {data.barbers.map((barber) => {
            const byDay = new Map(barber.schedules.map((schedule) => [schedule.dayOfWeek, schedule]));
            const chair = barber.chair?.chairNumber || barber.chairNumber;
            return (
              <section key={barber.id} aria-labelledby={`barber-${barber.id}`} className="min-w-0">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
                  <div className="min-w-0">
                    <h2 id={`barber-${barber.id}`} className="text-lg font-semibold tracking-tight"><StatusDot tone={barber.bookingEnabled ? 'live' : 'off'} /><Link className="hover:underline" href={`/dashboard/platform/staff/${barber.id}`}>{barber.displayName}</Link></h2>
                    <p className="text-xs text-muted-foreground"><span className="font-mono">{chair ? `Chair ${chair}` : 'No chair'}</span>{barber.chair && barber.chair.status !== 'active' ? ` (${barber.chair.status})` : ''}{barber.status !== 'active' ? ` · ${barber.status}` : ''} · {barber.bookingEnabled ? 'Books online' : 'Not booking online'} · {barber.accountLinked ? 'Account linked' : 'No login'}</p>
                  </div>
                  <Track>
                    <PillLink size="sm" href={`/dashboard/platform/staff/${barber.id}`}>Profile</PillLink>
                    <PillLink size="sm" href={`/dashboard/platform/staff/${barber.id}#barber-hours`}>Hours</PillLink>
                  </Track>
                </div>

                <ol className="mt-3 grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-border ring-1 ring-border" aria-label={`${barber.displayName} weekly hours`}>
                  {Object.entries(DAYS).map(([day, short]) => {
                    const schedule = byDay.get(day);
                    const working = Boolean(schedule?.isWorking);
                    return (
                      <li key={day} className={`min-w-0 px-1 py-2 text-center ${working ? 'bg-background' : 'bg-muted/60 text-muted-foreground'}`}>
                        <p className="text-[10px] font-medium uppercase tracking-wider">{short}</p>
                        <p className="mt-1 font-mono text-[10px] leading-tight tabular-nums sm:text-[11px]">{working ? <>{clock(schedule?.startMinute)}<br />{clock(schedule?.endMinute)}</> : schedule ? 'off' : '—'}</p>
                      </li>
                    );
                  })}
                </ol>
                {barber.schedules.some((schedule) => schedule.breakStartMinute != null) && (
                  <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">Breaks: {barber.schedules.filter((schedule) => schedule.isWorking && schedule.breakStartMinute != null).map((schedule) => `${DAYS[schedule.dayOfWeek] || schedule.dayOfWeek} ${clock(schedule.breakStartMinute)}–${clock(schedule.breakEndMinute)}`).join(' · ')}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5">{barber.specialties.map((service) => <Tag key={service.id}>{service.name}</Tag>)}{!barber.specialties.length && <span className="text-xs text-muted-foreground">No services assigned.</span>}</div>

                <dl className="mt-3 grid grid-cols-2 gap-4 border-t pt-3 text-sm">
                  <div><dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Commission rate</dt><dd className="font-mono font-semibold tabular-nums">{((barber.serviceCommissionRateBps || 0) / 100).toFixed(0)}%</dd></div>
                  <div><dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Projected</dt><dd className="font-mono font-semibold tabular-nums">{commissionLabel(barber.projectedCommission, data.commissionAccess)}</dd></div>
                </dl>

                {data.members && <BarberAccountLink barberId={barber.id} linkedUserId={barber.linkedUserId ?? null} members={data.members} />}
                <WorkforceControls timeZone={data.timeZone} barberId={barber.id} chairId={barber.chair?.id} shifts={barber.shifts} exceptions={barber.scheduleExceptions} />
                <MoreLink shown={barber.shifts.length} total={barber.openShiftCount} href={`${basePath}/staff-shifts${filterBy('barber', barber.id)}`} label="open shifts" />
                <MoreLink shown={barber.scheduleExceptions.length} total={barber.upcomingExceptionCount} href={`${basePath}/schedule-exceptions${filterBy('barber', barber.id)}`} label="upcoming exceptions" />
              </section>
            );
          })}
        </div>
      </div>
    </PageContainer>
  );
}
