'use client';

import { Fragment, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus, RefreshCw, X } from 'lucide-react';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { useLiveRefresh } from '@/features/platform/lib/useLiveRefresh';
import { shopDateKey, shopMinute } from '@/features/shared/shop-time';
import { cn } from '@/lib/utils';
import { liveStamp, Notice, PageHeader, Pager, Pill, PillLink, Section, StatusCell, StatusTabs, Track, type Tone } from '@/features/platform/lib/ui';
import { markAppointmentNoShowAction, updateAppointmentStatus, type BookingProjectionData, type ForwardAppointmentStatus } from '../actions/appointments';
import { AppointmentChangeForm } from '../components/AppointmentChangeForm';
import { ChairStrip, sinceLabel, stack, type ChairCell } from '../components/FloorKit';
import { StaffBookingForm } from '../components/StaffBookingForm';
import { appointmentNoShowFeedback, appointmentStatusFeedback, interruptedAppointmentActionMessage, type AppointmentActionResult } from '../lib/appointmentActionFeedback';
import {
  appointmentStatusLabels,
  type AppointmentBoardBarber,
  type AppointmentBoardCustomer,
  type AppointmentBoardItem,
  type AppointmentStatus,
} from '../lib/appointmentTypes';

const minuteClock = (minute: number) => `${Math.floor(minute / 60) % 12 || 12}:${String(minute % 60).padStart(2, '0')}${Math.floor(minute / 60) >= 12 ? 'p' : 'a'}`;
const hourLabel = (minute: number) => `${Math.floor(minute / 60) % 12 || 12}${Math.floor(minute / 60) >= 12 ? 'p' : 'a'}`;

const statusOrder: AppointmentStatus[] = ['requested', 'confirmed', 'checked_in', 'in_chair', 'completed', 'cancelled', 'no_show'];
const closedStatuses: AppointmentStatus[] = ['completed', 'cancelled', 'no_show'];
const changeableStatuses: AppointmentStatus[] = ['requested', 'confirmed'];
const upcomingStatuses: AppointmentStatus[] = ['requested', 'confirmed', 'checked_in'];

const appointmentTone: Record<AppointmentStatus, Tone> = {
  requested: 'wait',
  confirmed: 'info',
  checked_in: 'live',
  in_chair: 'live',
  completed: 'off',
  cancelled: 'alert',
  no_show: 'alert',
};

// Timeline block fills: tinted, flat, readable in both themes.
const blockClass: Partial<Record<AppointmentStatus, string>> = {
  requested: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100',
  confirmed: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-100',
  checked_in: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100',
  in_chair: 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-600',
  completed: 'border-border bg-muted text-muted-foreground',
};

function shopDayLabel(date: string) {
  const day = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(day.getTime()) ? date : new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(day);
}

function shiftDate(date: string, days: number) {
  const day = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(day.getTime())) return date;
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

function zoneAbbreviation(timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(new Date()).find((part) => part.type === 'timeZoneName')?.value || timeZone;
  } catch { return timeZone; }
}

const nextStatus: Partial<Record<AppointmentStatus, { label: string; value: ForwardAppointmentStatus }>> = {
  requested: { label: 'Confirm', value: 'confirmed' },
  confirmed: { label: 'Check in', value: 'checked_in' },
  checked_in: { label: 'Seat', value: 'in_chair' },
};

type Breadcrumb = { type: 'link' | 'page'; label: string; href?: string };

