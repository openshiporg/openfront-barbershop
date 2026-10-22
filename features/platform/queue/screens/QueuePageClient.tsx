'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { useLiveRefresh } from '@/features/platform/lib/useLiveRefresh';
import { Empty, liveStamp, Notice, PageHeader, Pager, Pill, PillLink, Readouts, Section, selectClass, StatusDot, Track, type Tone } from '@/features/platform/lib/ui';
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
  waiting: { label: 'Contacted', status: 'texted' },
};

const queueTone: Partial<Record<QueueStatus, Tone>> = { waiting: 'wait', texted: 'info', in_chair: 'live' };

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

  const waiting = byStatus.waiting || [];
  const longest = waiting.reduce<string | null>((oldest, entry) => (!entry.checkedInAt ? oldest : !oldest || entry.checkedInAt < oldest ? entry.checkedInAt : oldest), null);

  const header = (
    <PageHeader
      title="Walk-in queue"
      tone={live.refreshing ? 'wait' : 'live'}
      meta={<>{counts.waiting || 0} waiting{longest ? <> · longest <span className="font-mono tabular-nums">{waitAge(longest, live.now)}</span></> : null} · <span className="font-mono tabular-nums">Live {liveStamp(live.lastRefreshedAt)}</span></>}
      actions={(
        <Track>
          <Pill onClick={live.refresh} disabled={live.refreshing}><RefreshCw />{live.refreshing ? 'Refreshing' : 'Refresh'}</Pill>
          <PillLink href="/dashboard/platform/booking">Booking board</PillLink>
          <Pill variant="primary" onClick={() => setAdding((value) => !value)} aria-expanded={adding}>{adding ? 'Close' : 'Add walk-in'}</Pill>
        </Track>
      )}
    />
  );

  return (
    <PageContainer title="Walk-in queue" header={header} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-6 px-4 pb-8 md:px-6">
        {adding && (
          <Section id="add-walk-in" title="Add walk-in">
            <AddWalkInForm services={services} barbers={barbers} onClose={() => setAdding(false)} />
          </Section>
        )}

        <Readouts items={[
          { label: 'Waiting', value: counts.waiting || 0, tone: counts.waiting ? 'wait' : undefined },
          { label: 'Contacted', value: counts.texted || 0 },
          { label: 'In chair', value: counts.in_chair || 0, tone: counts.in_chair ? 'live' : undefined },
          { label: 'Active', value: data.activeTotal },
        ]} />

        <form action="/dashboard/platform/queue" className="flex items-end gap-2" role="search">
          <label className="grid min-w-0 flex-1 gap-1 text-xs font-medium text-muted-foreground">Search active guests<input name="q" defaultValue={data.search} placeholder="Name or phone" className={selectClass} /></label>
          <Track>
            <Pill type="submit">Search</Pill>
            {data.search && <PillLink href="/dashboard/platform/queue">Clear</PillLink>}
          </Track>
        </form>

        <div aria-live="polite">{message && <Notice tone={message.tone}>{message.text}</Notice>}</div>
        <p role="status" className="font-mono text-xs tabular-nums text-muted-foreground">
          {data.activeMatching ? `${firstShown}–${lastShown} of ${data.activeMatching}${data.search ? ' matching' : ''}` : data.search ? 'No active guests match this search.' : 'No active guests.'}
        </p>

        <div className="grid min-w-0 gap-4 lg:grid-cols-3">
          {(['waiting', 'texted', 'in_chair'] as QueueStatus[]).map((status) => (
            <section key={status} className="min-w-0 rounded-2xl bg-muted/50 p-2 ring-1 ring-inset ring-black/5 dark:ring-white/5" aria-label={queueStatusLabels[status]}>
              <h2 className="flex items-center justify-between px-1.5 pb-2 pt-1 text-sm font-semibold">
                <span><StatusDot tone={queueTone[status] || 'off'} />{queueStatusLabels[status]}</span>
                <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">{counts[status] || 0}</span>
              </h2>
              <div className="space-y-2">
                {(byStatus[status] || []).map((entry) => {
                  const action = actionByStatus[entry.status as QueueStatus];
                  const canSeat = entry.status !== 'in_chair' && Boolean(entry.requestedService?.id);
                  return (
                    <article key={entry.id} className="rounded-xl border bg-background p-3 shadow-xs">
                      <div className="flex items-start gap-3">
                        <span className="w-[4.25rem] shrink-0 font-mono text-base font-semibold tabular-nums">{waitAge(entry.checkedInAt, live.now)}</span>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-semibold">{entry.customerName}</h3>
                          <p className="truncate text-sm text-muted-foreground">{entry.appointment?.serviceTitleSnapshot || entry.requestedService?.name || 'No service yet'}</p>
                        </div>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">×{entry.partySize || 1}</span>
                      </div>
                      <p className="mt-2 pl-[4.75rem] text-xs text-muted-foreground">
                        {entry.appointment?.barberNameSnapshot || entry.requestedBarber?.displayName || 'Any barber'} · {entry.quotedWaitMinutes == null ? 'no quote' : `quoted ${entry.quotedWaitMinutes} min`} · {entry.phone || 'no phone'}
                      </p>
                      {entry.notes && <p className="mt-2 ml-[4.75rem] rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">{entry.notes}</p>}
                      <div className="mt-3 pl-[4.75rem]">
                        <Track>
                          {entry.status !== 'in_chair' && <Pill size="sm" variant="primary" disabled={pending || !canSeat} onClick={() => convertToAppointment(entry)}>Seat</Pill>}
                          {entry.status === 'in_chair' && entry.appointment?.id && <PillLink size="sm" variant="primary" href={`/dashboard/platform/pos?appointment=${encodeURIComponent(entry.appointment.id)}`}>Checkout</PillLink>}
                          {action && <Pill size="sm" disabled={pending} onClick={() => updateStatus(entry.id, action.status)}>{action.label}</Pill>}
                          {entry.status !== 'in_chair' && (
                            <Pill size="sm" aria-expanded={assigningId === entry.id} onClick={() => setAssigningId(assigningId === entry.id ? null : entry.id)}>
                              {entry.requestedService?.id ? 'Change' : 'Choose service'}
                            </Pill>
                          )}
                          {entry.status !== 'in_chair' && <Pill size="sm" disabled={pending} onClick={() => updateStatus(entry.id, 'left')}>Left</Pill>}
                        </Track>
                        {entry.status === 'in_chair' && !entry.appointment?.id && <p className="mt-2 text-xs text-muted-foreground">No linked appointment.</p>}
                        {!entry.requestedService?.id && entry.status !== 'in_chair' && <p className="mt-2 text-xs text-muted-foreground">Service required to seat.</p>}
                      </div>
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
                    </article>
                  );
                })}
                {!byStatus[status]?.length && <p className="px-1.5 py-3 text-sm text-muted-foreground">{(counts[status] || 0) > 0 ? 'Not on this page.' : 'None.'}</p>}
              </div>
            </section>
          ))}
        </div>

        <Pager label="Queue pages" page={data.page} pages={totalPages} prev={data.page > 1 ? queueHref(data.search, data.page - 1) : null} next={data.page < totalPages ? queueHref(data.search, data.page + 1) : null} />

        <Section id="served" title="Recently served" count={servedEntries.length} actions={<Link className="text-xs font-medium underline-offset-4 hover:underline" href="/dashboard/walk-in-queue-entries">All history</Link>}>
          {servedEntries.length ? (
            <ul className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-4">
              {servedEntries.map((entry) => <li key={entry.id} className="flex min-w-0 items-baseline justify-between gap-2 border-b py-2 text-sm"><span className="truncate font-medium">{entry.customerName}</span><span className="truncate text-xs text-muted-foreground">{entry.appointment?.serviceTitleSnapshot || entry.requestedService?.name || 'Walk-in'}</span></li>)}
            </ul>
          ) : <Empty>No recently served walk-ins.</Empty>}
        </Section>
      </div>
    </PageContainer>
  );
}
