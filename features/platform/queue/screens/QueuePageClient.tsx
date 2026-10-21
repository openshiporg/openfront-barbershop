'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { RefreshCw, UserRoundPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { useLiveRefresh } from '@/features/platform/lib/useLiveRefresh';
import { createAppointmentFromQueue, updateQueueEntryStatus, type QueueEntry, type QueueProjectionData } from '../actions/queue';
import { AddWalkInForm, AssignQueueEntryForm } from '../components/QueueForms';
import { interruptedQueueSeatMessage, interruptedQueueStatusMessage, queueSeatFeedback, queueStatusFeedback, type QueueActionResult } from '../lib/queueActionFeedback';
import { queueStatusLabels, type QueueStatus } from '../lib/queueTypes';

type Breadcrumb = { type: 'link' | 'page'; label: string; href?: string };

function waitAge(checkedInAt: string | null | undefined, now: number) {
  if (!checkedInAt) return 'Check-in time not recorded';
  const minutes = Math.max(0, Math.floor((now - new Date(checkedInAt).getTime()) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes === 1) return '1 min';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

const actionByStatus: Partial<Record<QueueStatus, { label: string; status: QueueStatus }>> = {
  waiting: { label: 'Mark manually contacted', status: 'texted' },
};

function queueHref(search: string, page: number) {
  const params = new URLSearchParams();
  if (search) params.set('q', search);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return `/dashboard/platform/queue${query ? `?${query}` : ''}`;
}

export function QueuePageClient({ data, breadcrumbs }: { data: QueueProjectionData; breadcrumbs: Breadcrumb[] }) {
  const { active: activeEntries, served: servedEntries, counts, services, barbers } = data;
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: 'status' | 'alert'; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const live = useLiveRefresh({ paused: pending || adding || Boolean(assigningId) });

  const byStatus = useMemo(() => (['waiting', 'texted', 'in_chair'] as QueueStatus[]).reduce<Partial<Record<QueueStatus, QueueEntry[]>>>((acc, status) => {
    acc[status] = activeEntries.filter((entry) => entry.status === status);
    return acc;
  }, {}), [activeEntries]);

  const run = (command: () => Promise<QueueActionResult>, feedback: (result: QueueActionResult) => string, interruptedMessage: string) => {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await command();
        setMessage({ tone: result.success ? 'status' : 'alert', text: feedback(result) });
      } catch {
        setMessage({ tone: 'alert', text: interruptedMessage });
      }
    });
  };
  const updateStatus = (id: string, status: QueueStatus) => run(() => updateQueueEntryStatus(id, status), (result) => queueStatusFeedback(result, id, status), interruptedQueueStatusMessage);
  const convertToAppointment = (entry: QueueEntry) => run(() => createAppointmentFromQueue(entry), (result) => queueSeatFeedback(result, entry.id), interruptedQueueSeatMessage);

  const totalPages = Math.max(1, Math.ceil(data.activeMatching / data.pageSize));
  const firstShown = data.activeMatching ? (data.page - 1) * data.pageSize + 1 : 0;
  const lastShown = Math.min(data.activeMatching, data.page * data.pageSize);

  const header = (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Walk-in queue</h1>
        <p className="text-muted-foreground">Walk-ins, quoted waits, and seating</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={live.refresh} disabled={live.refreshing}><RefreshCw className="size-4" />{live.refreshing ? 'Refreshing…' : 'Refresh'}</Button>
        <Button variant="outline" asChild><Link href="/dashboard/platform/booking">Booking board</Link></Button>
        <Button onClick={() => setAdding((value) => !value)} aria-expanded={adding}>{adding ? 'Close' : 'Add walk-in'}</Button>
      </div>
    </div>
  );

  return (
    <PageContainer title="Walk-in queue" header={header} breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-6 px-4 pb-8 md:px-6">
        <p className="text-xs text-muted-foreground">Last updated {live.lastRefreshedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}. Updates every minute while no form is open.</p>

        {adding && (
          <section className="rounded-xl border bg-card p-4 shadow-sm" aria-label="Add walk-in">
            <h2 className="mb-3 font-semibold">Add walk-in</h2>
            <AddWalkInForm services={services} barbers={barbers} onClose={() => setAdding(false)} />
          </section>
        )}

        <form action="/dashboard/platform/queue" className="flex flex-wrap items-end gap-2">
          <label className="grid min-w-0 flex-1 gap-1 text-sm">Search active guests<input name="q" defaultValue={data.search} placeholder="Name or phone" className="h-9 w-full rounded-md border bg-background px-3" /></label>
          <Button type="submit" variant="outline">Search</Button>
          {data.search && <Button variant="ghost" asChild><Link href="/dashboard/platform/queue">Clear</Link></Button>}
        </form>

        <div aria-live="polite">{message && <p role={message.tone} className={`rounded-md border p-3 text-sm ${message.tone === 'alert' ? 'border-destructive/40 text-destructive' : ''}`}>{message.text}</p>}</div>
        <p role="status" className="text-sm text-muted-foreground">
          {data.activeMatching ? `Showing ${firstShown}–${lastShown} of ${data.activeMatching} active ${data.search ? 'matching ' : ''}guests (${data.activeTotal} active in total).` : data.search ? 'No active guests match this search.' : 'No active guests.'}
        </p>

        <div className="grid gap-4 lg:grid-cols-3">
          {(['waiting', 'texted', 'in_chair'] as QueueStatus[]).map((status) => (
            <section key={status} className="min-w-0 rounded-xl border bg-muted/20 p-3" aria-label={queueStatusLabels[status]}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{queueStatusLabels[status]}</h2>
                <Badge variant="outline">{counts[status] || 0}</Badge>
              </div>
              <div className="space-y-3">
                {(byStatus[status] || []).map((entry) => {
                  const action = actionByStatus[entry.status as QueueStatus];
                  const canSeat = entry.status !== 'in_chair' && Boolean(entry.requestedService?.id);
                  return (
                    <Card key={entry.id} className="bg-background">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold">{entry.customerName}</div>
                            <div className="text-sm text-muted-foreground">{entry.phone || 'No phone'} · party {entry.partySize || 1}</div>
                          </div>
                          <Badge variant="secondary">{waitAge(entry.checkedInAt, live.now)}</Badge>
                        </div>
                        <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
                          <span>{entry.appointment?.serviceTitleSnapshot || entry.requestedService?.name || 'No service chosen yet'}</span>
                          <span>{entry.appointment?.barberNameSnapshot || entry.requestedBarber?.displayName || 'Any barber'}</span>
                          <span>{entry.quotedWaitMinutes == null ? 'No wait estimate' : `Quoted ${entry.quotedWaitMinutes} min`}</span>
                        </div>
                        {entry.notes && <p className="mt-3 rounded-md bg-muted p-2 text-xs text-muted-foreground">{entry.notes}</p>}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {action && <Button size="sm" disabled={pending} onClick={() => updateStatus(entry.id, action.status)}>{action.label}</Button>}
                          {entry.status !== 'in_chair' && (
                            <Button size="sm" variant="outline" aria-expanded={assigningId === entry.id} onClick={() => setAssigningId(assigningId === entry.id ? null : entry.id)}>
                              {entry.requestedService?.id ? 'Change service/barber' : 'Choose service'}
                            </Button>
                          )}
                          {entry.status !== 'in_chair' && <Button size="sm" variant="outline" disabled={pending || !canSeat} onClick={() => convertToAppointment(entry)}>Seat + create appointment</Button>}
                          {entry.status === 'in_chair'
                            ? (entry.appointment?.id
                              ? <Button size="sm" asChild><Link href={`/dashboard/platform/pos?appointment=${encodeURIComponent(entry.appointment.id)}`}>Checkout seated visit</Link></Button>
                              : <span className="text-xs text-muted-foreground">No linked appointment to check out.</span>)
                            : <Button size="sm" variant="ghost" disabled={pending} onClick={() => updateStatus(entry.id, 'left')}>Left</Button>}
                        </div>
                        {!entry.requestedService?.id && entry.status !== 'in_chair' && <p className="mt-2 text-xs text-muted-foreground">Choose a service before seating.</p>}
                        {assigningId === entry.id && (
                          <AssignQueueEntryForm
                            queueEntryId={entry.id}
                            currentServiceId={entry.requestedService?.id}
                            currentBarberId={entry.requestedBarber?.id}
                            services={services}
                            barbers={barbers}
                            onClose={() => setAssigningId(null)}
                          />
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                {!byStatus[status]?.length && <div className="rounded-lg border border-dashed bg-background/50 p-4 text-sm text-muted-foreground">{(counts[status] || 0) > 0 ? 'Not on this page.' : 'No guests.'}</div>}
              </div>
            </section>
          ))}
        </div>

        {totalPages > 1 && (
          <nav className="flex items-center justify-between gap-3" aria-label="Queue pages">
            {data.page > 1 ? <Button variant="outline" asChild><Link href={queueHref(data.search, data.page - 1)}>Previous</Link></Button> : <span />}
            <span className="text-sm text-muted-foreground">Page {data.page} of {totalPages}</span>
            {data.page < totalPages ? <Button variant="outline" asChild><Link href={queueHref(data.search, data.page + 1)}>Next</Link></Button> : <span />}
          </nav>
        )}

        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2"><UserRoundPlus className="h-4 w-4" aria-hidden /><h2 className="font-semibold">Recently served (latest 20)</h2></div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {servedEntries.map((entry) => <div key={entry.id} className="rounded-lg border p-3 text-sm"><span className="font-medium">{entry.customerName}</span><div className="text-muted-foreground">{entry.appointment?.serviceTitleSnapshot || entry.requestedService?.name || 'Walk-in'}</div></div>)}
            {!servedEntries.length && <p className="text-sm text-muted-foreground">No recently served walk-ins.</p>}
          </div>
          <Link className="mt-3 inline-block text-sm underline" href="/dashboard/walk-in-queue-entries">All queue history</Link>
        </section>
      </div>
    </PageContainer>
  );
}
