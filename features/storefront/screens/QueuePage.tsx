import { phoneHref } from '@/features/shared/storefront-settings';
import { getAllServices, type StorefrontService } from '../lib/data/services';
import { getPublicStorefrontSettings } from '../lib/data/settings';
import { getStorefrontQueueStatus } from '../lib/data/queue';
import { statusLabel } from '../lib/format';
import { StorefrontShell } from './StorefrontShell';
import { QueuePageClient } from './QueuePageClient';

const queueTone: Record<string, string> = { waiting: 'is-wait', texted: 'is-accent', in_chair: 'is-live' };

export default async function QueuePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams || {};
  const entryId = typeof params.id === 'string' ? params.id : '';
  const [settings, lookup] = await Promise.all([
    getPublicStorefrontSettings(),
    entryId ? getStorefrontQueueStatus(entryId) : Promise.resolve(null),
  ]);
  const telephoneHref = phoneHref(settings?.phone);
  const call = telephoneHref && settings?.phone ? <a className="sf-link" href={`tel:${telephoneHref}`}>{settings.phone}</a> : null;

  // An existing queue place stays visible even if the public storefront is paused.
  if (lookup) {
    return (
      <StorefrontShell allowUnavailableChildren>
        <main id="main-content" className="sf-container-narrow py-[var(--space-2xl)]">
          <p className="sf-eyebrow mb-3">Walk-ins</p>
          <h1 className="sf-display mb-8 text-[var(--text-display-s)]">Your ticket</h1>
          {lookup.status === 'found' ? (
            <section className="sf-ticket" role="status" aria-label="Queue ticket">
              <div className="sf-ticket-head">
                <div className="grid gap-2">
                  <p className="sf-eyebrow text-[var(--color-inverse-muted)]"><span className={`sf-dot ${queueTone[lookup.entry.status] || ''}`} aria-hidden="true" />{statusLabel(lookup.entry.status)}</p>
                  <p className="sf-ticket-wait">{lookup.entry.quotedWaitMinutes != null ? `${lookup.entry.quotedWaitMinutes} min` : '— min'}</p>
                </div>
                <span className="sf-mono text-[0.72rem] text-[var(--color-inverse-muted)]">{settings?.name}</span>
              </div>
              <dl>
                <div><dt>Quoted wait</dt><dd>{lookup.entry.quotedWaitMinutes != null ? `About ${lookup.entry.quotedWaitMinutes} minutes` : 'Not quoted yet'}</dd></div>
                <div><dt>Barber</dt><dd>{lookup.entry.requestedBarber?.displayName || 'Next available'}</dd></div>
              </dl>
              <div className="sf-track is-block"><a href={`/queue?id=${encodeURIComponent(lookup.entry.id)}`} className="sf-pill">Refresh</a></div>
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
        <main id="main-content" className="sf-container-narrow py-[var(--space-2xl)]">
          <p className="sf-eyebrow mb-3">Walk-ins</p>
          <h1 className="sf-display text-[var(--text-display-s)]">Next chair</h1>
          <p className="sf-lead mt-4">Join the walk-in list. Seated between appointments; no fixed time.</p>
          {catalogError ? <p role="alert" className="sf-notice is-error mt-8">The walk-in form couldn’t load. Try again in a moment.</p> : <QueuePageClient services={services} />}
          {call ? <p className="sf-small sf-muted mt-6">Current wait: {call}</p> : null}
        </main>
      )}
    </StorefrontShell>
  );
}
