'use client';

import { useId, useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatShopDateTime, shopDateKey } from '@/features/shared/shop-time';
import { StaffBookingForm } from '@/features/platform/booking/components/StaffBookingForm';
import { parseShopDateTime } from '@/features/platform/booking/lib/shopTimeInput';
import { useCommandKey } from '@/features/platform/lib/useCommandKey';
import { manageWaitlistAction } from '../actions/operations';
import { Notice, Pill, selectClass as kitSelectClass, StatusCell } from '@/features/platform/lib/ui';
import { zoneLabel } from '@/features/platform/staff/screens/WorkforceControls';

type Named = { id: string; name: string };
type Entry = { id: string; status: string; customerName: string; phone?: string | null; preferredAt?: string | null; requestedService?: Named | null; requestedBarber?: Named | null };
type WaitlistInput = Parameters<typeof manageWaitlistAction>[0];

const selectClass = kitSelectClass;

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
  const [adding, setAdding] = useState(false);
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
        if (input.action === 'create') { setName(''); setPhone(''); setDate(''); setTime(''); setServiceId(''); setBarberId(''); setAdding(false); }
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

  const field = 'mt-1 h-9 rounded-[6px]';
  return <div className="space-y-4">
    {entries.length ? <ul className="rounded-[6px] border">{entries.map((entry) => {
      const busy = pendingTarget === entry.id;
      const [firstName, ...rest] = entry.customerName.split(/\s+/);
      const open = ['waiting', 'notified'].includes(entry.status);
      return <li key={entry.id} className="border-b px-3 py-2.5 text-sm last:border-b-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium">{entry.customerName}{entry.phone ? <a className="ml-2 text-xs font-normal tabular-nums text-muted-foreground underline-offset-4 hover:underline" href={`tel:${entry.phone}`}>{entry.phone}</a> : null}</p>
            <p className="text-xs text-muted-foreground">{entry.requestedService?.name || 'Any service'} · {entry.requestedBarber?.name || 'Any barber'}{entry.preferredAt ? ` · ${zone ? formatShopDateTime(entry.preferredAt, zone) : new Date(entry.preferredAt).toISOString()}` : ''}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusCell tone={entry.status === 'notified' ? 'info' : entry.status === 'waiting' ? 'wait' : 'off'}>{entry.status === 'notified' ? 'Notified' : entry.status === 'waiting' ? 'Waiting' : entry.status}</StatusCell>
            {open && <span className="inline-flex items-center gap-1">
              {zone && <Pill size="sm" variant="primary" disabled={busy} aria-expanded={promotingId === entry.id} onClick={() => setPromotingId(promotingId === entry.id ? null : entry.id)}>Book</Pill>}
              {entry.status === 'waiting' && <Pill size="sm" disabled={busy} onClick={() => run({ action: 'notify', waitlistEntryId: entry.id }, entry.id, 'Marked notified. No message was sent.')}>Mark notified</Pill>}
              <Pill size="sm" variant="flat" disabled={busy} onClick={() => run({ action: 'expire', waitlistEntryId: entry.id }, entry.id, 'Waitlist entry expired.')}>Expire</Pill>
            </span>}
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
              submitLabel="Book and close request"
              onCancel={() => setPromotingId(null)}
            />
          </div>
        )}
      </li>;
    })}</ul> : <p className="py-2 text-sm text-muted-foreground">No one is waiting.</p>}
    {!adding ? (
      <Pill onClick={() => setAdding(true)} aria-expanded={false}>Add to waitlist</Pill>
    ) : (
      <div className="space-y-3 rounded-[6px] border p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor={`${id}-name`}>Customer name</Label><Input id={`${id}-name`} value={name} onChange={(event) => setName(event.target.value)} className={field} /></div>
          <div><Label htmlFor={`${id}-phone`}>Phone</Label><Input id={`${id}-phone`} value={phone} inputMode="tel" onChange={(event) => setPhone(event.target.value)} className={`${field} tabular-nums`} /></div>
          <div><Label htmlFor={`${id}-date`}>Preferred date (optional)</Label><Input id={`${id}-date`} type="date" value={date} onChange={(event) => setDate(event.target.value)} className={`${field} tabular-nums`} /></div>
          <div><Label htmlFor={`${id}-time`}>Preferred time{zone ? ` (${zoneLabel(zone)})` : ''}</Label><Input id={`${id}-time`} type="time" step={300} value={time} onChange={(event) => setTime(event.target.value)} className={`${field} tabular-nums`} /></div>
          <div><Label htmlFor={`${id}-service`}>Service</Label><select id={`${id}-service`} value={serviceId} onChange={(event) => setServiceId(event.target.value)} className={`${selectClass} mt-1`}><option value="">Any service</option>{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div><Label htmlFor={`${id}-barber`}>Barber</Label><select id={`${id}-barber`} value={barberId} onChange={(event) => setBarberId(event.target.value)} className={`${selectClass} mt-1`}><option value="">Any barber</option>{barbers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill variant="primary" disabled={pendingTarget === 'create'} onClick={add}>{pendingTarget === 'create' ? 'Adding…' : 'Add to waitlist'}</Pill>
          <Pill variant="flat" disabled={pendingTarget === 'create'} onClick={() => setAdding(false)}>Cancel</Pill>
        </div>
      </div>
    )}
    <div aria-live="polite">{result && <Notice tone={result.tone}>{result.text}</Notice>}</div>
  </div>;
}
