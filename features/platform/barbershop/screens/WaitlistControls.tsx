'use client';

import { useId, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatShopDateTime, shopDateKey } from '@/features/shared/shop-time';
import { StaffBookingForm } from '@/features/platform/booking/components/StaffBookingForm';
import { parseShopDateTime } from '@/features/platform/booking/lib/shopTimeInput';
import { useCommandKey } from '@/features/platform/lib/useCommandKey';
import { manageWaitlistAction } from '../actions/operations';

type Named = { id: string; name: string };
type Entry = { id: string; status: string; customerName: string; phone?: string | null; preferredAt?: string | null; requestedService?: Named | null; requestedBarber?: Named | null };
type WaitlistInput = Parameters<typeof manageWaitlistAction>[0];

const selectClass = 'h-9 rounded-md border bg-background px-3 text-sm';

export function WaitlistControls({ entries, services, barbers, timeZone }: { entries: Entry[]; services: Named[]; barbers: Named[]; timeZone?: string | null }) {
  const id = useId();
  const { keyFor, settle } = useCommandKey('waitlist');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [barberId, setBarberId] = useState('');
  const [result, setResult] = useState<{ tone: 'status' | 'alert'; text: string } | null>(null);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [, start] = useTransition();
  const zone = timeZone || null;

  const run = (input: WaitlistInput, target: string, success: string) => {
    setResult(null);
    const key = keyFor(input, target);
    setPendingTarget(target);
    start(async () => {
      try {
        const response = await manageWaitlistAction(input, key);
        if (!response.success) { setResult({ tone: 'alert', text: response.error || 'Unable to update the waitlist.' }); return; }
        settle(target);
        setResult({ tone: 'status', text: success });
        if (input.action === 'create') { setName(''); setPhone(''); setDate(''); setTime(''); setServiceId(''); setBarberId(''); }
      } catch {
        setResult({ tone: 'alert', text: 'Connection interrupted. The change may have been saved. Retry without edits to check; it will not apply twice.' });
      } finally {
        setPendingTarget(null);
      }
    });
  };

  const add = () => {
    if (name.trim().length < 2) { setResult({ tone: 'alert', text: 'Enter the customer’s name.' }); return; }
    if (phone.replace(/\D/g, '').length < 7) { setResult({ tone: 'alert', text: 'Enter a phone number with at least 7 digits.' }); return; }
    let preferredAt: string | undefined;
    if (date || time) {
      if (!zone) { setResult({ tone: 'alert', text: 'Shop timezone is not configured, so a preferred time cannot be recorded. Set it in Store Settings.' }); return; }
      const parsed = parseShopDateTime(date, time, zone);
      if (!parsed.ok) { setResult({ tone: 'alert', text: parsed.error }); return; }
      preferredAt = parsed.iso;
    }
    run({ action: 'create', customerName: name.trim(), phone: phone.trim(), requestedServiceId: serviceId || undefined, requestedBarberId: barberId || undefined, preferredAt }, 'create', 'Added to the waitlist.');
  };

  return <div className="space-y-3">
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="grid gap-1"><Label htmlFor={`${id}-name`}>Customer name</Label><Input id={`${id}-name`} value={name} onChange={(event) => setName(event.target.value)} /></div>
      <div className="grid gap-1"><Label htmlFor={`${id}-phone`}>Phone</Label><Input id={`${id}-phone`} value={phone} inputMode="tel" onChange={(event) => setPhone(event.target.value)} /></div>
      <div className="grid gap-1"><Label htmlFor={`${id}-date`}>Preferred date (optional)</Label><Input id={`${id}-date`} type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
      <div className="grid gap-1"><Label htmlFor={`${id}-time`}>Preferred time{zone ? ` (${zone})` : ''}</Label><Input id={`${id}-time`} type="time" step={300} value={time} onChange={(event) => setTime(event.target.value)} /></div>
      <div className="grid gap-1"><Label htmlFor={`${id}-service`}>Service</Label><select id={`${id}-service`} value={serviceId} onChange={(event) => setServiceId(event.target.value)} className={selectClass}><option value="">Any service</option>{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div className="grid gap-1"><Label htmlFor={`${id}-barber`}>Barber</Label><select id={`${id}-barber`} value={barberId} onChange={(event) => setBarberId(event.target.value)} className={selectClass}><option value="">Any barber</option>{barbers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <Button className="sm:col-span-2 sm:justify-self-start" disabled={pendingTarget === 'create'} onClick={add}>{pendingTarget === 'create' ? 'Adding…' : 'Add to waitlist'}</Button>
    </div>
    <div aria-live="polite">{result && <p role={result.tone} className={`text-sm ${result.tone === 'alert' ? 'text-destructive' : 'text-muted-foreground'}`}>{result.text}</p>}</div>
    <div className="space-y-2">{entries.map((entry) => {
      const busy = pendingTarget === entry.id;
      const [firstName, ...rest] = entry.customerName.split(/\s+/);
      return <div key={entry.id} className="rounded-md border p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><strong>{entry.customerName}</strong><p className="text-xs text-muted-foreground">{entry.requestedService?.name || 'Any service'} · {entry.requestedBarber?.name || 'Any barber'} · {entry.status}{entry.preferredAt ? ` · ${zone ? `${formatShopDateTime(entry.preferredAt, zone)} (${zone})` : new Date(entry.preferredAt).toISOString()}` : ''}</p></div>
          <div className="flex flex-wrap gap-1">
            {['waiting', 'notified'].includes(entry.status) && zone && <Button size="sm" variant="outline" disabled={busy} aria-expanded={promotingId === entry.id} onClick={() => setPromotingId(promotingId === entry.id ? null : entry.id)}>Book appointment</Button>}
            {entry.status === 'waiting' && <Button size="sm" variant="outline" disabled={busy} onClick={() => run({ action: 'notify', waitlistEntryId: entry.id }, entry.id, 'Marked as notified. No message was sent.')}>Mark notified</Button>}
            {['waiting', 'notified'].includes(entry.status) && <Button size="sm" variant="ghost" disabled={busy} onClick={() => run({ action: 'expire', waitlistEntryId: entry.id }, entry.id, 'Waitlist entry expired.')}>Expire</Button>}
          </div>
        </div>
        {promotingId === entry.id && zone && (
          <div className="mt-3 border-t pt-3">
            <StaffBookingForm
              services={services}
              barbers={barbers}
              timeZone={zone}
              defaultDate={entry.preferredAt ? shopDateKey(entry.preferredAt, zone) : shopDateKey(new Date(), zone)}
              defaultServiceId={entry.requestedService?.id}
              defaultBarberId={entry.requestedBarber?.id}
              prefill={{ firstName: firstName || entry.customerName, lastName: rest.join(' '), phone: entry.phone || '' }}
              waitlistEntryId={entry.id}
              submitLabel="Book and mark waitlist booked"
              onCancel={() => setPromotingId(null)}
            />
          </div>
        )}
      </div>;
    })}{!entries.length && <p className="text-sm text-muted-foreground">No one is waiting.</p>}</div>
  </div>;
}
