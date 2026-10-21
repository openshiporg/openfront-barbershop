import { getAllServices, type StorefrontService } from '../lib/data/services';
import { getPublicStorefrontSettings } from '../lib/data/settings';
import { getStorefrontQueueStatus } from '../lib/data/queue';
import { StorefrontShell } from './StorefrontShell';
import { QueuePageClient } from './QueuePageClient';

export default async function QueuePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams || {};
  const entryId = typeof params.id === 'string' ? params.id : '';
  const [settings, lookup] = await Promise.all([
    getPublicStorefrontSettings(),
    entryId ? getStorefrontQueueStatus(entryId) : Promise.resolve(null),
  ]);
  // An existing queue place stays visible even if the public storefront is paused.
  if (lookup) {
    return <StorefrontShell allowUnavailableChildren><main id="main-content" className="sf-container-narrow py-[var(--space-3xl)]"><p className="sf-eyebrow">Walk-ins</p><h1 className="sf-display mt-3 text-[var(--text-display-s)]">Your place in the queue.</h1>
      <section className="sf-panel mt-8 p-6" role="status">
        {lookup.status === 'found' ? <><h2 className="sf-display text-2xl">Status: {lookup.entry.status.replaceAll('_', ' ')}</h2><p className="mt-3">{lookup.entry.requestedBarber?.displayName || 'Next available barber'}{lookup.entry.quotedWaitMinutes != null ? ` · The shop estimates about ${lookup.entry.quotedWaitMinutes} minutes` : ' · Ask the shop for the current wait'}</p><p className="mt-3">Refresh this page for updates.</p></>
          : lookup.status === 'unavailable' ? <p>Your queue status couldn’t load. Reload this page in a moment{settings?.phone ? ` or call ${settings.phone}` : ''}.</p>
          : <p>This queue entry can only be opened from the browser that joined the queue. Ask the shop{settings?.phone ? ` at ${settings.phone}` : ''} for your place.</p>}
      </section></main></StorefrontShell>;
  }
  let services: StorefrontService[] = [];
  let catalogError = false;
  try { services = await getAllServices(); } catch { catalogError = true; }
  return <StorefrontShell>{settings && <main id="main-content" className="sf-container-narrow py-[var(--space-3xl)]"><p className="sf-eyebrow">Walk-ins</p><h1 className="sf-display mt-3 text-[var(--text-display-s)]">Next available chair.</h1><p className="sf-lead mt-6">Walk-ins are seated between appointments. Joining does not reserve a specific time. {settings.phone && `Call ${settings.phone} for the current wait.`}</p>{catalogError ? <p role="alert" className="sf-panel mt-8 p-6">The walk-in form couldn’t load. Try again in a moment.</p> : <QueuePageClient services={services} />}</main>}</StorefrontShell>;
}
