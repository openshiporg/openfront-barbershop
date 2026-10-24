'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createStorefrontBooking, recoverStorefrontBooking, type StorefrontBookedAppointment } from '../lib/data/appointments';
import { clearResolvedGuestBooking, dispatchSavedGuestBooking, readGuestBookingStorage, saveNewGuestBooking } from '../lib/guest-booking-storage';
import type { GuestBookingCommand } from '../../shared/guest-booking-command';
import { getAvailableTimeSlots, type StorefrontTimeSlot } from '../lib/data/availability';
import type { PublicStorefrontSettings } from '@/features/shared/storefront-settings';
import type { StorefrontBarber, StorefrontService } from '../lib/data/services';
import { shopDateKey, formatShopDateTime } from '../../shared/shop-time';
import { formatDuration, formatMoney } from '../lib/format';
import { PayDepositButton } from '../components/PayDepositButton';
import type { PublicBookingEligibility } from '../../shared/public-booking-eligibility';

function actorStorage(accountId: string) {
  const key = (name: string) => (accountId ? `${name}:account:${accountId}` : name);
  return {
    getItem: (name: string) => window.sessionStorage.getItem(key(name)),
    setItem: (name: string, value: string) => window.sessionStorage.setItem(key(name), value),
    removeItem: (name: string) => window.sessionStorage.removeItem(key(name)),
  };
}

type BookingPageProps = {
  accountId?: string;
  /** Signed-in customer's saved details, used to fill step 04. */
  accountProfile?: { name: string; email: string; phone: string } | null;
  /** The shop takes deposits online (Stripe); otherwise deposit services are booked by phone. */
  onlineDeposits?: boolean;
  services: StorefrontService[];
  barbers: StorefrontBarber[];
  settings: PublicStorefrontSettings | null;
  bookingEligibility: { success: boolean; error?: string | null; data?: PublicBookingEligibility | null };
  catalogError?: string | null;
};

type BookingOutcome = Awaited<ReturnType<typeof createStorefrontBooking>>;

