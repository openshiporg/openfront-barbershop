'use client';

import { Fragment, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Plus, RefreshCw, Search, X } from 'lucide-react';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { useLiveRefresh } from '@/features/platform/lib/useLiveRefresh';
import { cn } from '@/lib/utils';
import { liveStamp, Notice, PageHeader, Pager, Pill, PillLink, Section, StatusCell, Track, type Tone } from '@/features/platform/lib/ui';
import { ChairStrip, sinceLabel, stack, type ChairCell } from '@/features/platform/booking/components/FloorKit';
import { createAppointmentFromQueue, updateQueueEntryStatus, type QueueEntry, type QueueProjectionData } from '../actions/queue';
import { AddWalkInForm, AssignQueueEntryForm } from '../components/QueueForms';
import { interruptedQueueSeatMessage, interruptedQueueStatusMessage, queueSeatFeedback, queueStatusFeedback, type QueueActionResult } from '../lib/queueActionFeedback';
import { queueStatusLabels, type QueueStatus } from '../lib/queueTypes';

type Breadcrumb = { type: 'link' | 'page'; label: string; href?: string };

function waitAge(checkedInAt: string | null | undefined, now: number) {
  if (!checkedInAt) return 'Not recorded';
  const minutes = Math.max(0, Math.floor((now - new Date(checkedInAt).getTime()) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function clock(value: string | null | undefined, timeZone?: string | null) {
  if (!value) return null;
  try { return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', ...(timeZone ? { timeZone } : {}) }).format(new Date(value)); }
  catch { return null; }
}

const queueTone: Partial<Record<QueueStatus, Tone>> = { waiting: 'wait', texted: 'info', in_chair: 'live' };
const shortStatus: Partial<Record<QueueStatus, string>> = { texted: 'Contacted' };

function queueHref(search: string, page: number) {
  const params = new URLSearchParams();
  if (search) params.set('q', search);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return `/dashboard/platform/queue${query ? `?${query}` : ''}`;
}

function serviceOf(entry: QueueEntry) {
  return entry.appointment?.serviceTitleSnapshot || entry.requestedService?.name || null;
}

function barberOf(entry: QueueEntry) {
  return entry.appointment?.barberNameSnapshot || entry.requestedBarber?.displayName || null;
}

export function QueuePageClient({ data, breadcrumbs }: { data: QueueProjectionData; breadcrumbs: Breadcrumb[] }) {
  const { active: activeEntries, served: servedEntries, counts, services, barbers } = data;
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: 'status' | 'alert'; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const live = useLiveRefresh({ paused: pending || adding || Boolean(assigningId) });

  // Waiting order: earliest check-in first. In-chair guests follow the line.
  const line = useMemo(() => activeEntries
    .filter((entry) => entry.status === 'waiting' || entry.status === 'texted')
    .sort((a, b) => (a.checkedInAt || '').localeCompare(b.checkedInAt || '')), [activeEntries]);
  const seated = useMemo(() => activeEntries.filter((entry) => entry.status === 'in_chair'), [activeEntries]);

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
  // Positions are only true on the unfiltered first page.
  const ranked = !data.search && data.page === 1;

  const waitingCount = (counts.waiting || 0) + (counts.texted || 0);
  const longest = line.reduce<string | null>((oldest, entry) => (!entry.checkedInAt ? oldest : !oldest || entry.checkedInAt < oldest ? entry.checkedInAt : oldest), null);

  // One cell per barber; a chair shows the walk-in seated with that barber.
  const chairs: ChairCell[] = barbers.map((barber) => {
    const guest = seated.find((entry) => entry.requestedBarber?.id === barber.id || (!entry.requestedBarber?.id && entry.appointment?.barberNameSnapshot && entry.appointment.barberNameSnapshot === barber.displayName));
    if (guest) {
      const since = guest.seatedAt || guest.checkedInAt;
      return {
        id: barber.id, barber: barber.displayName || 'Barber', chair: barber.chairNumber, tone: 'live', occupied: true,
        occupant: guest.customerName || 'Guest', detail: serviceOf(guest) || 'Walk-in',
        since: since ? `since ${clock(since, data.timeZone)} · ${sinceLabel(since, live.now)}` : null,
      };
    }
    // A free chair says who it is waiting for: the first guest in line who asked for this barber.
    const nextUp = line.find((entry) => entry.requestedBarber?.id === barber.id);
    return {
      id: barber.id, barber: barber.displayName || 'Barber', chair: barber.chairNumber, tone: 'off', occupant: 'Free',
      detail: nextUp ? `Next up ${nextUp.customerName || 'Guest'}` : 'No walk-in seated',
    };
  });

  const header = (
    <PageHeader
      title="Walk-in queue"
      tone={live.refreshing ? 'wait' : 'live'}
      meta={<>{waitingCount ? `${waitingCount} in line` : 'No one in line'}{longest ? <> · longest wait <span className="tabular-nums" suppressHydrationWarning>{waitAge(longest, live.now)}</span></> : null} · <span className="tabular-nums" suppressHydrationWarning>updated {liveStamp(live.lastRefreshedAt, data.timeZone)}</span></>}
      actions={(
        <Track>
          <Pill className="relative" onClick={live.refresh} disabled={live.refreshing} aria-label="Refresh queue"><RefreshCw className={cn(live.refreshing && 'animate-spin')} /><span className="max-sm:sr-only">{live.refreshing ? 'Refreshing' : 'Refresh'}</span></Pill>
          <PillLink href="/dashboard/platform/booking">Booking board</PillLink>
          <Pill variant="primary" onClick={() => setAdding((value) => !value)} aria-expanded={adding} aria-controls="add-walk-in">{adding ? <><X />Close</> : <><Plus />Add walk-in</>}</Pill>
        </Track>
      )}
    />
  );

  const empty = data.search ? `No one in the queue matches “${data.search}”.` : 'No one in line.';

  const renderRow = (entry: QueueEntry, position: number | null) => {
    const status = entry.status as QueueStatus;
    const inChair = status === 'in_chair';
    const next = position === 1;
    const canSeat = !inChair && Boolean(entry.requestedService?.id);
    const service = serviceOf(entry);
    const barber = barberOf(entry);
    return (
      <Fragment key={entry.id}>
        <tr className={cn(stack.row, next && 'bg-muted/40')}>
          <td className={cn(stack.td, 'w-12 tabular-nums', stack.wide)}>
            {position ? <span className={cn('text-sm', next ? 'font-semibold' : 'text-muted-foreground')}>{position}</span> : <span className="text-muted-foreground">·</span>}
          </td>
          <td className={stack.td}>
            <p className="font-medium">
              {next ? <span className="mr-2 inline-flex h-5 items-center rounded-[4px] bg-foreground px-1.5 text-[11px] font-semibold text-background">Next</span> : null}
              {entry.customerName || 'Guest'}
              {(entry.partySize || 1) > 1 ? <span className="ml-1.5 text-xs font-normal tabular-nums text-muted-foreground">party of {entry.partySize}</span> : null}
            </p>
            <p className="text-xs text-muted-foreground">{entry.phone || 'No phone'}<span className="md:hidden"> · {service || 'No service yet'} · {barber || 'Any barber'}</span></p>
            {entry.notes ? <p className="mt-1 max-w-prose text-xs text-muted-foreground">{entry.notes}</p> : null}
          </td>
          <td className={cn(stack.td, stack.wide)}>
            <p className={cn(!service && 'text-muted-foreground')}>{service || 'No service yet'}</p>
            <p className="text-xs text-muted-foreground">{barber || 'Any barber'}</p>
          </td>
          <td className={cn(stack.td, 'whitespace-nowrap text-right md:text-left')}>
            <p className="font-semibold tabular-nums" suppressHydrationWarning>{inChair ? sinceLabel(entry.seatedAt || entry.checkedInAt, live.now) || '—' : waitAge(entry.checkedInAt, live.now)}</p>
            <p className="text-xs tabular-nums text-muted-foreground">{entry.quotedWaitMinutes == null ? 'no quote' : `quoted ${entry.quotedWaitMinutes} min`}</p>
          </td>
          <td className={cn(stack.td, 'whitespace-nowrap')}>
            <StatusCell tone={queueTone[status] || 'off'}>{shortStatus[status] || queueStatusLabels[status] || 'Unknown'}</StatusCell>
          </td>
          <td className={cn(stack.td, stack.full, 'md:text-right')}>
            <div className="flex flex-wrap gap-1.5 md:justify-end">
              {!inChair && <Pill size="sm" variant="primary" disabled={pending || !canSeat} onClick={() => convertToAppointment(entry)} title={canSeat ? undefined : 'Choose a service first'}>Seat</Pill>}
              {inChair && entry.appointment?.id && <PillLink size="sm" variant="primary" href={`/dashboard/platform/pos?appointment=${encodeURIComponent(entry.appointment.id)}`}>Checkout</PillLink>}
              {status === 'waiting' && <Pill size="sm" disabled={pending} onClick={() => updateStatus(entry.id, 'texted')}>Contacted</Pill>}
              {!inChair && (
                <Pill size="sm" aria-expanded={assigningId === entry.id} onClick={() => setAssigningId(assigningId === entry.id ? null : entry.id)}>
                  {entry.requestedService?.id ? 'Change' : 'Choose service'}
                </Pill>
              )}
              {!inChair && <Pill size="sm" variant="flat" disabled={pending} onClick={() => updateStatus(entry.id, 'left')}>Left</Pill>}
            </div>
            {inChair && !entry.appointment?.id && <p className="mt-1 text-xs text-muted-foreground">No linked appointment</p>}
            {!inChair && !entry.requestedService?.id && <p className="mt-1 text-xs text-muted-foreground">Service needed to seat</p>}
          </td>
        </tr>
        {assigningId === entry.id && (
          <tr className="max-md:block">
            <td colSpan={6} className="border-b bg-muted/30 px-3 pb-3 max-md:block">
              <AssignQueueEntryForm
                queueEntryId={entry.id}
                currentServiceId={entry.requestedService?.id}
                currentBarberId={entry.requestedBarber?.id}
                services={services}
                barbers={barbers}
                onClose={() => setAssigningId(null)}
              />
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  return (
    <PageContainer title="Walk-in queue" header={header} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-6 px-4 pb-24 md:px-6">
        {adding && (
          <Section id="add-walk-in" title="Add walk-in" className="rounded-[6px] border p-4">
            <AddWalkInForm services={services} barbers={barbers} onClose={() => setAdding(false)} />
          </Section>
        )}

        <ChairStrip
          label="Chairs"
          cells={chairs}
          empty={<>No active barbers. <Link className="underline underline-offset-4" href="/dashboard/platform/staff">Barbers & schedules</Link></>}
        />

        <div aria-live="polite" className="empty:-mt-6">{message && <Notice tone={message.tone}>{message.text}</Notice>}</div>

        <section aria-labelledby="queue-line" className="min-w-0 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="queue-line" className="text-sm font-semibold">
              Line
              <span className="ml-2 text-xs font-normal tabular-nums text-muted-foreground" role="status">
                {data.activeMatching ? `${firstShown}–${lastShown} of ${data.activeMatching}${data.search ? ' matching' : ''}` : '0'}
              </span>
            </h2>
            <form action="/dashboard/platform/queue" role="search" className="relative w-full sm:w-72">
              <label htmlFor="queue-search" className="sr-only">Search the queue</label>
              <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input id="queue-search" name="q" type="search" defaultValue={data.search} placeholder="Name or phone, then Enter" className="h-9 w-full rounded-[6px] border bg-background pl-8 pr-16 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              {data.search && <Link href="/dashboard/platform/queue" className="absolute right-1.5 top-1/2 inline-flex h-7 -translate-y-1/2 items-center rounded-[6px] px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Clear</Link>}
            </form>
          </div>

          <div className={stack.wrap}>
            <table className={stack.table} aria-label="Walk-in line">
              <thead className={stack.head}>
                <tr>
                  <th scope="col" className={cn(stack.th, 'w-12')}>#</th>
                  <th scope="col" className={stack.th}>Guest</th>
                  <th scope="col" className={stack.th}>Service · barber</th>
                  <th scope="col" className={stack.th}>Waited</th>
                  <th scope="col" className={stack.th}>Status</th>
                  <th scope="col" className={cn(stack.th, 'text-right')}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className={stack.body}>
                {line.map((entry, index) => renderRow(entry, ranked ? index + 1 : null))}
                {seated.map((entry) => renderRow(entry, null))}
                {!line.length && !seated.length && (
                  <tr className="max-md:block">
                    <td colSpan={6} className="px-3 py-6 text-sm text-muted-foreground max-md:block">
                      <span className="mr-3">{data.activeMatching > 0 ? 'Not on this page.' : empty}</span>
                      {!data.search && !adding && <Pill size="sm" onClick={() => setAdding(true)}><Plus />Add walk-in</Pill>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <Pager label="Queue pages" page={data.page} pages={totalPages} prev={data.page > 1 ? queueHref(data.search, data.page - 1) : null} next={data.page < totalPages ? queueHref(data.search, data.page + 1) : null} />

        <Section id="served" title="Recently served" count={servedEntries.length} actions={<Link className="text-xs font-medium underline-offset-4 hover:underline" href="/dashboard/walk-in-queue-entries">All history</Link>}>
          {servedEntries.length ? (
            <ul className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-4">
              {servedEntries.map((entry) => <li key={entry.id} className="flex min-w-0 items-baseline justify-between gap-2 border-b py-2 text-sm"><span className="truncate font-medium">{entry.customerName}</span><span className="truncate text-xs text-muted-foreground">{serviceOf(entry) || 'Walk-in'}</span></li>)}
            </ul>
          ) : <p className="text-sm text-muted-foreground">No recently served walk-ins.</p>}
        </Section>
      </div>
    </PageContainer>
  );
}