function formatTime(value: string | null | undefined, timeZone: string) {
  if (!value) return 'No time';
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function formatMoney(cents?: number | null) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function customerName(customer?: AppointmentBoardCustomer | null) {
  if (!customer) return 'Customer unavailable';
  return [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Customer';
}

function statusLabel(status?: string | null) {
  return status?.replace(/_/g, ' ') || 'unknown';
}

function hasStatus(statuses: AppointmentStatus[], status?: AppointmentStatus | null) {
  return Boolean(status && statuses.includes(status));
}

/** Accepted booking snapshot first; the live relation is shown only as the current assignment. */
function serviceLabel(appointment: AppointmentBoardItem) {
  return appointment.serviceTitleSnapshot || (appointment.service?.name ? `${appointment.service.name} (current catalog name)` : 'Service not recorded');
}

function durationOf(appointment: AppointmentBoardItem) {
  return appointment.durationMinutes || appointment.service?.durationMinutes || 30;
}

function boardHref(params: { date: string; status?: string | null; page?: number }) {
  const search = new URLSearchParams({ date: params.date });
  if (params.status) search.set('status', params.status);
  if (params.page && params.page > 1) search.set('page', String(params.page));
  return `/dashboard/platform/booking?${search.toString()}`;
}

export function BookingBoardPageClient({ data, breadcrumbs }: { data: BookingProjectionData; breadcrumbs: Breadcrumb[] }) {
  const { appointments, barbers, services, statusCounts, metrics, timeZone, date: selectedDate } = data;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: 'status' | 'alert'; text: string } | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);
  const live = useLiveRefresh({ paused: pending || showBooking || Boolean(changingId) });
  const specialistsByService = useMemo(() => new Map(services.map((service) => [service.id, service.specialistIds])), [services]);
  const ordered = useMemo(() => [...appointments].sort((a, b) => (a.startsAt || '').localeCompare(b.startsAt || '')), [appointments]);

  const run = (command: () => Promise<AppointmentActionResult>, feedback: (result: AppointmentActionResult) => string) => {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await command();
        setMessage({ tone: result.success ? 'status' : 'alert', text: feedback(result) });
      } catch {
        setMessage({ tone: 'alert', text: interruptedAppointmentActionMessage });
      }
    });
  };
  const moveAppointment = (id: string, status: ForwardAppointmentStatus) => run(() => updateAppointmentStatus(id, status), (result) => appointmentStatusFeedback(result, id, status));
  const markNoShow = (id: string) => run(() => markAppointmentNoShowAction(id), (result) => appointmentNoShowFeedback(result, id));

  const totalPages = Math.max(1, Math.ceil(data.matching / data.pageSize));
  const zone = zoneAbbreviation(timeZone);
  const shopToday = shopDateKey(new Date(live.now), timeZone);
  const isToday = selectedDate === shopToday;
  const allCount = Object.values(statusCounts).reduce((sum, count) => sum + (count || 0), 0);

  // Older projections without schedule data count every active barber as working.
  const floor = barbers.filter((barber) => barber.workingDay !== false);
  const off = barbers.filter((barber) => barber.workingDay === false);

  const header = (
    <PageHeader
      title="Booking board"
      tone={live.refreshing ? 'wait' : 'live'}
      meta={<>{metrics.scheduled} booked · {metrics.inShop} in shop · {formatMoney(metrics.bookedValue)} booked value · <span className="tabular-nums" suppressHydrationWarning>updated {liveStamp(live.lastRefreshedAt, timeZone)}</span></>}
      actions={(
        <Track>
          <Pill className="relative" onClick={live.refresh} disabled={live.refreshing} aria-label="Refresh board"><RefreshCw className={cn(live.refreshing && 'animate-spin')} /><span className="max-sm:sr-only">{live.refreshing ? 'Refreshing' : 'Refresh'}</span></Pill>
          <PillLink href="/dashboard/platform/queue">Walk-ins</PillLink>
          <Pill variant="primary" onClick={() => setShowBooking((value) => !value)} aria-expanded={showBooking} aria-controls="new-appointment">{showBooking ? <><X />Close</> : <><Plus />New appointment</>}</Pill>
        </Track>
      )}
    />
  );

  // The chair strip: who is in each chair now, else what is next.
  const chairs: ChairCell[] = [
    ...floor.map((barber): ChairCell => {
      const mine = ordered.filter((appointment) => appointment.barber?.id === barber.id);
      const seated = mine.find((appointment) => appointment.status === 'in_chair');
      const hours = barber.dayStartMinute != null && barber.dayEndMinute != null ? `${minuteClock(barber.dayStartMinute)}–${minuteClock(barber.dayEndMinute)}` : null;
      const base = { id: barber.id, barber: barber.displayName || 'Barber', chair: barber.chairNumber };
      if (seated) {
        const end = seated.startsAt ? new Date(new Date(seated.startsAt).getTime() + durationOf(seated) * 60_000).toISOString() : null;
        return { ...base, tone: 'live', occupied: true, occupant: customerName(seated.customer), detail: serviceLabel(seated), since: seated.startsAt ? `booked ${formatTime(seated.startsAt, timeZone)}–${formatTime(end, timeZone)}` : null };
      }
      const upcoming = mine.filter((appointment) => hasStatus(upcomingStatuses, appointment.status) && (!isToday || !appointment.startsAt || new Date(appointment.startsAt).getTime() + durationOf(appointment) * 60_000 > live.now));
      const next = upcoming[0];
      if (!isToday) {
        return { ...base, tone: barber.bookingEnabled === false ? 'wait' : 'info', occupant: `${mine.filter((appointment) => !hasStatus(['cancelled', 'no_show'], appointment.status)).length} booked`, detail: hours, since: barber.bookingEnabled === false ? 'online booking off' : null };
      }
      const startsIn = next?.startsAt ? sinceLabel(new Date(live.now).toISOString(), new Date(next.startsAt).getTime()) : null;
      return {
        ...base,
        tone: barber.bookingEnabled === false ? 'wait' : 'off',
        occupant: 'Free',
        detail: next ? `Next ${formatTime(next.startsAt, timeZone)} · ${customerName(next.customer)}` : hours ? `Hours ${hours}` : 'Nothing else booked',
        since: next && startsIn && next.startsAt && new Date(next.startsAt).getTime() > live.now ? `in ${startsIn}` : barber.bookingEnabled === false ? 'online booking off' : null,
      };
    }),
    ...off.map((barber): ChairCell => ({ id: barber.id, barber: barber.displayName || 'Barber', chair: barber.chairNumber, tone: 'off', occupant: 'Off today' })),
  ];

  // Timeline: one lane per barber on the floor (plus anyone holding a booking), blocks placed by shop time.
  const visible = ordered.filter((appointment) => appointment.startsAt && !hasStatus(['cancelled', 'no_show'], appointment.status));
  const laneBarbers: Array<Pick<AppointmentBoardBarber, 'id' | 'displayName' | 'chairNumber'>> = [...floor];
  for (const appointment of visible) {
    const barber = appointment.barber;
    if (barber?.id && !laneBarbers.some((lane) => lane.id === barber.id)) laneBarbers.push({ id: barber.id, displayName: barber.displayName || appointment.barberNameSnapshot, chairNumber: barber.chairNumber });
  }
  const unassigned = visible.filter((appointment) => !appointment.barber?.id);
  const starts = [
    ...floor.map((barber) => barber.dayStartMinute).filter((value): value is number => value != null),
    ...visible.map((appointment) => shopMinute(appointment.startsAt as string, timeZone)),
  ];
  const ends = [
    ...floor.map((barber) => barber.dayEndMinute).filter((value): value is number => value != null),
    ...visible.map((appointment) => shopMinute(appointment.startsAt as string, timeZone) + durationOf(appointment)),
  ];
  const dayStart = Math.floor((starts.length ? Math.min(...starts) : 9 * 60) / 60) * 60;
  const dayEnd = Math.max(dayStart + 60, Math.ceil((ends.length ? Math.max(...ends) : 19 * 60) / 60) * 60);
  const span = dayEnd - dayStart;
  const hours = Array.from({ length: span / 60 + 1 }, (_, index) => dayStart + index * 60);
  const nowMinute = shopMinute(new Date(live.now), timeZone);
  const showNow = isToday && nowMinute >= dayStart && nowMinute <= dayEnd;
  const pct = (minute: number) => `${((minute - dayStart) / span) * 100}%`;

  const lanes = [
    ...laneBarbers.map((barber) => ({ key: barber.id, label: barber.displayName || 'Barber', chair: barber.chairNumber, items: visible.filter((appointment) => appointment.barber?.id === barber.id) })),
    ...(unassigned.length ? [{ key: 'unassigned', label: 'No barber', chair: null, items: unassigned }] : []),
  ];

  const renderRow = (appointment: AppointmentBoardItem) => {
    const status = appointment.status as AppointmentStatus;
    const onShopDay = !appointment.startsAt || shopDateKey(new Date(appointment.startsAt), timeZone) === shopToday;
    const started = Boolean(appointment.startsAt) && new Date(appointment.startsAt as string).getTime() <= live.now;
    // Check-in and seat happen on the visit's own shop day.
    const rawAction = nextStatus[status];
    const action = rawAction && (rawAction.value === 'confirmed' || onShopDay) ? rawAction : undefined;
    const currentBarber = appointment.barber?.displayName;
    const bookedBarber = appointment.barberNameSnapshot;
    const closedVisit = hasStatus(closedStatuses, status);
    const barberText = `${currentBarber || bookedBarber || 'No barber'}${bookedBarber && currentBarber && bookedBarber !== currentBarber ? ` (booked with ${bookedBarber})` : ''}`;
    return (
      <Fragment key={appointment.id}>
        <tr id={`appt-${appointment.id}`} className={cn(stack.row, 'scroll-mt-24 target:bg-muted/60', closedVisit && 'text-muted-foreground', status === 'in_chair' && 'bg-emerald-50/50 dark:bg-emerald-950/20')}>
          <td className={cn(stack.td, 'whitespace-nowrap')}>
            <p className="font-semibold tabular-nums text-foreground">{formatTime(appointment.startsAt, timeZone)}</p>
            <p className="text-xs tabular-nums text-muted-foreground">{durationOf(appointment)} min</p>
          </td>
          <td className={cn(stack.td, 'max-md:order-first max-md:col-span-2')}>
            <p className={cn('font-medium', !closedVisit && 'text-foreground')}>{customerName(appointment.customer)}</p>
            <p className="text-xs text-muted-foreground"><span className="md:hidden">{serviceLabel(appointment)} · {barberText}</span><span className="max-md:hidden">{appointment.customer?.phone || (appointment.source ? statusLabel(appointment.source) : '')}</span></p>
            {appointment.customerNotes && <p className="mt-1 max-w-prose text-xs text-muted-foreground">{appointment.customerNotes}</p>}
          </td>
          <td className={cn(stack.td, stack.wide)}>
            <p>{serviceLabel(appointment)}</p>
            <p className="text-xs text-muted-foreground">{appointment.paymentStatus && appointment.paymentStatus !== 'not_required' ? statusLabel(appointment.paymentStatus) : appointment.source ? statusLabel(appointment.source) : ''}</p>
          </td>
          <td className={cn(stack.td, stack.wide)}>{barberText}</td>
          <td className={cn(stack.td, 'whitespace-nowrap max-md:text-right')}><StatusCell tone={appointmentTone[status] || 'off'}>{appointmentStatusLabels[status] || statusLabel(status)}</StatusCell></td>
          <td className={cn(stack.td, stack.wide, 'whitespace-nowrap text-right tabular-nums')}>{formatMoney(appointment.price ?? appointment.service?.price)}</td>
          <td className={cn(stack.td, stack.full, 'md:text-right')}>
            {!closedVisit && (
              <div className="flex flex-wrap gap-1.5 md:justify-end">
                {action && <Pill size="sm" variant="primary" disabled={pending} onClick={() => moveAppointment(appointment.id, action.value)}>{action.label}</Pill>}
                {status === 'in_chair' && <PillLink size="sm" variant="primary" href={`/dashboard/platform/pos?appointment=${encodeURIComponent(appointment.id)}`}>Checkout</PillLink>}
                {status !== 'in_chair' && started && <Pill size="sm" variant="flat" disabled={pending} onClick={() => markNoShow(appointment.id)}>No-show</Pill>}
                {hasStatus(changeableStatuses, status) && (
                  <Pill size="sm" aria-expanded={changingId === appointment.id} onClick={() => setChangingId(changingId === appointment.id ? null : appointment.id)}>Change</Pill>
                )}
              </div>
            )}
          </td>
        </tr>
        {changingId === appointment.id && (
          <tr className="max-md:block">
            <td colSpan={7} className="border-b bg-muted/30 px-3 pb-3 max-md:block">
              <AppointmentChangeForm
                appointmentId={appointment.id}
                startsAt={appointment.startsAt}
                barberId={appointment.barber?.id}
                barbers={barbers}
                specialistIds={appointment.service?.id ? specialistsByService.get(appointment.service.id) : undefined}
                timeZone={timeZone}
                onClose={() => setChangingId(null)}
              />
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  return (
    <PageContainer title="Booking board" header={header} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-6 px-4 pb-24 md:px-6">
        {showBooking && (
          <Section id="new-appointment" title="New appointment" className="rounded-[6px] border p-4">
            <StaffBookingForm services={services} barbers={barbers} timeZone={timeZone} defaultDate={selectedDate} onCancel={() => setShowBooking(false)} />
          </Section>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <PillLink size="sm" href={boardHref({ date: shiftDate(selectedDate, -1), status: data.status })} className="w-9 px-0"><ChevronLeft aria-hidden="true" /><span className="sr-only">Previous day</span></PillLink>
            <form action="/dashboard/platform/booking" className="contents">
              {data.status && <input type="hidden" name="status" value={data.status} />}
              <label htmlFor="board-date" className="sr-only">Shop date</label>
              <input
                id="board-date"
                type="date"
                name="date"
                defaultValue={selectedDate}
                onChange={(event) => { if (event.currentTarget.value) router.push(boardHref({ date: event.currentTarget.value, status: data.status })); }}
                className="h-8 rounded-[6px] border bg-background px-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </form>
            <PillLink size="sm" href={boardHref({ date: shiftDate(selectedDate, 1), status: data.status })} className="w-9 px-0"><ChevronRight aria-hidden="true" /><span className="sr-only">Next day</span></PillLink>
          </div>
          <h2 className="text-sm font-semibold">{isToday ? 'Today' : shopDayLabel(selectedDate)}<span className="ml-2 font-normal text-muted-foreground">{isToday ? shopDayLabel(selectedDate) : ''} · times in {zone}</span></h2>
          {!isToday && <PillLink size="sm" variant="flat" href={boardHref({ date: shopToday, status: data.status })}>Today</PillLink>}
        </div>

        {!data.status && (
          <ChairStrip
            label="Chairs"
            cells={chairs}
            empty={<>No active barbers. <Link className="underline underline-offset-4" href="/dashboard/platform/staff">Barbers & schedules</Link></>}
          />
        )}

        <div aria-live="polite">{message && <Notice tone={message.tone}>{message.text}</Notice>}</div>

        {!data.status && lanes.length > 0 && (
          <section aria-label="Schedule by barber" className="hidden md:block">
            <div className="relative overflow-x-auto rounded-[6px] border bg-background">
              <div className="relative min-w-[720px]">
                <div className="flex h-8 border-b bg-muted/40 text-xs text-muted-foreground">
                  <div className="w-36 shrink-0 border-r px-3 leading-8">Barber</div>
                  <div className="relative flex-1">
                    {hours.slice(0, -1).map((minute) => <span key={minute} className="absolute top-0 pl-1.5 leading-8 tabular-nums" style={{ left: pct(minute) }}>{hourLabel(minute)}</span>)}
                  </div>
                </div>
                {lanes.map((lane) => (
                  <div key={lane.key} className="flex h-12 border-b last:border-b-0">
                    <div className="flex w-36 shrink-0 flex-col justify-center border-r px-3">
                      <span className="truncate text-sm font-medium">{lane.label}</span>
                      {lane.chair ? <span className="text-[11px] tabular-nums text-muted-foreground">Chair {lane.chair}</span> : null}
                    </div>
                    <div className="relative flex-1">
                      {hours.slice(1, -1).map((minute) => <span key={minute} aria-hidden="true" className="absolute inset-y-0 w-px bg-border/70" style={{ left: pct(minute) }} />)}
                      {lane.items.map((appointment) => {
                        const start = shopMinute(appointment.startsAt as string, timeZone);
                        const status = appointment.status as AppointmentStatus;
                        return (
                          <a
                            key={appointment.id}
                            href={`#appt-${appointment.id}`}
                            title={`${formatTime(appointment.startsAt, timeZone)} · ${customerName(appointment.customer)} · ${serviceLabel(appointment)} · ${appointmentStatusLabels[status] || statusLabel(status)}`}
                            className={cn('absolute inset-y-1.5 flex min-w-0 items-center overflow-hidden rounded-[4px] border px-1.5 text-[11px] leading-tight transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', blockClass[status] || 'border-border bg-muted')}
                            style={{ left: pct(start), width: `max(1.5rem, calc(${(durationOf(appointment) / span) * 100}% - 2px))` }}
                          >
                            <span className="truncate"><span className="font-semibold tabular-nums">{formatTime(appointment.startsAt, timeZone).replace(/\s?[AP]M$/, '')}</span> {customerName(appointment.customer)}</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {showNow && (
                  <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-36 right-0">
                    <span className="absolute inset-y-0 w-px bg-red-500" style={{ left: pct(nowMinute) }} suppressHydrationWarning />
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        <section aria-labelledby="board-list" className="min-w-0 space-y-3">
          <h2 id="board-list" className="sr-only">Appointments</h2>
          <StatusTabs
            label="Appointment status"
            current={data.status || ''}
            hrefFor={(value) => boardHref({ date: selectedDate, status: value || null })}
            tabs={[{ value: '', label: 'All', count: allCount }, ...statusOrder.map((status) => ({ value: status, label: appointmentStatusLabels[status], count: statusCounts[status] ?? 0 }))]}
          />
          <div className={stack.wrap}>
            <table className={stack.table} aria-label="Appointments by time">
              <thead className={stack.head}>
                <tr>
                  <th scope="col" className={cn(stack.th, 'w-24')}>Time</th>
                  <th scope="col" className={stack.th}>Customer</th>
                  <th scope="col" className={stack.th}>Service</th>
                  <th scope="col" className={stack.th}>Barber</th>
                  <th scope="col" className={stack.th}>Status</th>
                  <th scope="col" className={cn(stack.th, 'text-right')}>Price</th>
                  <th scope="col" className={cn(stack.th, 'text-right')}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className={stack.body}>
                {ordered.map(renderRow)}
                {!ordered.length && (
                  <tr className="max-md:block">
                    <td colSpan={7} className="px-3 py-6 text-sm text-muted-foreground max-md:block">
                      <span className="mr-3">{data.matching > 0 ? 'On another page.' : data.status ? `No ${appointmentStatusLabels[data.status].toLowerCase()} appointments this day.` : 'No appointments this day.'}</span>
                      {!data.status && !showBooking && <Pill size="sm" onClick={() => setShowBooking(true)}><Plus />New appointment</Pill>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <Pager
          label="Appointment pages"
          page={data.page}
          pages={totalPages}
          prev={data.page > 1 ? boardHref({ date: selectedDate, status: data.status, page: data.page - 1 }) : null}
          next={data.page < totalPages ? boardHref({ date: selectedDate, status: data.status, page: data.page + 1 }) : null}
        />
      </div>
    </PageContainer>
  );
}