function defaultBookingDate(timeZone: string) {
  try { new Intl.DateTimeFormat('en', { timeZone }).format(); } catch { return ''; }
  const tomorrow = new Date(`${shopDateKey(new Date(), timeZone)}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}


// Online bookings open up to 90 days ahead (enforced again on the server).
const BOOKING_HORIZON_DAYS = 90;

function bookingDateBounds(timeZone: string) {
  try {
    const today = shopDateKey(new Date(), timeZone);
    const last = new Date(`${today}T12:00:00Z`);
    last.setUTCDate(last.getUTCDate() + BOOKING_HORIZON_DAYS);
    return { min: today, max: last.toISOString().slice(0, 10) };
  } catch { return { min: undefined, max: undefined }; }
}

// The account stores no phone, so this browser remembers the last one used.
const phoneKey = (accountId: string) => `sf-booking-phone:${accountId}`;
function rememberedPhone(accountId: string) {
  if (!accountId) return '';
  try { return window.localStorage.getItem(phoneKey(accountId)) || ''; } catch { return ''; }
}

function barbersForService(service: StorefrontService | undefined, barbers: StorefrontBarber[]) {
  const specialists = service?.specialists || [];
  return specialists.length ? specialists : barbers;
}

export function BookingPage({ services, barbers, settings, bookingEligibility, accountId = '', accountProfile = null, onlineDeposits = false, catalogError = null }: BookingPageProps) {
  const searchParams = useSearchParams();
  const bookableOnline = (service: StorefrontService | undefined) => Boolean(service && (!service.depositRequired || onlineDeposits));
  const firstBookable = services.find(bookableOnline);
  const [selectedServiceId, setSelectedServiceId] = useState(() => {
    const requested = searchParams?.get('service') || '';
    return services.some((service) => service.id === requested && bookableOnline(service)) ? requested : firstBookable?.id || '';
  });
  const [selectedBarberId, setSelectedBarberId] = useState(() => {
    const requested = searchParams?.get('barber') || '';
    const service = services.find((item) => item.id === (searchParams?.get('service') || '') && bookableOnline(item)) || firstBookable;
    return barbersForService(service, barbers).some((barber) => barber.id === requested) ? requested : 'any';
  });
  const [barberNotice, setBarberNotice] = useState<string | null>(() => {
    const requested = searchParams?.get('barber') || '';
    const requestedService = services.find((item) => item.id === (searchParams?.get('service') || ''));
    if (requestedService && !bookableOnline(requestedService)) return `${requestedService.name} takes a deposit, so it’s booked by phone${settings?.phone ? ` at ${settings.phone}` : ''}.`;
    const service = requestedService || firstBookable;
    return requested && !barbersForService(service, barbers).some((barber) => barber.id === requested)
      ? 'The barber in your link isn’t available for this service, so First available is selected.'
      : null;
  });
  const [selectedDate, setSelectedDate] = useState(() => settings?.timezone ? defaultBookingDate(settings.timezone) : '');
  const [selectedStartsAt, setSelectedStartsAt] = useState('');
  const [slots, setSlots] = useState<Record<string, StorefrontTimeSlot[]>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [credentialBlocked, setCredentialBlocked] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createdAppointment, setCreatedAppointment] = useState<StorefrontBookedAppointment | null>(null);
  const [customer, setCustomer] = useState({ name: accountProfile?.name || '', email: accountProfile?.email || '', phone: accountProfile?.phone || '', notes: '' });
  const [savedCommand, setSavedCommand] = useState<GuestBookingCommand | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const dispatching = useRef(false);
  const createCommand = useCallback((command: GuestBookingCommand) => createStorefrontBooking(command, accountId), [accountId]);
  const recoverCommand = useCallback((command: GuestBookingCommand, close = false) => recoverStorefrontBooking(command, close, accountId), [accountId]);

  // A definite outcome clears the saved request; an unknown one keeps it for an exact retry.
  const receiveOutcome = useCallback((command: GuestBookingCommand, result: BookingOutcome) => {
    if (result.success) {
      if (accountId) {
        try {
          const phone = (JSON.parse(command.requestBody) as { customerPhone?: string }).customerPhone;
          if (phone) window.localStorage.setItem(phoneKey(accountId), phone);
        } catch { /* storage unavailable */ }
      }
      clearResolvedGuestBooking(actorStorage(accountId), command);
      setSavedCommand(null);
      setCreatedAppointment(result.appointment);
      setError(null);
      return;
    }
    if (result.disposition === 'closed' || result.disposition === 'rejected') {
      clearResolvedGuestBooking(actorStorage(accountId), command);
      setSavedCommand(null);
      setSelectedStartsAt('');
      setNotice(result.disposition === 'closed' ? 'Your earlier request was not booked. You can choose a time now.' : null);
      setError(result.disposition === 'rejected' ? result.error : null);
      return;
    }
    setSavedCommand(command);
    setError(result.error);
  }, [accountId]);

  useEffect(() => {
    const phone = rememberedPhone(accountId);
    if (phone) Promise.resolve().then(() => setCustomer((current) => current.phone ? current : { ...current, phone }));
  }, [accountId]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(async () => {
      try {
        const command = readGuestBookingStorage(actorStorage(accountId)).current;
        if (cancelled) return;
        setSavedCommand(command);
        setStorageReady(true);
        if (command) {
          dispatching.current = true;
          const result = await dispatchSavedGuestBooking(actorStorage(accountId), command, (saved) => recoverCommand(saved));
          if (!cancelled) receiveOutcome(command, result);
        }
      } catch {
        if (!cancelled) {
          setStorageReady(false);
          setError('This browser is blocking the storage needed to book safely. Allow site data for this page, or call the shop to book.');
        }
      } finally { dispatching.current = false; }
    });
    return () => { cancelled = true; };
  }, [receiveOutcome, recoverCommand, accountId]);

  const resolveSaved = (mode: 'recover' | 'retry' | 'close') => {
    if (!savedCommand || dispatching.current) return;
    const command = savedCommand;
    dispatching.current = true;
    startTransition(async () => {
      try {
        const result = await dispatchSavedGuestBooking(actorStorage(accountId), command, (saved) => mode === 'retry' ? createCommand(saved) : recoverCommand(saved, mode === 'close'));
        receiveOutcome(command, result);
      } catch { setError('Your earlier request couldn’t be checked. Reload the page and try again.'); }
      finally { dispatching.current = false; }
    });
  };

  const selectedService = services.find((service) => service.id === selectedServiceId);
  const serviceBarbers = useMemo(() => barbersForService(selectedService, barbers), [barbers, selectedService]);

  const chooseService = (service: StorefrontService) => {
    setSelectedServiceId(service.id);
    setSelectedStartsAt('');
    // A barber who doesn't offer the new service can't stay selected.
    if (selectedBarberId !== 'any' && !barbersForService(service, barbers).some((barber) => barber.id === selectedBarberId)) {
      const previous = serviceBarbers.find((barber) => barber.id === selectedBarberId);
      setSelectedBarberId('any');
      setBarberNotice(`${previous?.displayName || 'That barber'} doesn’t offer ${service.name}, so First available is selected.`);
    } else {
      setBarberNotice(null);
    }
  };

  const barberIdsToCheck = useMemo(
    () => (selectedBarberId === 'any' ? serviceBarbers.map((barber) => barber.id) : [selectedBarberId]),
    [selectedBarberId, serviceBarbers],
  );

  useEffect(() => {
    if (!settings || !selectedService || !barberIdsToCheck.length || !selectedDate || savedCommand) return;

    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setLoadingSlots(true);
        setAvailabilityError(null);
      }
    });
    Promise.all(
      barberIdsToCheck.map(async (barberId) => {
        const availability = await getAvailableTimeSlots(barberId, selectedDate, selectedService.durationMinutes, selectedService.id);
        return [barberId, availability] as const;
      }),
    )
      .then((entries) => {
        if (cancelled) return;
        setAvailabilityError(entries.some(([, availability]) => availability.error)
          ? 'Some times couldn’t be loaded, so this list may be incomplete. Try again or call the shop.'
          : null);
        setSlots(Object.fromEntries(entries.map(([barberId, availability]) => [barberId, availability.slots])));
        setCredentialBlocked(entries.every(([, availability]) => availability.credentialBlocked));
      })
      .catch(() => {
        if (!cancelled) {
          setSlots({});
          setCredentialBlocked(false);
          setAvailabilityError('Available times couldn’t be loaded. Try again or call the shop.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [barberIdsToCheck, selectedDate, selectedService, settings, savedCommand]);

  // Exact start instants identify slots; labels are only for display.
  const mergedSlots = useMemo(() => {
    const byInstant = new Map<string, StorefrontTimeSlot>();
    for (const barberId of barberIdsToCheck) for (const slot of slots[barberId] || []) byInstant.set(slot.startsAt, slot);
    return [...byInstant.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [slots, barberIdsToCheck]);
  const selectedSlot = mergedSlots.find((slot) => slot.startsAt === selectedStartsAt) || null;
  const selectedBarber = selectedBarberId === 'any' ? null : serviceBarbers.find((barber) => barber.id === selectedBarberId);

  const submitBooking = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!settings || !storageReady || savedCommand || dispatching.current) {
      setError('Check your earlier booking request before making a new one.');
      return;
    }
    if (!bookingEligibility.success || !bookingEligibility.data) {
      setError(bookingEligibility.error || 'Online booking is unavailable right now. Contact the shop.');
      return;
    }
    if (!selectedService || !bookableOnline(selectedService) || !selectedSlot || !customer.name.trim() || !customer.phone.trim() || !customer.email.trim()) {
      setError('Choose a service and time, and enter your name, phone and email.');
      return;
    }

    dispatching.current = true;
    startTransition(async () => {
      let command: GuestBookingCommand | null = null;
      try {
        command = saveNewGuestBooking(actorStorage(accountId), window.crypto, {
          shopId: settings.id, serviceId: selectedService.id,
          // "First available" is resolved on the server against every eligible barber.
          barberId: selectedBarberId === 'any' ? null : selectedBarberId,
          startsAt: selectedSlot.startsAt,
          customerName: customer.name, customerEmail: customer.email,
          customerPhone: customer.phone, notes: customer.notes,
          // What the customer reviewed; the booking is refused if any of these changed.
          reviewedPrice: selectedService.price,
          reviewedDurationMinutes: selectedService.durationMinutes,
          reviewedPolicyVersion: `${bookingEligibility.data!.policyId}:${bookingEligibility.data!.version}`,
        });
        setSavedCommand(command);
        const result = await dispatchSavedGuestBooking(actorStorage(accountId), command, createCommand);
        receiveOutcome(command, result);
      } catch {
        if (!command) setStorageReady(false);
        setError(command
          ? 'We couldn’t confirm whether your booking request went through. Check again before booking another time.'
          : 'Your booking request couldn’t be prepared in this browser. Allow site data for this page, or call the shop to book.');
      }
      finally { dispatching.current = false; }
    });
  };

  const pendingPanel = savedCommand ? (
    <section className="sf-card-dark sf-on-dark mb-8" aria-labelledby="pending-booking-heading">
      <h2 id="pending-booking-heading" className="sf-eyebrow"><span className="sf-dot is-wait" aria-hidden="true" />Earlier request unconfirmed</h2>
      <p role="status">Your last booking request may have gone through. Check it before booking another time.</p>
      {error && <p role="alert" className="sf-notice">{error}</p>}
      <div className="sf-track">
        <button type="button" disabled={pending} onClick={() => resolveSaved('recover')} className="sf-pill is-primary">Check again</button>
        <button type="button" disabled={pending} onClick={() => resolveSaved('retry')} className="sf-pill">Send same request</button>
        <button type="button" disabled={pending} onClick={() => resolveSaved('close')} className="sf-pill">Cancel if not booked</button>
      </div>
    </section>
  ) : null;

  if (createdAppointment) {
    return (
      <main id="main-content" className="sf-container-narrow py-[var(--space-2xl)]">
        <p className="sf-eyebrow mb-3"><span className="sf-dot is-wait" aria-hidden="true" />Requested</p>
        <h1 className="sf-display mb-8 text-[var(--text-display-s)]">Chair held</h1>
        <section className="sf-ticket" role="status" aria-label="Booking request">
          <div className="sf-ticket-head">
            <div className="grid gap-2">
              <p className="sf-eyebrow text-[var(--color-inverse-muted)]">Awaiting shop confirmation</p>
              <p className="sf-subtitle text-[2rem]">{createdAppointment.service?.name}</p>
            </div>
          </div>
          <dl>
            <div><dt>When</dt><dd className="sf-mono">{createdAppointment.startsAt ? (createdAppointment.bookingTimezone ? formatShopDateTime(createdAppointment.startsAt, createdAppointment.bookingTimezone) : createdAppointment.startsAt) : 'To be confirmed'}</dd></div>
            <div><dt>Barber</dt><dd>{createdAppointment.barber?.displayName || 'First available'}</dd></div>
            <div><dt>Saved to</dt><dd>{accountId ? 'Your account' : 'This browser'}</dd></div>
            {customer.email.trim() ? <div><dt>Confirmation by email</dt><dd className="break-all">{customer.email.trim()}</dd></div> : null}
          </dl>
          {createdAppointment.paymentStatus === 'deposit_due' && onlineDeposits ? <PayDepositButton appointmentId={createdAppointment.id} label={`Pay ${formatMoney(createdAppointment.depositAmount || 0)} deposit to hold it`} /> : null}
          <div className="sf-track">
            {createdAppointment.paymentStatus === 'deposit_due' && onlineDeposits ? null : <Link href={`/appointment?id=${encodeURIComponent(createdAppointment.id)}`} className="sf-pill is-primary">View status</Link>}
            <Link href="/" className="sf-pill">Back to shop</Link>
          </div>
        </section>
      </main>
    );
  }

  if (!settings) return <main id="main-content" className="sf-container-narrow py-[var(--space-2xl)]">{pendingPanel}<p role="alert" className="sf-notice is-error">Online booking is unavailable right now. Try again later or contact the shop.</p></main>;

  const canSubmit = !pending && storageReady && !savedCommand && bookingEligibility.success && Boolean(bookingEligibility.data) && Boolean(selectedSlot);

  return (
    <main id="main-content">
      <section className="sf-container sf-page-head">
        <p className="sf-eyebrow">Times in {settings.timezone}</p>
        <h1 className="sf-display">Book a chair</h1>
      </section>

      <div className="sf-container pt-[var(--space-xl)]">
        {pendingPanel}
        {notice && <p role="status" className="sf-notice mb-6">{notice}</p>}
        {!bookingEligibility.success && <p role="alert" className="sf-notice is-error mb-6">{bookingEligibility.error || 'Online booking is unavailable right now. Contact the shop.'}</p>}
      </div>

      {catalogError ? (
        <div className="sf-container sf-empty mb-[var(--space-3xl)]" role="alert">
          <p className="sf-subtitle">Booking couldn’t load</p>
          <p className="sf-muted">{catalogError}</p>
        </div>
      ) : !firstBookable || !barbers.length ? (
        <div className="sf-container sf-empty mb-[var(--space-3xl)]">
          <p className="sf-subtitle">Online booking isn’t open yet</p>
          <div className="sf-track">
            <Link href="/queue" className="sf-pill is-primary">Join walk-ins</Link>
            <Link href="/services" className="sf-pill">Services</Link>
          </div>
        </div>
      ) : (
        <form onSubmit={submitBooking} className="sf-container sf-book">
          <div className="sf-book-main">
            <fieldset className="sf-step">
              <legend><span className="sf-step-no">01</span><span className="sf-step-title">Service</span></legend>
              <div className="sf-options">
                {services.map((service) => (
                  <button type="button" key={service.id} aria-pressed={selectedServiceId === service.id} disabled={!bookableOnline(service)} onClick={() => chooseService(service)} className="sf-option">
                    <span className="sf-option-title">{service.name}</span>
                    <span className="sf-mono">{formatMoney(service.price)}</span>
                    <span className="sf-option-meta"><span className="sf-mono">{formatDuration(service.durationMinutes)}</span>{service.depositRequired && ` · Deposit ${formatMoney(service.depositAmount || 0)}${onlineDeposits ? ' paid online' : ' · Call to book'}`}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="sf-step">
              <legend><span className="sf-step-no">02</span><span className="sf-step-title">Barber</span></legend>
              {barberNotice && <p role="status" className="sf-notice">{barberNotice}</p>}
              <div className="sf-options">
                <button
                  type="button"
                  aria-pressed={selectedBarberId === 'any'}
                  onClick={() => { setSelectedBarberId('any'); setSelectedStartsAt(''); setBarberNotice(null); }}
                  className="sf-option"
                >
                  <span className="sf-option-title">First available</span>
                  <span className="sf-option-meta">{serviceBarbers.length} {serviceBarbers.length === 1 ? 'barber' : 'barbers'} for this service</span>
                </button>
                {serviceBarbers.map((barber) => (
                  <button
                    type="button"
                    key={barber.id}
                    aria-pressed={selectedBarberId === barber.id}
                    onClick={() => { setSelectedBarberId(barber.id); setSelectedStartsAt(''); setBarberNotice(null); }}
                    className="sf-option"
                  >
                    <span className="sf-option-title">{barber.displayName}</span>
                    {barber.chairNumber ? <span className="sf-mono sf-small sf-muted">Chair {barber.chairNumber}</span> : <span />}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="sf-step">
              <legend><span className="sf-step-no">03</span><span className="sf-step-title">Time</span></legend>
              <label htmlFor="booking-date" className="sf-field max-w-xs">
                <span>Date</span>
                <input
                  id="booking-date"
                  name="date"
                  type="date"
                  {...bookingDateBounds(settings.timezone)}
                  value={selectedDate}
                  onChange={(event) => { setSelectedDate(event.target.value); setSelectedStartsAt(''); }}
                  className="sf-input sf-mono"
                />
              </label>
              {!loadingSlots && availabilityError && <p role="status" className="sf-notice">{availabilityError}</p>}
              <div role="group" aria-label="Available times" aria-busy={loadingSlots} className="sf-slots">
                {loadingSlots && <p role="status">Checking times…</p>}
                {!loadingSlots && mergedSlots.map((slot) => (
                  <button type="button" key={slot.startsAt} aria-pressed={selectedStartsAt === slot.startsAt} onClick={() => setSelectedStartsAt(slot.startsAt)} className="sf-slot">
                    {slot.label}
                  </button>
                ))}
                {!loadingSlots && !availabilityError && !mergedSlots.length && (credentialBlocked
                  ? <p>No barber is cleared to book {selectedService?.name || 'this service'} online. Call the shop{settings.phone ? <> at <span className="sf-mono">{settings.phone}</span></> : null}.</p>
                  : <p>No times on this date.</p>)}
              </div>
            </fieldset>

            <fieldset className="sf-step">
              <legend><span className="sf-step-no">04</span><span className="sf-step-title">Your details</span></legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sf-field"><span>Full name</span>
                  <input name="name" autoComplete="name" maxLength={120} value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="sf-input" required />
                </label>
                <label className="sf-field"><span>Phone</span>
                  <input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} className="sf-input" required />
                </label>
                <label className="sf-field sm:col-span-2"><span>Email</span>
                  <input name="email" type="email" autoComplete="email" maxLength={254} required value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} className="sf-input" />
                </label>
                <label className="sf-field sm:col-span-2"><span>Notes for the barber (optional)</span>
                  <textarea name="notes" maxLength={2000} value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} className="sf-textarea" />
                </label>
              </div>
            </fieldset>
          </div>

          <aside className="sf-summary sf-on-dark" aria-label="Visit summary">
            <p className="sf-eyebrow">Visit</p>
            <dl>
              <div><dt>Service</dt><dd>{selectedService?.name || '—'}{selectedService ? <span className="sf-mono block text-[var(--color-inverse-muted)]">{formatDuration(selectedService.durationMinutes)}</span> : null}</dd></div>
              <div><dt>Barber</dt><dd>{selectedBarber?.displayName || 'First available'}</dd></div>
              <div><dt>When</dt><dd className="sf-mono">{selectedSlot ? formatShopDateTime(selectedSlot.startsAt, settings.timezone) : '—'}</dd></div>
              <div><dt>Pay</dt><dd>{selectedService?.depositRequired ? `Deposit ${formatMoney(selectedService.depositAmount || 0)}` : 'In the shop'}</dd></div>
            </dl>
            <div className="sf-summary-total"><span className="sf-eyebrow">Total</span><strong>{formatMoney(selectedService?.price)}</strong></div>
            {error && !savedCommand && <p role="alert" className="sf-notice is-error">{error}</p>}
            {!selectedSlot && !savedCommand ? <p className="sf-small text-[var(--color-inverse-muted)]">Choose a time</p> : null}
            <div className="sf-track is-block">
              <button type="submit" disabled={!canSubmit} className="sf-pill is-accent">{pending ? 'Booking…' : 'Request appointment'}</button>
            </div>
            {settings.phone ? <p className="sf-small sf-muted">Questions: <span className="sf-mono">{settings.phone}</span></p> : null}
          </aside>
        </form>
      )}
    </main>
  );
}
