'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { useLiveRefresh } from '@/features/platform/lib/useLiveRefresh';
import { Empty, liveStamp, Notice, PageHeader, Pager, Pill, PillLink, Readouts, Section, selectClass, StatusDot, Track, type Tone } from '@/features/platform/lib/ui';
import { markAppointmentNoShowAction, updateAppointmentStatus, type BookingProjectionData, type ForwardAppointmentStatus } from '../actions/appointments';
import { AppointmentChangeForm } from '../components/AppointmentChangeForm';
import { StaffBookingForm } from '../components/StaffBookingForm';
import { appointmentNoShowFeedback, appointmentStatusFeedback, interruptedAppointmentActionMessage, type AppointmentActionResult } from '../lib/appointmentActionFeedback';
import {
  appointmentStatusLabels,
  type AppointmentBoardCustomer,
  type AppointmentBoardItem,
  type AppointmentStatus,
} from '../lib/appointmentTypes';

const statusOrder: AppointmentStatus[] = ['requested', 'confirmed', 'checked_in', 'in_chair', 'completed', 'cancelled', 'no_show'];
const closedStatuses: AppointmentStatus[] = ['completed', 'cancelled', 'no_show'];
const changeableStatuses: AppointmentStatus[] = ['requested', 'confirmed'];
const flowStatuses: AppointmentStatus[] = ['requested', 'confirmed', 'checked_in', 'in_chair'];

const appointmentTone: Record<AppointmentStatus, Tone> = {
  requested: 'wait',
  confirmed: 'info',
  checked_in: 'live',
  in_chair: 'live',
  completed: 'off',
  cancelled: 'alert',
  no_show: 'alert',
};

function shopDayLabel(date: string) {
  const day = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(day.getTime()) ? date : new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(day);
}

const nextStatus: Partial<Record<AppointmentStatus, { label: string; value: ForwardAppointmentStatus }>> = {
  requested: { label: 'Confirm', value: 'confirmed' },
  confirmed: { label: 'Check in', value: 'checked_in' },
  checked_in: { label: 'Seat', value: 'in_chair' },
};

type Breadcrumb = { type: 'link' | 'page'; label: string; href?: string };

