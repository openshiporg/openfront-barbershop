'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
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

  if (result?.success && result.queueEntry) {
    return <section className="sf-panel mt-8 p-6" role="status"><h2 className="sf-display text-2xl">You’re in the queue.</h2><p className="mt-3">The shop will seat you when a chair is free. Joining doesn’t reserve a specific time.</p><Link className="sf-btn sf-btn-primary mt-4" href={`/queue?id=${encodeURIComponent(result.queueEntry.id)}`}>Check your place</Link></section>;
  }

  return <form className="sf-panel mt-8 space-y-5 p-6" onSubmit={async event => {
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
    <label className="block">Full name<input className="sf-input mt-2 block w-full" name="name" required maxLength={120} autoComplete="name" /></label>
    <label className="block">Phone<input className="sf-input mt-2 block w-full" name="phone" type="tel" inputMode="tel" required maxLength={40} autoComplete="tel" /></label>
    <label className="block">Service<select className="sf-input mt-2 block w-full" name="service" required>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
    <label className="block">Party size<input className="sf-input mt-2 block w-full" name="partySize" type="number" min={1} max={8} defaultValue={1} required /></label>
    {error && <p role="alert" className="break-words">{error}</p>}
    <button className="sf-btn sf-btn-primary" disabled={pending || !services.length}>{pending ? 'Joining…' : 'Join walk-in queue'}</button>
  </form>;
}
