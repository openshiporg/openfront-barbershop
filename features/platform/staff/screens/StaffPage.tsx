import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { shopDateKey, shopDayRange, formatShopDateTime } from '@/features/shared/shop-time';
import { cn } from '@/lib/utils';
import { Empty, PageHeader, PillLink, StatusCell, StatusDot, tableWrapClass, thClass, tdClass, type Tone } from '@/features/platform/lib/ui';
import { BarberScheduleDrawer, ShopClosureDrawer } from '../components/RosterControls';

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
const DAYS: Array<[string, string]> = [['monday', 'Mon'], ['tuesday', 'Tue'], ['wednesday', 'Wed'], ['thursday', 'Thu'], ['friday', 'Fri'], ['saturday', 'Sat'], ['sunday', 'Sun']];
const clock = (minute?: number | null) => minute == null ? '—' : `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const filterBy = (field: string, id: string) => `?!${field}_is=${encodeURIComponent(JSON.stringify(id))}`;
const EXCEPTION: Record<string, string> = { time_off: 'Off', working_override: 'Changed', chair_unavailable: 'Chair out', shop_closure: 'Closed' };

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'page' as const, label: 'Platform' },
  { type: 'page' as const, label: 'Barbers & schedules' },
];

function header({ tone, meta, closure }: { tone?: Tone; meta?: string; closure?: React.ReactNode } = {}) {
  return (
    <PageHeader
      title="Barbers & schedules"
      tone={tone}
      meta={meta}
      actions={<div className="flex flex-wrap items-center gap-1.5">{closure}<PillLink href="/dashboard/platform/staff/chairs">Chairs</PillLink><PillLink variant="primary" href="/dashboard/platform/staff/new"><Plus /> Barber</PillLink></div>}
    />
  );
}

/** This week (Mon–Sun) in the shop's timezone, with each day's instant range. */
function shopWeek(timeZone: string | null) {
  const zone = timeZone || 'UTC';
  const today = shopDateKey(new Date(), zone);
  const noon = new Date(`${today}T12:00:00Z`);
  const offset = (noon.getUTCDay() + 6) % 7;
  return DAYS.map(([day, short], index) => {
    const date = new Date(noon);
    date.setUTCDate(noon.getUTCDate() - offset + index);
    const key = date.toISOString().slice(0, 10);
    let range: { start: Date; end: Date } | null = null;
    try { range = shopDayRange(key, zone); } catch { range = null; }
    return { day, short, key, dayOfMonth: date.getUTCDate(), today: key === today, range };
  });
}

type Window = { exceptionType: string; startsAt: string; endsAt: string };
const overlaps = (item: Window, range: { start: Date; end: Date } | null) => Boolean(range && new Date(item.startsAt) < range.end && new Date(item.endsAt) > range.start);

export default async function StaffPage() {
  const response = await keystoneClient<{ platformStaff: { success: boolean; error?: string; data?: Data } }>(`query StaffProjection { platformStaff { success error data } }`, {}, { cache: 'no-store' });
  const result = response.data?.platformStaff;

  if (!response.success || !result?.success || !result.data) {
    return (
      <PageContainer title="Barbers & schedules" header={header({ tone: 'alert' })} breadcrumbs={breadcrumbs}>
        <div className="px-4 pb-8 md:px-6">
          <Alert variant="destructive"><AlertDescription>{result?.error || response.error || 'The staff roster is temporarily unavailable. Refresh to try again.'}</AlertDescription></Alert>
        </div>
      </PageContainer>
    );
  }

  const data = result.data;
  const week = shopWeek(data.timeZone);
  const closedDays = week.filter((day) => data.shopWideExceptions.some((item) => overlaps(item, day.range)));
  const offThisWeek = data.barbers.filter((barber) => barber.scheduleExceptions.some((item) => item.exceptionType === 'time_off' && week.some((day) => overlaps(item, day.range)))).length;
  const meta = [`${data.metrics.bookable} of ${data.metrics.total} bookable online`, offThisWeek ? `${offThisWeek} with time off this week` : null, closedDays.length ? `closed ${closedDays.map((day) => day.short).join(', ')}` : null].filter(Boolean).join(' · ');
  const closure = <ShopClosureDrawer timeZone={data.timeZone} exceptions={data.shopWideExceptions} />;

  return (
    <PageContainer title="Barbers & schedules" header={header({ meta, closure, tone: closedDays.length ? 'wait' : undefined })} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-6 px-4 pb-24 md:px-6">
        {data.shopWideExceptions.length ? (
          <ul aria-label="Shop closures" className="rounded-[6px] border">
            {data.shopWideExceptions.map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b px-3 py-2 text-sm last:border-b-0">
                <span><StatusDot tone="wait" /><span className="font-medium">Shop closed</span> <span className="text-muted-foreground">· {item.reason}</span></span>
                <span className="text-xs tabular-nums text-muted-foreground">{data.timeZone ? `${formatShopDateTime(item.startsAt, data.timeZone)} – ${formatShopDateTime(item.endsAt, data.timeZone)}` : ''}</span>
              </li>
            ))}
            {data.shopWideExceptionCount > data.shopWideExceptions.length ? <li className="px-3 py-2 text-xs text-muted-foreground"><Link className="font-medium text-foreground underline-offset-4 hover:underline" href={`${basePath}/schedule-exceptions`}>All {data.shopWideExceptionCount} closures</Link></li> : null}
          </ul>
        ) : null}

        {!data.barbers.length ? <Empty>No barbers yet. <Link className="underline" href="/dashboard/platform/staff/new">Add a barber</Link></Empty> : (
          <div className={cn(tableWrapClass, 'relative')}>
            <table className="w-full border-collapse text-sm" aria-label="Weekly roster">
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Barber</th>
                  {week.map((day) => <th key={day.day} scope="col" className={cn(thClass, 'hidden w-[4.75rem] px-1.5 text-center lg:table-cell', day.today && 'text-foreground')}>{day.short} <span className="tabular-nums">{day.dayOfMonth}</span>{day.today ? <span className="sr-only"> (today)</span> : null}</th>)}
                  <th scope="col" className={cn(thClass, 'hidden md:table-cell')}>Coming up</th>
                  <th scope="col" className={cn(thClass, 'hidden text-right 2xl:table-cell')}>Commission</th>
                  <th scope="col" className={cn(thClass, 'w-px')}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {data.barbers.map((barber) => {
                  const byDay = new Map(barber.schedules.map((schedule) => [schedule.dayOfWeek, schedule]));
                  const chair = barber.chair?.chairNumber || barber.chairNumber;
                  const chairLabel = chair ? `Chair ${chair}` : undefined;
                  const workingDays = DAYS.filter(([day]) => byDay.get(day)?.isWorking).map(([, short]) => short);
                  const next = [...barber.scheduleExceptions].sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
                  const tone: Tone = barber.status !== 'active' ? 'off' : barber.bookingEnabled ? 'live' : 'wait';
                  return (
                    <tr key={barber.id} className="hover:bg-muted/30">
                      <td className={cn(tdClass, 'min-w-[11rem] align-middle')}>
                        <Link className="font-medium underline-offset-4 hover:underline" href={`/dashboard/platform/staff/${barber.id}`}>{barber.displayName}</Link>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{chairLabel || 'No chair'}{barber.chair && barber.chair.status !== 'active' ? ` (${barber.chair.status})` : ''} · <StatusCell tone={tone}>{barber.status !== 'active' ? barber.status : barber.bookingEnabled ? 'Books online' : 'Staff booking only'}</StatusCell></span>
                        <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground lg:hidden">{workingDays.length ? `Works ${workingDays.join(' ')}` : 'No weekly hours'}</span>
                        <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground 2xl:hidden">{((barber.serviceCommissionRateBps || 0) / 100).toFixed(0)}% commission · {commissionLabel(barber.projectedCommission, data.commissionAccess)} projected</span>
                      </td>
                      {week.map((day) => {
                        const schedule = byDay.get(day.day);
                        const working = Boolean(schedule?.isWorking);
                        const exception = barber.scheduleExceptions.find((item) => overlaps(item, day.range)) || data.shopWideExceptions.find((item) => overlaps(item, day.range));
                        return (
                          <td key={day.day} className={cn(tdClass, 'hidden whitespace-nowrap px-1.5 text-center align-middle tabular-nums lg:table-cell', day.today && 'bg-muted/40', !working && 'text-muted-foreground')}>
                            {working ? <span className={cn('block text-[13px] leading-tight', exception?.exceptionType === 'time_off' || exception?.exceptionType === 'shop_closure' ? 'text-muted-foreground line-through' : '')}><span className="block">{clock(schedule?.startMinute)}</span><span className="sr-only"> to </span><span className="block">{clock(schedule?.endMinute)}</span></span> : <span className="block text-[13px]">{schedule ? 'Off' : '—'}</span>}
                            {exception ? <span className="mt-0.5 inline-flex h-5 items-center rounded-[4px] border border-amber-300 bg-amber-50 px-1.5 text-[11px] font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{EXCEPTION[exception.exceptionType] || exception.exceptionType.replaceAll('_', ' ')}</span> : null}
                          </td>
                        );
                      })}
                      <td className={cn(tdClass, 'hidden max-w-[16rem] align-middle text-xs md:table-cell')}>
                        {/* One line: the next thing on this barber's calendar, else "Clear". */}
                        {next && data.timeZone ? (
                          <span className="block truncate" title={barber.upcomingExceptionCount > 1 ? `${barber.upcomingExceptionCount} upcoming exceptions` : undefined}><StatusDot tone="wait" />{EXCEPTION[next.exceptionType] === 'Off' ? 'Time off' : EXCEPTION[next.exceptionType] || next.exceptionType} from {formatShopDateTime(next.startsAt, data.timeZone)}{barber.upcomingExceptionCount > 1 ? <> · <Link className="underline-offset-4 hover:underline" href={`${basePath}/schedule-exceptions${filterBy('barber', barber.id)}`}>+{barber.upcomingExceptionCount - 1}</Link></> : null}</span>
                        ) : barber.openShiftCount ? (
                          <span className="block truncate text-muted-foreground">{barber.openShiftCount > barber.shifts.length ? <Link className="underline-offset-4 hover:underline" href={`${basePath}/staff-shifts${filterBy('barber', barber.id)}`}>{barber.openShiftCount} open shifts</Link> : `${barber.openShiftCount} open ${barber.openShiftCount === 1 ? 'shift' : 'shifts'}`}</span>
                        ) : <span className="block text-muted-foreground">Clear</span>}
                      </td>
                      <td className={cn(tdClass, 'hidden whitespace-nowrap text-right align-middle tabular-nums 2xl:table-cell')}>
                        <span className="block">{((barber.serviceCommissionRateBps || 0) / 100).toFixed(0)}%</span>
                        <span className="block text-xs text-muted-foreground">{commissionLabel(barber.projectedCommission, data.commissionAccess)} projected</span>
                      </td>
                      <td className={cn(tdClass, 'whitespace-nowrap align-middle text-right')}>
                        <BarberScheduleDrawer timeZone={data.timeZone} members={data.members} barber={{ id: barber.id, displayName: barber.displayName, chairId: barber.chair?.id, chairLabel, shifts: barber.shifts, exceptions: barber.scheduleExceptions, linkedUserId: barber.linkedUserId ?? null }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data.commissionTruncated ? <p className="text-xs text-muted-foreground">Projected commission covers the most recent visits only.</p> : null}
      </div>
    </PageContainer>
  );
}
