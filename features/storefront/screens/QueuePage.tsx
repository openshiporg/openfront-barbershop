import Link from 'next/link';
import { phoneHref } from '@/features/shared/storefront-settings';
import { getAllServices, type StorefrontService } from '../lib/data/services';
import { getPublicStorefrontSettings } from '../lib/data/settings';
import { getStorefrontQueueStatus, getStorefrontQueueSummary } from '../lib/data/queue';
import { statusLabel } from '../lib/format';
import { NowServingBoard } from '../components/NowServingBoard';
import { StorefrontShell } from './StorefrontShell';
import { QueuePageClient } from './QueuePageClient';

const queueTone: Record<string, string> = { waiting: 'is-wait', texted: 'is-live', in_chair: 'is-live' };

export default async function QueuePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams || {};
  const entryId = typeof params.id === 'string' ? params.id : '';
  const [settings, lookup, summary] = await Promise.all([
    getPublicStorefrontSettings(),
    entryId ? getStorefrontQueueStatus(entryId) : Promise.resolve(null),
    getStorefrontQueueSummary(),
  ]);
  const place = lookup?.status === 'found' && summary ? summary.order.indexOf(lookup.entry.id) + 1 : 0;
  const telephoneHref = phoneHref(settings?.phone);
  const call = telephoneHref && settings?.phone ? <a className="sf-link" href={`tel:${telephoneHref}`}>{settings.phone}</a> : null;

  // An existing queue place stays visible even if the public storefront is paused.
  if (lookup) {
    return (
      <StorefrontShell allowUnavailableChildren>
        <main id="main-content" className="sf-container-narrow py-[var(--space-2xl)]">
          <h1 className="sf-display mb-8 sf-h1">Your ticket</h1>
          {lookup.status === 'found' ? (
            <section className="sf-ticket" role="status" aria-label="Queue ticket">
              <div className="sf-ticket-head">
                <div className="grid gap-3">
                  <p className="sf-ticket-wait">{place > 0 ? <><small>No. </small>{place}</> : lookup.entry.quotedWaitMinutes != null ? <>{lookup.entry.quotedWaitMinutes}<small> min</small></> : <small>In line</small>}</p>
                </div>
                <span className="sf-small font-semibold text-end">{settings?.name}</span>
              </div>
              <dl>
                <div><dt>Status</dt><dd className="capitalize"><span className={`sf-dot ${queueTone[lookup.entry.status] || ''}`} aria-hidden="true" />{statusLabel(lookup.entry.status)}</dd></div>
                {place > 0 ? <div><dt>Place in line</dt><dd className="sf-mono">{place} of {summary!.waiting}</dd></div> : null}
                <div><dt>Quoted wait</dt><dd>{lookup.entry.quotedWaitMinutes != null ? `About ${lookup.entry.quotedWaitMinutes} minutes` : 'Not quoted yet'}</dd></div>
                <div><dt>Barber</dt><dd>{lookup.entry.requestedBarber?.displayName || 'Next available'}</dd></div>
              </dl>
              <div className="sf-actions is-block"><a href={`/queue?id=${encodeURIComponent(lookup.entry.id)}`} className="sf-btn is-primary">Refresh my place</a></div>
            </section>
          ) : (
            <div className="sf-empty" role={lookup.status === 'unavailable' ? 'alert' : undefined}>
              <p className="sf-subtitle">{lookup.status === 'unavailable' ? 'Ticket couldn’t load' : 'Ticket not on this browser'}</p>
              <p className="sf-muted">{lookup.status === 'unavailable' ? 'Reload in a moment.' : 'Open it from the browser that joined the queue, or ask the shop.'}</p>
              {call}
            </div>
          )}
        </main>
      </StorefrontShell>
    );
  }

  let services: StorefrontService[] = [];
  let catalogError = false;
  try { services = await getAllServices(); } catch { catalogError = true; }
  return (
    <StorefrontShell>
      {settings && (
        <main id="main-content" className="sf-container-narrow py-[var(--space-xl)] pb-[var(--space-3xl)]">
          <h1 className="sf-display sf-h1">Take a number</h1>
          <p className="sf-lead mb-6 mt-3">Join the walk-in line. You’re seated between appointments, in order; there’s no fixed time.</p>
          <NowServingBoard summary={summary} headingId="queue-board" phone={call} />
          {summary && !summary.open ? (
            <div className="sf-empty mt-8" role="status">
              <p className="sf-subtitle">Walk-ins are closed{summary.opensAt ? ` · ${summary.opensAt}` : ''}</p>
              <div className="sf-actions"><Link href="/book" className="sf-btn is-accent">Book a time</Link></div>
            </div>
          ) : null}
          {summary && !summary.open ? null : catalogError ? <p role="alert" className="sf-notice is-error mt-8">The walk-in form couldn’t load. Try again in a moment.</p> : <QueuePageClient services={services} />}
          {call ? <p className="sf-small sf-muted mt-6">Call {call}</p> : null}
        </main>
      )}
    </StorefrontShell>
  );
}
