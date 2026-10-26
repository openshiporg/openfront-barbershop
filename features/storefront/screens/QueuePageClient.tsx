'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StorefrontService } from '../lib/data/services';
import { joinStorefrontQueue } from '../lib/data/queue';

function newAccessToken() {
  const bytes = window.crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function QueuePageClient({ services }: { services: StorefrontService[] }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Awaited<ReturnType<typeof joinStorefrontQueue>> | null>(null);
  // Same details retried reuse the same token, so a lost response can't create a duplicate.
  const intent = useRef<{ signature: string; token: string } | null>(null);
  const router = useRouter();
  const joinedId = result?.success ? result.queueEntry?.id : undefined;
  // The server ticket shows the live place in line.
  useEffect(() => { if (joinedId) router.replace(`/queue?id=${encodeURIComponent(joinedId)}`); }, [joinedId, router]);

  if (result?.success && result.queueEntry) {
    return (
      <section className="sf-ticket mt-8" role="status" aria-label="Queue ticket">
        <div className="sf-ticket-head">
          <div className="grid gap-3">
            <p className="sf-eyebrow"><span className="sf-dot is-wait" aria-hidden="true" />On the list</p>
            <p className="sf-ticket-wait">{result.queueEntry.quotedWaitMinutes != null ? <>{result.queueEntry.quotedWaitMinutes}<small> min</small></> : <small>In line</small>}</p>
          </div>
        </div>
        <dl>
          <div><dt>Barber</dt><dd>{result.queueEntry.requestedBarber?.displayName || 'Next available'}</dd></div>
          <div><dt>Time</dt><dd>Seated when a chair is free</dd></div>
        </dl>
        <div className="sf-actions is-block"><Link className="sf-btn is-primary" href={`/queue?id=${encodeURIComponent(result.queueEntry.id)}`}>View ticket</Link></div>
      </section>
    );
  }

  return (
    <form className="sf-form mt-8" onSubmit={async event => {
      event.preventDefault(); if (pending) return; setPending(true); setError('');
      const fields = new FormData(event.currentTarget);
      const input = { customerName: String(fields.get('name') || '').trim(), phone: String(fields.get('phone') || '').trim(), partySize: Number(fields.get('partySize')), requestedServiceId: String(fields.get('service') || '') };
      const signature = JSON.stringify(input);
      if (intent.current?.signature !== signature) intent.current = { signature, token: newAccessToken() };
      try {
        const response = await joinStorefrontQueue({ ...input, accessToken: intent.current.token });
        setResult(response);
        if (!response.success) setError(response.error || 'Unable to join the queue.');
      } catch { setError('We couldn’t confirm whether you joined the queue. Try again; you won’t be added twice.'); }
      finally { setPending(false); }
    }}>
      <label className="sf-field"><span>Full name</span><input className="sf-input" name="name" required maxLength={120} autoComplete="name" /></label>
      <label className="sf-field"><span>Phone</span><input className="sf-input" name="phone" type="tel" inputMode="tel" required maxLength={40} autoComplete="tel" /></label>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <label className="sf-field"><span>Service</span><select className="sf-select" name="service" required>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
        <label className="sf-field"><span>Party</span><input className="sf-input sf-mono" name="partySize" type="number" min={1} max={8} defaultValue={1} required /></label>
      </div>
      {error && <p role="alert" className="sf-notice is-error">{error}</p>}
      <div className="sf-actions is-block"><button className="sf-btn is-accent" disabled={pending || !services.length}>{pending ? 'Taking a number…' : 'Take a number'}</button></div>
    </form>
  );
}
