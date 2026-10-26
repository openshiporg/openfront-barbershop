'use client';

import { useEffect, useId, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getAvailableTimeSlots, type StorefrontTimeSlot } from '@/features/storefront/lib/data/availability';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCommandKey } from '@/features/platform/lib/useCommandKey';
import { createStaffAppointmentAction, searchBookingCustomersAction, type CustomerMatch, type StaffBookingInput } from '../actions/appointments';
import { parseShopDateTime } from '../lib/shopTimeInput';
import { Notice, Pill, selectClass, Track } from '@/features/platform/lib/ui';
import { Segmented } from './FloorKit';

type ServiceOption = { id: string; name?: string | null; durationMinutes?: number | null; depositRequired?: boolean | null; specialistIds?: string[] };
type BarberOption = { id: string; displayName?: string | null; name?: string | null; bookingEnabled?: boolean | null };

export type StaffBookingFormProps = {
  services: ServiceOption[];
  barbers: BarberOption[];
  timeZone: string;
  defaultDate: string;
  defaultTime?: string;
  defaultServiceId?: string;
  defaultBarberId?: string;
  /** Prefill for a new customer (e.g. from a waitlist entry); never used to match an existing profile. */
  prefill?: { firstName?: string; lastName?: string; phone?: string; customerId?: string; customerLabel?: string };
  waitlistEntryId?: string;
  submitLabel?: string;
  onDone?: (appointmentId: string) => void;
  onCancel?: () => void;
};

function customerLabel(customer: CustomerMatch) {
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Customer';
  return `${name}${customer.phone ? ` · ${customer.phone}` : ''}${customer.email ? ` · ${customer.email}` : ''}`;
}