function formatTime(value: string | null | undefined, timeZone: string) {
  if (!value) return 'Time not set';
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

function boardHref(params: { date: string; status?: string | null; page?: number }) {
  const search = new URLSearchParams({ date: params.date });
  if (params.status) search.set('status', params.status);
  if (params.page && params.page > 1) search.set('page', String(params.page));
  return `/dashboard/platform/booking?${search.toString()}`;
}

export function BookingBoardPageClient({ data, breadcrumbs }: { data: BookingProjectionData; breadcrumbs: Breadcrumb[] }) {
  const { appointments, barbers, services, statusCounts, metrics, timeZone, date: selectedDate } = data;
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: 'status' | 'alert'; text: string } | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);
  const live = useLiveRefresh({ paused: pending || showBooking || Boolean(changingId) });
  const specialistsByService = useMemo(() => new Map(services.map((service) => [service.id, service.specialistIds])), [services]);

  const byStatus = useMemo(() => statusOrder.reduce<Partial<Record<AppointmentStatus, AppointmentBoardItem[]>>>((acc, status) => {
    acc[status] = appointments.filter((appointment) => appointment.status === status);
    return acc;
  }, {}), [appointments]);

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
  const firstShown = data.matching ? (data.page - 1) * data.pageSize + 1 : 0;
  const lastShown = Math.min(data.matching, data.page * data.pageSize);
  const lanes = flowStatuses.filter((status) => !data.status || data.status === status);
  const closedShown = closedStatuses.filter((status) => !data.status || data.status === status);
  const closed = closedShown.flatMap((status) => byStatus[status] || []);

  const header = (
    <PageHeader
      title="Booking board"
      tone={live.refreshing ? 'wait' : 'live'}
      meta={<>{shopDayLabel(selectedDate)} · {timeZone} · <span className="font-mono tabular-nums">Live {liveStamp(live.lastRefreshedAt)}</span></>}
      actions={(
        <Track>
          <Pill onClick={live.refresh} disabled={live.refreshing}><RefreshCw />{live.refreshing ? 'Refreshing' : 'Refresh'}</Pill>
          <PillLink href="/dashboard/platform/queue">Walk-ins</PillLink>
          <Pill variant="primary" onClick={() => setShowBooking((value) => !value)} aria-expanded={showBooking}>{showBooking ? 'Close form' : 'New appointment'}</Pill>
        </Track>
      )}
    />
  );

  const renderAppointment = (appointment: AppointmentBoardItem, compact = false) => {
    const action = nextStatus[appointment.status as AppointmentStatus];
    const currentBarber = appointment.barber?.displayName;
    const bookedBarber = appointment.barberNameSnapshot;
    const closedVisit = hasStatus(closedStatuses, appointment.status);
    return (
      <article key={appointment.id} className={compact ? 'border-b py-3 last:border-b-0' : 'rounded-xl border bg-background p-3 shadow-xs'}>
        <div className="flex items-start gap-3">
          <time className="w-[4.25rem] shrink-0 font-mono text-base font-semibold tabular-nums">{formatTime(appointment.startsAt, timeZone)}</time>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold">{compact && appointment.status ? <StatusDot tone={appointmentTone[appointment.status as AppointmentStatus] || 'off'} /> : null}{customerName(appointment.customer)}</h3>
            <p className="truncate text-sm text-muted-foreground">{serviceLabel(appointment)}</p>
          </div>
          <span className="shrink-0 font-mono text-sm tabular-nums">{formatMoney(appointment.price ?? appointment.service?.price)}</span>
        </div>
        <p className="mt-2 pl-[4.75rem] text-xs text-muted-foreground">
          {currentBarber || bookedBarber || 'No barber'}{bookedBarber && currentBarber && bookedBarber !== currentBarber ? ` (booked with ${bookedBarber})` : ''}
          {' · '}{appointment.durationMinutes || appointment.service?.durationMinutes || 30} min · {statusLabel(appointment.paymentStatus)}{appointment.source ? ` · ${statusLabel(appointment.source)}` : ''}
          {compact ? ` · ${appointmentStatusLabels[appointment.status as AppointmentStatus] || statusLabel(appointment.status)}` : ''}
        </p>
        {appointment.bookingEligibility && !compact && <p className="mt-1 pl-[4.75rem] text-xs text-muted-foreground">Policy v{appointment.bookingEligibility.version} · {appointment.bookingEligibility.publicServiceEligibility}</p>}
        {appointment.customerNotes && <p className="mt-2 ml-[4.75rem] rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">{appointment.customerNotes}</p>}
        {!closedVisit && (
          <div className="mt-3 pl-[4.75rem]">
            <Track>
              {action && <Pill size="sm" variant="primary" disabled={pending} onClick={() => moveAppointment(appointment.id, action.value)}>{action.label}</Pill>}
              {appointment.status === 'in_chair' && <PillLink size="sm" variant="primary" href={`/dashboard/platform/pos?appointment=${encodeURIComponent(appointment.id)}`}>Checkout</PillLink>}
              {appointment.status !== 'in_chair' && <Pill size="sm" disabled={pending} onClick={() => markNoShow(appointment.id)}>No-show</Pill>}
              {hasStatus(changeableStatuses, appointment.status) && (
                <Pill size="sm" aria-expanded={changingId === appointment.id} onClick={() => setChangingId(changingId === appointment.id ? null : appointment.id)}>Change</Pill>
              )}
            </Track>
          </div>
        )}
        {changingId === appointment.id && (
          <AppointmentChangeForm
            appointmentId={appointment.id}
            startsAt={appointment.startsAt}
            barberId={appointment.barber?.id}
            barbers={barbers}
            specialistIds={appointment.service?.id ? specialistsByService.get(appointment.service.id) : undefined}
            timeZone={timeZone}
            onClose={() => setChangingId(null)}
          />
        )}
      </article>
    );
  };

  return (
    <PageContainer title="Booking board" header={header} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-6 px-4 pb-8 md:px-6">
        {showBooking && (
          <Section id="new-appointment" title="New appointment">
            <StaffBookingForm services={services} barbers={barbers} timeZone={timeZone} defaultDate={selectedDate} onCancel={() => setShowBooking(false)} />
          </Section>
        )}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <form className="flex items-end gap-2" action="/dashboard/platform/booking">
            {data.status && <input type="hidden" name="status" value={data.status} />}
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">Shop date<input type="date" name="date" defaultValue={selectedDate} className={`${selectClass} font-mono`} /></label>
            <Track><Pill type="submit">Show</Pill></Track>
          </form>
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <Track label="Status filter" className="flex-nowrap">
              <PillLink size="sm" variant={data.status ? 'flat' : 'raised'} href={boardHref({ date: selectedDate })}>All <span className="font-mono tabular-nums">{Object.values(statusCounts).reduce((sum, count) => sum + (count || 0), 0)}</span></PillLink>
              {statusOrder.map((status) => (
                <PillLink key={status} size="sm" variant={data.status === status ? 'raised' : 'flat'} href={boardHref({ date: selectedDate, status })}>
                  {appointmentStatusLabels[status]} <span className="font-mono tabular-nums">{statusCounts[status] ?? 0}</span>
                </PillLink>
              ))}
            </Track>
          </div>
        </div>

        <div aria-live="polite">{message && <Notice tone={message.tone}>{message.text}</Notice>}</div>

        <Readouts items={[
          { label: 'Booked', value: metrics.scheduled },
          { label: 'In shop', value: metrics.inShop, tone: metrics.inShop ? 'live' : undefined },
          { label: 'To serve', value: metrics.activeFlow },
          { label: 'Booked value', value: formatMoney(metrics.bookedValue) },
        ]} />

        <Section id="floor" title="On the floor" count={barbers.length}>
          {barbers.length ? (
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {barbers.map((barber) => (
                <li key={barber.id} className="min-w-0"><StatusDot tone={barber.bookingEnabled ? 'live' : 'off'} />{barber.displayName}{barber.chairNumber ? <span className="ml-1.5 font-mono text-xs text-muted-foreground">CH {barber.chairNumber}</span> : null}{barber.bookingEnabled ? '' : <span className="ml-1.5 text-xs text-muted-foreground">booking off</span>}</li>
              ))}
            </ul>
          ) : <Empty>No active barbers. <Link className="underline" href="/dashboard/platform/staff">Barbers & schedules</Link></Empty>}
        </Section>

        <p className="font-mono text-xs tabular-nums text-muted-foreground" role="status">
          {data.matching ? `${firstShown}–${lastShown} of ${data.matching}` : data.status ? 'No appointments with this status on this day.' : 'No appointments on this day.'}
        </p>

        {lanes.length > 0 && (
          <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {lanes.map((status) => (
              <section key={status} className="min-w-0 rounded-2xl bg-muted/50 p-2 ring-1 ring-inset ring-black/5 dark:ring-white/5" aria-label={appointmentStatusLabels[status]}>
                <h2 className="flex items-center justify-between px-1.5 pb-2 pt-1 text-sm font-semibold">
                  <span><StatusDot tone={appointmentTone[status]} />{appointmentStatusLabels[status]}</span>
                  <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">{statusCounts[status] ?? 0}</span>
                </h2>
                <div className="space-y-2">
                  {(byStatus[status] || []).map((appointment) => renderAppointment(appointment))}
                  {!byStatus[status]?.length && <p className="px-1.5 py-3 text-sm text-muted-foreground">{(statusCounts[status] ?? 0) > 0 ? 'On another page.' : 'None.'}</p>}
                </div>
              </section>
            ))}
          </div>
        )}

        {closedShown.length > 0 && (
          <Section id="closed" title="Closed" count={closedShown.reduce((sum, status) => sum + (statusCounts[status] ?? 0), 0)}>
            {closed.length ? <div>{closed.map((appointment) => renderAppointment(appointment, true))}</div> : <Empty>None.</Empty>}
          </Section>
        )}

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
