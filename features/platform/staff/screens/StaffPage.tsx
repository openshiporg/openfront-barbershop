import Link from 'next/link';
import { Plus, Scissors } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
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

function header() {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Barbers & schedules</h1>
        <p className="text-muted-foreground">Roster, weekly hours, shifts, time off, chairs, and commission.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm"><Link href={`${basePath}/barbers/create`}><Plus className="size-4" /> New barber</Link></Button>
        <Button asChild size="sm" variant="outline"><Link href={`${basePath}/barber-chairs`}>Chairs</Link></Button>
      </div>
    </div>
  );
}

function MoreLink({ shown, total, href, label }: { shown: number; total: number; href: string; label: string }) {
  if (total <= shown) return null;
  return <p className="text-xs text-muted-foreground">Showing {shown} of {total} {label}. <Link className="text-primary underline" href={href}>View all</Link></p>;
}

export default async function StaffPage() {
  const response = await keystoneClient<{ platformStaff: { success: boolean; error?: string; data?: Data } }>(`query StaffProjection { platformStaff { success error data } }`, {}, { cache: 'no-store' });
  const result = response.data?.platformStaff;

  if (!response.success || !result?.success || !result.data) {
    return (
      <PageContainer title="Barbers & schedules" header={header()} breadcrumbs={breadcrumbs}>
        <div className="px-4 pb-8 md:px-6">
          <Alert variant="destructive"><AlertDescription>{result?.error || response.error || 'The staff roster is temporarily unavailable. Refresh to try again.'}</AlertDescription></Alert>
        </div>
      </PageContainer>
    );
  }

  const data = result.data;
  return (
    <PageContainer title="Barbers & schedules" header={header()} breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-6 px-4 pb-8 md:px-6">
        <Card>
          <CardHeader><CardTitle>Shop-wide closures</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Close the whole shop for holidays, weather, or maintenance. Closures block booking and walk-in seating for that window.</p>
            <WorkforceControls timeZone={data.timeZone} shifts={[]} exceptions={data.shopWideExceptions} />
            <MoreLink shown={data.shopWideExceptions.length} total={data.shopWideExceptionCount} href={`${basePath}/schedule-exceptions`} label="upcoming closures" />
          </CardContent>
        </Card>
        {!data.barbers.length && (
          <div className="rounded-lg border border-dashed">
            <EmptyState title="No barbers yet" description="Add a barber, then set their chair, services, and weekly hours." icons={[Scissors]} className="p-8" />
            <div className="-mt-4 pb-6 text-center"><Button asChild size="sm" variant="outline"><Link href={`${basePath}/barbers/create`}>Add a barber</Link></Button></div>
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-2">{data.barbers.map((barber) => (
          <Card key={barber.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle>{barber.displayName}</CardTitle>
                <Badge variant={barber.bookingEnabled ? 'default' : 'secondary'}>{barber.status}{barber.bookingEnabled ? ' · bookable' : ' · not bookable'}</Badge>
              </div>
              <div className="flex flex-wrap gap-2 pt-1 text-xs">
                <Link className="text-primary underline" href={`${basePath}/barbers/${barber.id}`}>Edit profile, chair & services</Link>
                <Link className="text-primary underline" href={`${basePath}/barber-schedules${filterBy('barber', barber.id)}`}>Weekly hours</Link>
                <Link className="text-primary underline" href={`${basePath}/barber-schedules/create`}>Add weekly hours</Link>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Chair {barber.chair?.chairNumber || barber.chairNumber || 'unassigned'}{barber.chair ? ` · ${barber.chair.status}` : ''} · {barber.accountLinked ? 'sign-in account linked' : 'no sign-in account'}</p>
              {data.members && <BarberAccountLink barberId={barber.id} linkedUserId={barber.linkedUserId ?? null} members={data.members} />}
              <div className="mt-3 flex flex-wrap gap-1">{barber.specialties.map((item) => <Badge key={item.id} variant="outline">{item.name}</Badge>)}{!barber.specialties.length && <span className="text-xs text-muted-foreground">No services assigned.</span>}</div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                {barber.schedules.length ? barber.schedules.map((schedule) => (
                  <span key={schedule.id} className={schedule.isWorking ? '' : 'text-muted-foreground'}>
                    {DAYS[schedule.dayOfWeek] || schedule.dayOfWeek} {schedule.isWorking ? `${clock(schedule.startMinute)}–${clock(schedule.endMinute)}${schedule.breakStartMinute != null ? ` (break ${clock(schedule.breakStartMinute)}–${clock(schedule.breakEndMinute)})` : ''}` : 'off'}
                  </span>
                )) : <span className="col-span-full text-muted-foreground">No weekly hours set.</span>}
              </div>
              <div className="mt-4 flex justify-between border-t pt-3 text-sm"><span>Commission rate</span><strong>{((barber.serviceCommissionRateBps || 0) / 100).toFixed(0)}%</strong></div>
              <div className="flex justify-between text-sm"><span>Projected commission</span><strong>{commissionLabel(barber.projectedCommission, data.commissionAccess)}</strong></div>
              <WorkforceControls timeZone={data.timeZone} barberId={barber.id} chairId={barber.chair?.id} shifts={barber.shifts} exceptions={barber.scheduleExceptions} />
              <MoreLink shown={barber.shifts.length} total={barber.openShiftCount} href={`${basePath}/staff-shifts${filterBy('barber', barber.id)}`} label="open shifts" />
              <MoreLink shown={barber.scheduleExceptions.length} total={barber.upcomingExceptionCount} href={`${basePath}/schedule-exceptions${filterBy('barber', barber.id)}`} label="upcoming exceptions" />
            </CardContent>
          </Card>
        ))}</div>
      </div>
    </PageContainer>
  );
}