export function StaffBookingForm(props: StaffBookingFormProps) {
  const id = useId();
  const { keyFor, settle } = useCommandKey(`staff-booking:${props.waitlistEntryId || 'new'}`);
  const [mode, setMode] = useState<'existing' | 'new'>(props.prefill?.customerId ? 'existing' : props.prefill?.firstName ? 'new' : 'existing');
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState<CustomerMatch[]>([]);
  const [searchMessage, setSearchMessage] = useState('');
  const [customerId, setCustomerId] = useState(props.prefill?.customerId || '');
  const [selectedLabel, setSelectedLabel] = useState(props.prefill?.customerLabel || '');
  const [firstName, setFirstName] = useState(props.prefill?.firstName || '');
  const [lastName, setLastName] = useState(props.prefill?.lastName || '');
  const [phone, setPhone] = useState(props.prefill?.phone || '');
  const [email, setEmail] = useState('');
  const [serviceId, setServiceId] = useState(props.defaultServiceId || '');
  const [barberId, setBarberId] = useState(props.defaultBarberId || '');
  const [date, setDate] = useState(props.defaultDate);
  const [time, setTime] = useState(props.defaultTime || '');
  const [source, setSource] = useState<'phone' | 'staff' | 'walk_in'>('phone');
  const [notes, setNotes] = useState('');
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [result, setResult] = useState<{ tone: 'status' | 'alert'; message: string; link?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [searching, startSearch] = useTransition();

  const router = useRouter();
  const [openTimes, setOpenTimes] = useState<StorefrontTimeSlot[] | null>(null);
  const service = props.services.find((item) => item.id === serviceId);

  // Open times for the chosen barber and day; staff can still enter any time.
  useEffect(() => {
    let cancelled = false;
    if (!service?.durationMinutes || !barberId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { Promise.resolve().then(() => { if (!cancelled) setOpenTimes(null); }); return () => { cancelled = true; }; }
    getAvailableTimeSlots(barberId, date, service.durationMinutes, service.id)
      .then((result) => { if (!cancelled) setOpenTimes(result.error ? null : result.slots); })
      .catch(() => { if (!cancelled) setOpenTimes(null); });
    return () => { cancelled = true; };
  }, [barberId, date, service]);
  const shopClock = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: props.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
  const barbers = useMemo(() => props.barbers.filter((barber) => barber.bookingEnabled !== false && (!service?.specialistIds?.length || service.specialistIds.includes(barber.id))), [props.barbers, service]);

  const runSearch = () => startSearch(async () => {
    setSearchMessage('');
    const response = await searchBookingCustomersAction(search);
    if (!response.success) { setSearchMessage(response.error || 'Customer search unavailable.'); setMatches([]); return; }
    setMatches(response.customers);
    setSearchMessage(response.customers.length ? `${response.customers.length} match${response.customers.length === 1 ? '' : 'es'} (first 10 shown).` : 'No matching customers. Refine the search or add a new customer.');
  });

  const submit = () => {
    setResult(null);
    setFieldError(null);
    if (mode === 'existing' && !customerId) { setFieldError({ field: 'customer', message: 'Search and select a customer, or switch to new customer.' }); return; }
    if (mode === 'new' && !firstName.trim()) { setFieldError({ field: 'first', message: 'Enter a first name.' }); return; }
    if (mode === 'new' && phone.replace(/\D/g, '').length < 7) { setFieldError({ field: 'phone', message: 'Enter a phone number with at least 7 digits.' }); return; }
    if (!serviceId) { setFieldError({ field: 'service', message: 'Choose a service.' }); return; }
    if (!barberId || !barbers.some((barber) => barber.id === barberId)) { setFieldError({ field: 'barber', message: 'Choose a barber who provides this service.' }); return; }
    const when = parseShopDateTime(date, time, props.timeZone);
    if (!when.ok) { setFieldError({ field: 'time', message: when.error }); return; }
    const input: StaffBookingInput = mode === 'existing'
      ? { customerId, serviceId, barberId, startsAt: when.iso, notes: notes.trim(), source, waitlistEntryId: props.waitlistEntryId }
      : { customerFirstName: firstName.trim(), customerLastName: lastName.trim(), customerPhone: phone.trim(), customerEmail: email.trim(), serviceId, barberId, startsAt: when.iso, notes: notes.trim(), source, waitlistEntryId: props.waitlistEntryId };
    const key = keyFor(input);
    startTransition(async () => {
      try {
        const response = await createStaffAppointmentAction(input, key);
        const appointmentId = typeof response.data?.appointmentId === 'string' ? response.data.appointmentId : '';
        if (!response.success || !appointmentId) {
          setResult({ tone: 'alert', message: response.error || 'The booking could not be confirmed. Refresh the board before retrying.' });
          return;
        }
        settle();
        const token = typeof response.data?.accessToken === 'string' ? response.data.accessToken : '';
        setResult({
          tone: 'status',
          message: response.data?.replayed
            ? 'This booking was already recorded; no duplicate was created.'
            : `Appointment booked and confirmed.${response.data?.waiverRequired ? ' Signed waiver required before it starts.' : ''}`,
          link: token ? `/appointment?id=${encodeURIComponent(appointmentId)}&token=${encodeURIComponent(token)}` : undefined,
        });
        props.onDone?.(appointmentId);
        // Show the board for the day just booked.
        if (!props.onDone) router.push(`/dashboard/platform/booking?date=${encodeURIComponent(date)}`);
      } catch {
        setResult({ tone: 'alert', message: 'Connection interrupted. The booking may have been recorded. Submit again without changes to check; the same request will not create a duplicate.' });
      }
    });
  };

  const errorFor = (field: string) => fieldError?.field === field ? <p id={`${id}-${field}-error`} role="alert" className="text-xs text-destructive">{fieldError.message}</p> : null;
  const described = (field: string) => fieldError?.field === field ? `${id}-${field}-error` : undefined;

  return (
    <div className="space-y-4">
      <Segmented label="Customer" value={mode} onChange={setMode} options={[{ value: 'existing', label: 'Existing customer' }, { value: 'new', label: 'New customer' }]} />

      {mode === 'existing' ? (
        <div className="space-y-2">
          <Label htmlFor={`${id}-search`}>Find customer</Label>
          <div className="flex gap-2">
            <Input className="rounded-[6px]" id={`${id}-search`} value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); runSearch(); } }} placeholder="Name, phone, or email" aria-describedby={described('customer')} />
            <Track><Pill disabled={searching || search.trim().length < 2} onClick={runSearch}>{searching ? 'Searching…' : 'Search'}</Pill></Track>
          </div>
          {searchMessage && <p role="status" className="text-xs text-muted-foreground">{searchMessage}</p>}
          {matches.length > 0 && (
            <div className="grid gap-1 rounded-[6px] border p-1" role="group" aria-label="Matching customers">
              {matches.map((match) => (
                <Pill key={match.id} size="sm" variant="flat" aria-pressed={customerId === match.id} className="justify-start overflow-hidden text-ellipsis" onClick={() => { setCustomerId(match.id); setSelectedLabel(customerLabel(match)); }}>
                  {customerLabel(match)}
                </Pill>
              ))}
            </div>
          )}
          <p className="text-sm">Selected: <strong>{customerId ? selectedLabel || 'Customer' : 'none'}</strong></p>
          {errorFor('customer')}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1"><Label htmlFor={`${id}-first`}>First name</Label><Input className="rounded-[6px]" id={`${id}-first`} value={firstName} maxLength={80} onChange={(event) => setFirstName(event.target.value)} aria-describedby={described('first')} />{errorFor('first')}</div>
          <div className="grid gap-1"><Label htmlFor={`${id}-last`}>Last name</Label><Input className="rounded-[6px]" id={`${id}-last`} value={lastName} maxLength={80} onChange={(event) => setLastName(event.target.value)} /></div>
          <div className="grid gap-1"><Label htmlFor={`${id}-phone`}>Phone</Label><Input className="rounded-[6px]" id={`${id}-phone`} value={phone} maxLength={40} inputMode="tel" onChange={(event) => setPhone(event.target.value)} aria-describedby={described('phone')} />{errorFor('phone')}</div>
          <div className="grid gap-1"><Label htmlFor={`${id}-email`}>Email (optional)</Label><Input className="rounded-[6px]" id={`${id}-email`} value={email} maxLength={200} type="email" onChange={(event) => setEmail(event.target.value)} /></div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label htmlFor={`${id}-service`}>Service</Label>
          <select id={`${id}-service`} value={serviceId} onChange={(event) => { setServiceId(event.target.value); setBarberId(''); }} aria-describedby={described('service')} className={selectClass}>
            <option value="">Choose a service</option>
            {props.services.map((item) => <option key={item.id} value={item.id}>{item.name || 'Service'}{item.durationMinutes ? ` · ${item.durationMinutes} min` : ''}{item.depositRequired ? ' · deposit due' : ''}</option>)}
          </select>
          {errorFor('service')}
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`${id}-barber`}>Barber</Label>
          <select id={`${id}-barber`} value={barberId} onChange={(event) => setBarberId(event.target.value)} aria-describedby={described('barber')} className={selectClass}>
            <option value="">Choose a barber</option>
            {barbers.map((item) => <option key={item.id} value={item.id}>{item.displayName || item.name || 'Barber'}</option>)}
          </select>
          {errorFor('barber')}
        </div>
        <div className="grid gap-1"><Label htmlFor={`${id}-date`}>Date</Label><Input className="rounded-[6px]" id={`${id}-date`} type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
        <div className="grid gap-1">
          <Label htmlFor={`${id}-time`}>Time ({props.timeZone})</Label>
          <Input className="rounded-[6px]" id={`${id}-time`} type="time" step={300} value={time} onChange={(event) => setTime(event.target.value)} aria-describedby={described('time')} />
          {errorFor('time')}
          {openTimes ? (
            openTimes.length ? (
              <div role="group" aria-label="Open times" className="flex flex-wrap gap-1 pt-1">
                {openTimes.map((slot) => {
                  const value = shopClock(slot.startsAt);
                  return <Pill key={slot.startsAt} size="sm" variant="flat" aria-pressed={time === value} onClick={() => setTime(value)} className="font-mono">{slot.label}</Pill>;
                })}
              </div>
            ) : <p className="text-xs text-muted-foreground">No open online times this day</p>
          ) : null}
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`${id}-source`}>Booked via</Label>
          <select id={`${id}-source`} value={source} onChange={(event) => setSource(event.target.value as 'phone' | 'staff' | 'walk_in')} className={selectClass}>
            <option value="phone">Phone</option>
            <option value="staff">In person</option>
            <option value="walk_in">Walk-in</option>
          </select>
        </div>
        <div className="grid gap-1 sm:col-span-2"><Label htmlFor={`${id}-notes`}>Internal notes (optional)</Label><Textarea className="rounded-[6px]" id={`${id}-notes`} value={notes} maxLength={2000} onChange={(event) => setNotes(event.target.value)} /></div>
      </div>

      <Track>
        <Pill variant="primary" disabled={pending} onClick={submit}>{pending ? 'Booking…' : props.submitLabel || 'Book appointment'}</Pill>
        {props.onCancel && <Pill disabled={pending} onClick={props.onCancel}>Close</Pill>}
      </Track>
      <div aria-live="polite">
        {result && (
          <div className="space-y-2">
            <Notice tone={result.tone}>{result.message}</Notice>
            {result.link && (
              <p className="break-all text-xs">Customer link, shown once: <a className="font-mono underline" href={result.link} target="_blank" rel="noreferrer">{result.link}</a></p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
