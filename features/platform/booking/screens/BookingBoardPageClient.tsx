'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Clock, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { useLiveRefresh } from '@/features/platform/lib/useLiveRefresh';
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

  const header = (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Booking board</h1>
        <p className="text-muted-foreground">Daily appointments and status flow · times in {timeZone}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={live.refresh} disabled={live.refreshing}><RefreshCw className="size-4" />{live.refreshing ? 'Refreshing…' : 'Refresh'}</Button>
        <Button variant="outline" asChild><Link href="/dashboard/platform/queue">Walk-in queue</Link></Button>
        <Button onClick={() => setShowBooking((value) => !value)} aria-expanded={showBooking}>{showBooking ? 'Close booking form' : 'New appointment'}</Button>
      </div>
    </div>
  );

  return (
    <PageContainer title="Booking board" header={header} breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-6 px-4 pb-8 md:px-6">
        <p className="text-xs text-muted-foreground">Last updated {live.lastRefreshedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}. Updates every minute while no form is open.</p>

        {showBooking && (
          <section className="rounded-xl border bg-card p-4 shadow-sm" aria-label="New appointment">
            <h2 className="mb-3 font-semibold">New appointment</h2>
            <StaffBookingForm services={services} barbers={barbers} timeZone={timeZone} defaultDate={selectedDate} onCancel={() => setShowBooking(false)} />
          </section>
        )}

        <form className="flex flex-wrap items-end gap-3" action="/dashboard/platform/booking">
          <label className="grid gap-1 text-sm">Shop date<input type="date" name="date" defaultValue={selectedDate} className="h-9 rounded-md border bg-background px-2" /></label>
          <label className="grid gap-1 text-sm">Status
            <select name="status" defaultValue={data.status || ''} className="h-9 rounded-md border bg-background px-2">
              <option value="">All statuses</option>
              {statusOrder.map((status) => <option key={status} value={status}>{appointmentStatusLabels[status]}</option>)}
            </select>
          </label>
          <Button type="submit" variant="outline">Show</Button>
        </form>

        <div aria-live="polite">{message && <p role={message.tone} className={`rounded-md border p-3 text-sm ${message.tone === 'alert' ? 'border-destructive/40 text-destructive' : ''}`}>{message.text}</p>}</div>

        <dl className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">Appointments this day</dt><dd className="text-xl font-semibold">{metrics.scheduled}</dd></div>
          <div className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">In shop</dt><dd className="text-xl font-semibold">{metrics.inShop}</dd></div>
          <div className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">Still to serve</dt><dd className="text-xl font-semibold">{metrics.activeFlow}</dd></div>
          <div className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">Booked value (excl. cancelled/no-show)</dt><dd className="text-xl font-semibold">{formatMoney(metrics.bookedValue)}</dd></div>
        </dl>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="font-semibold">Active barbers</h2>
            <p className="text-sm text-muted-foreground">Active profiles and whether online booking is enabled. This is not a free-slot check; availability is verified when booking.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {barbers.length ? barbers.map((barber) => (
              <Badge key={barber.id} variant={barber.bookingEnabled ? 'default' : 'secondary'}>
                {barber.displayName}{barber.chairNumber ? ` · Chair ${barber.chairNumber}` : ''}{barber.bookingEnabled ? '' : ' · booking off'}
              </Badge>
            )) : <span className="text-sm text-muted-foreground">No active barbers. <Link className="underline" href="/dashboard/platform/staff">Manage barbers</Link></span>}
          </div>
        </div>

        <p className="text-sm text-muted-foreground" role="status">
          {data.matching ? `Showing ${firstShown}–${lastShown} of ${data.matching} ${data.status ? appointmentStatusLabels[data.status].toLowerCase() + ' ' : ''}appointments.` : data.status ? 'No appointments with this status on this day.' : 'No appointments on this day.'}
        </p>

        <div className="grid gap-4 xl:grid-cols-4">
          {statusOrder.filter((status) => !data.status || data.status === status).map((status) => (
            <section key={status} className="min-w-0 rounded-xl border bg-muted/20 p-3" aria-label={appointmentStatusLabels[status]}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{appointmentStatusLabels[status]}</h2>
                <Badge variant="outline">{statusCounts[status] ?? 0}</Badge>
              </div>
              <div className="space-y-3">
                {(byStatus[status] || []).map((appointment) => {
                  const action = nextStatus[appointment.status as AppointmentStatus];
                  const currentBarber = appointment.barber?.displayName;
                  const bookedBarber = appointment.barberNameSnapshot;
                  return (
                    <Card key={appointment.id} className="bg-background">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold">{customerName(appointment.customer)}</div>
                            <div className="text-sm text-muted-foreground">{serviceLabel(appointment)}</div>
                          </div>
                          <Badge variant="secondary">{formatTime(appointment.startsAt, timeZone)}</Badge>
                        </div>
                        <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
                          <span>{currentBarber || bookedBarber || 'Barber not assigned'}{bookedBarber && currentBarber && bookedBarber !== currentBarber ? ` (booked with ${bookedBarber})` : ''}</span>
                          <span>{appointment.durationMinutes || appointment.service?.durationMinutes || 30} min · {formatMoney(appointment.price ?? appointment.service?.price)}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden /> Payment: {statusLabel(appointment.paymentStatus)}</span>
                          {appointment.source && <span>Source: {statusLabel(appointment.source)}</span>}
                        </div>
                        {appointment.bookingEligibility && <p className="mt-3 text-xs text-muted-foreground">Accepted policy {appointment.bookingEligibility.version} · {appointment.bookingEligibility.publicServiceEligibility}</p>}
                        {appointment.customerNotes && <p className="mt-3 rounded-md bg-muted p-2 text-xs text-muted-foreground">{appointment.customerNotes}</p>}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {action && <Button size="sm" disabled={pending} onClick={() => moveAppointment(appointment.id, action.value)}>{action.label}</Button>}
                          {appointment.status === 'in_chair' && <Button size="sm" asChild><Link href={`/dashboard/platform/pos?appointment=${encodeURIComponent(appointment.id)}`}>Checkout</Link></Button>}
                          {!hasStatus(closedStatuses, appointment.status) && appointment.status !== 'in_chair' && (
                            <Button size="sm" variant="outline" disabled={pending} onClick={() => markNoShow(appointment.id)}>No-show</Button>
                          )}
                          {hasStatus(changeableStatuses, appointment.status) && (
                            <Button size="sm" variant="ghost" aria-expanded={changingId === appointment.id} onClick={() => setChangingId(changingId === appointment.id ? null : appointment.id)}>Change</Button>
                          )}
                        </div>
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
                      </CardContent>
                    </Card>
                  );
                })}
                {!byStatus[status]?.length && (
                  <div className="rounded-lg border border-dashed bg-background/50 p-4 text-sm text-muted-foreground">
                    {(statusCounts[status] ?? 0) > 0 ? 'On another page.' : 'No appointments.'}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>

        {totalPages > 1 && (
          <nav className="flex items-center justify-between gap-3" aria-label="Appointment pages">
            {data.page > 1 ? <Button variant="outline" asChild><Link href={boardHref({ date: selectedDate, status: data.status, page: data.page - 1 })}>Previous</Link></Button> : <span />}
            <span className="text-sm text-muted-foreground">Page {data.page} of {totalPages}</span>
            {data.page < totalPages ? <Button variant="outline" asChild><Link href={boardHref({ date: selectedDate, status: data.status, page: data.page + 1 })}>Next</Link></Button> : <span />}
          </nav>
        )}
      </div>
    </PageContainer>
  );
}
