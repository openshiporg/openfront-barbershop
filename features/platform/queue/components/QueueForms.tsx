'use client';

import { useId, useMemo, useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCommandKey } from '@/features/platform/lib/useCommandKey';
import { Notice, Pill, selectClass as kitSelectClass, Track } from '@/features/platform/lib/ui';
import { assignQueueEntryAction, createStaffQueueEntryAction, type QueueBarberOption, type QueueServiceOption } from '../actions/queue';

const selectClass = kitSelectClass;

function eligibleBarbers(barbers: QueueBarberOption[], service?: QueueServiceOption) {
  return barbers.filter((barber) => !service?.specialistIds.length || service.specialistIds.includes(barber.id));
}

export function AddWalkInForm({ services, barbers, onClose }: { services: QueueServiceOption[]; barbers: QueueBarberOption[]; onClose: () => void }) {
  const id = useId();
  const { keyFor, settle } = useCommandKey('staff-queue-add');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState('1');
  const [wait, setWait] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [barberId, setBarberId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const service = services.find((item) => item.id === serviceId);
  const barberOptions = useMemo(() => eligibleBarbers(barbers, service), [barbers, service]);

  const submit = () => {
    setError(null); setStatus(null);
    const size = Number(partySize); const minutes = wait.trim() === '' ? null : Number(wait);
    if (name.trim().length < 2) { setError('Enter the guest’s name.'); return; }
    if (phone.trim() && phone.replace(/\D/g, '').length < 7) { setError('Enter a phone number with at least 7 digits, or leave it blank.'); return; }
    if (!Number.isInteger(size) || size < 1 || size > 8) { setError('Party size must be a whole number from 1 to 8.'); return; }
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0 || minutes > 480)) { setError('Quoted wait must be a whole number of minutes from 0 to 480, or blank for no estimate.'); return; }
    const input = { customerName: name.trim(), phone: phone.trim(), partySize: size, requestedServiceId: serviceId || undefined, requestedBarberId: barberId || undefined, notes: notes.trim(), quotedWaitMinutes: minutes };
    const key = keyFor(input);
    startTransition(async () => {
      try {
        const result = await createStaffQueueEntryAction(input, key);
        if (!result.success || typeof result.data?.queueEntryId !== 'string') { setError(result.error || 'The walk-in could not be confirmed. Refresh the queue before retrying.'); return; }
        settle();
        setStatus(result.data?.replayed ? 'This guest was already added; no duplicate was created.' : `${input.customerName} added to the queue.`);
        setName(''); setPhone(''); setPartySize('1'); setNotes(''); setServiceId(''); setBarberId('');
      } catch {
        setError('Connection interrupted. The guest may have been added. Submit again without changes to check; it will not create a duplicate.');
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="grid gap-1"><Label htmlFor={`${id}-name`}>Guest name</Label><Input id={`${id}-name`} value={name} maxLength={120} onChange={(event) => setName(event.target.value)} /></div>
        <div className="grid gap-1"><Label htmlFor={`${id}-phone`}>Phone (optional)</Label><Input id={`${id}-phone`} value={phone} maxLength={40} inputMode="tel" onChange={(event) => setPhone(event.target.value)} /></div>
        <div className="grid gap-1"><Label htmlFor={`${id}-party`}>Party size</Label><Input id={`${id}-party`} value={partySize} inputMode="numeric" onChange={(event) => setPartySize(event.target.value)} /></div>
        <div className="grid gap-1">
          <Label htmlFor={`${id}-service`}>Service</Label>
          <select id={`${id}-service`} className={selectClass} value={serviceId} onChange={(event) => { setServiceId(event.target.value); setBarberId(''); }}>
            <option value="">Decide later</option>
            {services.map((item) => <option key={item.id} value={item.id}>{item.name || 'Service'}</option>)}
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`${id}-barber`}>Barber</Label>
          <select id={`${id}-barber`} className={selectClass} value={barberId} onChange={(event) => setBarberId(event.target.value)}>
            <option value="">Any barber</option>
            {barberOptions.map((item) => <option key={item.id} value={item.id}>{item.displayName || 'Barber'}</option>)}
          </select>
        </div>
        <div className="grid gap-1"><Label htmlFor={`${id}-wait`}>Quoted wait, min (optional)</Label><Input id={`${id}-wait`} value={wait} inputMode="numeric" onChange={(event) => setWait(event.target.value)} /></div>
        <div className="grid gap-1 sm:col-span-2 lg:col-span-3"><Label htmlFor={`${id}-notes`}>Notes (optional)</Label><Input id={`${id}-notes`} value={notes} maxLength={1000} onChange={(event) => setNotes(event.target.value)} /></div>
      </div>
      <Track>
        <Pill variant="primary" disabled={pending} onClick={submit}>{pending ? 'Adding…' : 'Add to queue'}</Pill>
        <Pill disabled={pending} onClick={onClose}>Close</Pill>
      </Track>
      <div aria-live="polite">
        {error && <Notice tone="alert">{error}</Notice>}
        {status && <Notice>{status}</Notice>}
      </div>
    </div>
  );
}

export function AssignQueueEntryForm({ queueEntryId, currentServiceId, currentBarberId, services, barbers, onClose }: { queueEntryId: string; currentServiceId?: string | null; currentBarberId?: string | null; services: QueueServiceOption[]; barbers: QueueBarberOption[]; onClose: () => void }) {
  const id = useId();
  const { keyFor, settle } = useCommandKey(`staff-queue-assign:${queueEntryId}`);
  const [serviceId, setServiceId] = useState(currentServiceId || '');
  const [barberId, setBarberId] = useState(currentBarberId || '');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const service = services.find((item) => item.id === serviceId);
  const barberOptions = useMemo(() => eligibleBarbers(barbers, service), [barbers, service]);

  const submit = () => {
    setError(null); setStatus(null);
    if (!serviceId) { setError('Choose a service.'); return; }
    if (barberId && !barberOptions.some((item) => item.id === barberId)) { setError('That barber does not provide this service.'); return; }
    const input = { queueEntryId, requestedServiceId: serviceId, requestedBarberId: barberId || undefined };
    const key = keyFor(input);
    startTransition(async () => {
      try {
        const result = await assignQueueEntryAction(input, key);
        if (!result.success || result.data?.queueEntryId !== queueEntryId) { setError(result.error || 'The change could not be confirmed. Refresh the queue before retrying.'); return; }
        settle();
        setStatus('Service and barber saved.');
      } catch {
        setError('Connection interrupted. The change may have been saved. Submit again without edits to check.');
      }
    });
  };

  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label htmlFor={`${id}-service`}>Service</Label>
          <select id={`${id}-service`} className={selectClass} value={serviceId} onChange={(event) => { setServiceId(event.target.value); setBarberId(''); }}>
            <option value="">Choose a service</option>
            {services.map((item) => <option key={item.id} value={item.id}>{item.name || 'Service'}</option>)}
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`${id}-barber`}>Barber</Label>
          <select id={`${id}-barber`} className={selectClass} value={barberId} onChange={(event) => setBarberId(event.target.value)}>
            <option value="">Any barber</option>
            {barberOptions.map((item) => <option key={item.id} value={item.id}>{item.displayName || 'Barber'}{item.chairNumber ? ` · Chair ${item.chairNumber}` : ''}</option>)}
          </select>
        </div>
      </div>
      <Track>
        <Pill size="sm" variant="primary" disabled={pending} onClick={submit}>{pending ? 'Saving…' : 'Save'}</Pill>
        <Pill size="sm" disabled={pending} onClick={onClose}>Close</Pill>
      </Track>
      <div aria-live="polite">
        {error && <Notice tone="alert">{error}</Notice>}
        {status && <Notice>{status}</Notice>}
      </div>
    </div>
  );
}
