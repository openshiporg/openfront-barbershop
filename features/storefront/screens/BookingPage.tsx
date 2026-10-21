'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { StorefrontImage } from '../components/StorefrontImage';
import { createStorefrontBooking, recoverStorefrontBooking, type StorefrontBookedAppointment } from '../lib/data/appointments';
import { clearResolvedGuestBooking, dispatchSavedGuestBooking, readGuestBookingStorage, saveNewGuestBooking } from '../lib/guest-booking-storage';
import type { GuestBookingCommand } from '../../shared/guest-booking-command';
import { getAvailableTimeSlots, type StorefrontTimeSlot } from '../lib/data/availability';
import type { PublicStorefrontSettings } from '@/features/shared/storefront-settings';
import type { StorefrontBarber, StorefrontService } from '../lib/data/services';
import { shopDateKey, formatShopDateTime } from '../../shared/shop-time';
import { formatDuration, formatMoney } from '../lib/format';
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

function barbersForService(service: StorefrontService | undefined, barbers: StorefrontBarber[]) {
  const specialists = service?.specialists || [];
  return specialists.length ? specialists : barbers;
}

const selectedClass = 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-inverse-ink)]';
const unselectedClass = 'border-[var(--color-rule)] bg-[var(--color-paper)] hover:border-[var(--color-ink-muted)]';

export function BookingPage({ services, barbers, settings, bookingEligibility, accountId = '', catalogError = null }: BookingPageProps) {
  const searchParams = useSearchParams();
  const [selectedServiceId, setSelectedServiceId] = useState(() => {
    const requested = searchParams?.get('service') || '';
    return services.some((service) => service.id === requested) ? requested : services[0]?.id || '';
  });
  const [selectedBarberId, setSelectedBarberId] = useState(() => {
    const requested = searchParams?.get('barber') || '';
    const service = services.find((item) => item.id === (searchParams?.get('service') || '')) || services[0];
    return barbersForService(service, barbers).some((barber) => barber.id === requested) ? requested : 'any';
  });
  const [barberNotice, setBarberNotice] = useState<string | null>(() => {
    const requested = searchParams?.get('barber') || '';
    const service = services.find((item) => item.id === (searchParams?.get('service') || '')) || services[0];
    return requested && !barbersForService(service, barbers).some((barber) => barber.id === requested)
      ? 'The barber in your link isn’t available for this service, so First available is selected.'
      : null;
  });
  const [selectedDate, setSelectedDate] = useState(() => settings?.timezone ? defaultBookingDate(settings.timezone) : '');
  const [selectedStartsAt, setSelectedStartsAt] = useState('');
  const [slots, setSlots] = useState<Record<string, StorefrontTimeSlot[]>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createdAppointment, setCreatedAppointment] = useState<StorefrontBookedAppointment | null>(null);
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', notes: '' });
  const [savedCommand, setSavedCommand] = useState<GuestBookingCommand | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const dispatching = useRef(false);
  const createCommand = useCallback((command: GuestBookingCommand) => createStorefrontBooking(command, accountId), [accountId]);
  const recoverCommand = useCallback((command: GuestBookingCommand, close = false) => recoverStorefrontBooking(command, close, accountId), [accountId]);

  // A definite outcome clears the saved request; an unknown one keeps it for an exact retry.
  const receiveOutcome = useCallback((command: GuestBookingCommand, result: BookingOutcome) => {
    if (result.success) {
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
      })
      .catch(() => {
        if (!cancelled) {
          setSlots({});
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
    if (!selectedService || !selectedSlot || !customer.name.trim() || !customer.phone.trim()) {
      setError('Choose a service and time, and enter your name and phone number.');
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
    <section className="sf-panel p-[var(--space-lg)] mb-6" aria-labelledby="pending-booking-heading">
      <h2 id="pending-booking-heading" className="sf-eyebrow">Earlier booking request</h2>
      <p role="status" className="mt-3">We couldn’t confirm whether your last booking request went through. Check it before booking another time, so you don’t end up with two appointments.</p>
      {error && <p role="alert" className="mt-3">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" disabled={pending} onClick={() => resolveSaved('recover')} className="sf-btn sf-btn-primary">Check again</button>
        <button type="button" disabled={pending} onClick={() => resolveSaved('retry')} className="sf-btn sf-btn-ghost">Send the same request again</button>
        <button type="button" disabled={pending} onClick={() => resolveSaved('close')} className="sf-btn sf-btn-ghost">Cancel it if it wasn’t booked</button>
      </div>
    </section>
  ) : null;

  if (createdAppointment) {
    return (
      <main id="main-content" className="sf-container-narrow py-[var(--space-4xl)]">
          <div className="sf-panel-inverse p-[var(--space-2xl)] md:p-[var(--space-3xl)]" role="status">
            <p className="sf-eyebrow text-[var(--color-accent)]">Request received</p>
            <h1 className="sf-display mt-3 text-[var(--text-display-s)] text-[var(--color-inverse-ink)]">
              Request submitted.
            </h1>
            <p className="mt-[var(--space-lg)] text-[var(--text-lead)] text-[var(--color-inverse-muted)]">
              Your time is held while the shop reviews your request. Check its status for confirmation.
            </p>

            <div className="mt-[var(--space-xl)] border border-[color-mix(in_oklch,var(--color-inverse-ink)_14%,transparent)] p-[var(--space-lg)]">
              <strong className="block text-lg text-[var(--color-inverse-ink)]">{createdAppointment.service?.name}</strong>
              <span className="mt-1 block text-[var(--text-small)] text-[var(--color-inverse-muted)]">
                {createdAppointment.startsAt ? (createdAppointment.bookingTimezone ? formatShopDateTime(createdAppointment.startsAt, createdAppointment.bookingTimezone) : createdAppointment.startsAt) : 'Time to be confirmed'}
                {createdAppointment.barber?.displayName ? ` · ${createdAppointment.barber.displayName}` : ''}
              </span>
            </div>

            <div className="mt-[var(--space-xl)] flex flex-wrap gap-3">
              <Link href={`/appointment?id=${encodeURIComponent(createdAppointment.id)}`} className="sf-btn sf-btn-accent">
                View status
              </Link>
              <Link href="/" className="sf-btn sf-btn-ghost !text-[var(--color-inverse-ink)] !shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--color-inverse-ink)_25%,transparent)]">
                Back to shop
              </Link>
            </div>
            <p className="mt-[var(--space-lg)] text-[var(--text-small)] text-[var(--color-inverse-muted)]">
              {accountId ? 'This booking is saved to your account.' : 'Open the status page from this browser, or create an account next time to see bookings on any device.'}
            </p>
          </div>
      </main>
    );
  }

  if (!settings) return <main id="main-content" className="sf-container-narrow py-[var(--space-2xl)]">{pendingPanel}<p role="alert">Online booking is unavailable right now. Try again later or contact the shop.</p></main>;

  return (
    <main id="main-content">
        <section className="border-b border-[var(--color-rule)]">
          <div className="sf-container py-[var(--space-3xl)]">
            <p className="sf-eyebrow">Appointments</p>
            <h1 className="sf-display mt-3 text-[var(--text-display-s)]">Book a visit.</h1>
            <p className="sf-lead mt-[var(--space-lg)]">
              Times shown in {settings.timezone}. The shop confirms each request.
            </p>
          </div>
        </section>

        <div className="sf-container py-[var(--space-2xl)]">
          {pendingPanel}
          {notice && <p role="status" className="mb-6">{notice}</p>}
          {!bookingEligibility.success && <p role="alert" className="mb-6 text-[var(--text-small)] text-[var(--color-ink-muted)]">{bookingEligibility.error || 'Online booking is unavailable right now. Contact the shop.'}</p>}
          {catalogError ? (
            <div role="alert" className="border border-dashed border-[var(--color-rule-strong)] p-[var(--space-2xl)]">
              <h2 className="sf-display text-[var(--text-title)]">Booking couldn’t load</h2>
              <p className="mt-2 text-[var(--color-ink-muted)]">{catalogError}</p>
            </div>
          ) : !services.length || !barbers.length ? (
            <div className="border border-dashed border-[var(--color-rule-strong)] p-[var(--space-2xl)]">
              <h2 className="sf-display text-[var(--text-title)]">Online booking isn’t open yet</h2>
              <p className="mt-2 text-[var(--color-ink-muted)]">
                Call or visit the shop to book.
              </p>
              <Link href="/services" className="sf-btn sf-btn-primary mt-6">
                Browse menu
              </Link>
            </div>
          ) : (
            <form onSubmit={submitBooking} className="grid gap-[var(--space-2xl)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div className="space-y-[var(--space-xl)]">
                <fieldset className="sf-panel p-[var(--space-lg)]">
                  <legend className="sf-eyebrow px-1">Service</legend>
                  <div className="mt-[var(--space-md)] space-y-2">
                    {services.map((service) => (
                      <button
                        type="button"
                        key={service.id}
                        aria-pressed={selectedServiceId === service.id}
                        onClick={() => chooseService(service)}
                        className={`w-full rounded-[var(--radius-sm)] border p-[var(--space-md)] text-left transition-colors ${selectedServiceId === service.id ? selectedClass : unselectedClass}`}
                      >
                        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3">
                          <StorefrontImage
                            src={service.imagePath?.endsWith('.svg') ? '/images/barbershop/photo/scissor-cut.webp' : service.imagePath}
                            fallbackSrc="/images/barbershop/photo/scissor-cut.webp"
                            alt=""
                            className="aspect-[4/3] border border-current/20"
                            sizes="88px"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap justify-between gap-x-3">
                              <strong className="break-words">{service.name}</strong>
                              <span className="tabular-nums">{formatMoney(service.price)}</span>
                            </div>
                            <div className="mt-1 text-[var(--text-small)] opacity-80">
                              {formatDuration(service.durationMinutes)}
                              {service.depositRequired && ` · Deposit ${formatMoney(service.depositAmount || 0)}`}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="sf-panel p-[var(--space-lg)]">
                  <legend className="sf-eyebrow px-1">Barber</legend>
                  {barberNotice && <p role="status" className="mt-3 text-[var(--text-small)]">{barberNotice}</p>}
                  <div className="mt-[var(--space-md)] space-y-2">
                    <button
                      type="button"
                      aria-pressed={selectedBarberId === 'any'}
                      onClick={() => {
                        setSelectedBarberId('any');
                        setSelectedStartsAt('');
                        setBarberNotice(null);
                      }}
                      className={`w-full rounded-[var(--radius-sm)] border p-[var(--space-md)] text-left transition-colors ${selectedBarberId === 'any' ? selectedClass : unselectedClass}`}
                    >
                      <strong>First available</strong>
                      <div className="mt-1 text-[var(--text-small)] opacity-80">Any barber who offers this service and is free at your time</div>
                    </button>
                    {serviceBarbers.map((barber) => (
                      <button
                        type="button"
                        key={barber.id}
                        aria-pressed={selectedBarberId === barber.id}
                        onClick={() => {
                          setSelectedBarberId(barber.id);
                          setSelectedStartsAt('');
                          setBarberNotice(null);
                        }}
                        className={`w-full rounded-[var(--radius-sm)] border p-[var(--space-md)] text-left transition-colors ${selectedBarberId === barber.id ? selectedClass : unselectedClass}`}
                      >
                        <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3">
                          <StorefrontImage
                            src={barber.imagePath?.endsWith('.svg') ? '/images/barbershop/photo/barber-at-work.webp' : barber.imagePath}
                            fallbackSrc="/images/barbershop/photo/barber-at-work.webp"
                            alt=""
                            className="aspect-square border border-current/20"
                            sizes="72px"
                          />
                          <div className="min-w-0">
                            <strong className="break-words">{barber.displayName}</strong>
                            <div className="mt-1 text-[var(--text-small)] opacity-80">
                              {barber.chairNumber ? `Chair ${barber.chairNumber}` : 'Open chair'}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>

              <div className="space-y-[var(--space-xl)]">
                <fieldset className="sf-panel-inverse p-[var(--space-lg)]">
                  <legend className="sf-eyebrow px-1 text-[var(--color-accent)]">Date & time</legend>
                  <label htmlFor="booking-date" className="mt-[var(--space-md)] block text-[var(--text-small)] text-[var(--color-inverse-muted)]">Date</label>
                  <input
                    id="booking-date"
                    name="date"
                    type="date"
                    value={selectedDate}
                    onChange={(event) => {
                      setSelectedDate(event.target.value);
                      setSelectedStartsAt('');
                    }}
                    className="sf-input mt-2 !border-[color-mix(in_oklch,var(--color-inverse-ink)_20%,transparent)] !bg-[color-mix(in_oklch,var(--color-inverse-ink)_6%,transparent)] !text-[var(--color-inverse-ink)] [color-scheme:dark]"
                  />
                  <p className="mt-3 text-[var(--text-small)] text-[var(--color-inverse-muted)]">
                    Times are checked again when you book.
                  </p>
                  {!loadingSlots && availabilityError && <p role="status" className="mt-3 text-[var(--text-small)] text-[var(--color-inverse-muted)]">{availabilityError}</p>}
                  <div role="group" aria-label="Available times" aria-busy={loadingSlots} className="mt-[var(--space-md)] grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
                    {loadingSlots && (
                      <p role="status" className="col-span-full text-[var(--text-small)] text-[var(--color-inverse-muted)]">Checking times…</p>
                    )}
                    {!loadingSlots &&
                      mergedSlots.map((slot) => (
                        <button
                          type="button"
                          key={slot.startsAt}
                          aria-pressed={selectedStartsAt === slot.startsAt}
                          onClick={() => setSelectedStartsAt(slot.startsAt)}
                          className={`sf-slot ${selectedStartsAt === slot.startsAt ? 'is-selected !bg-[var(--color-accent)] !border-[var(--color-accent)] !text-[var(--color-ink)]' : '!border-[color-mix(in_oklch,var(--color-inverse-ink)_18%,transparent)] !bg-[color-mix(in_oklch,var(--color-inverse-ink)_6%,transparent)] !text-[var(--color-inverse-ink)]'}`}
                        >
                          {slot.label}
                        </button>
                      ))}
                    {!loadingSlots && !availabilityError && !mergedSlots.length && (
                      <p className="col-span-full text-[var(--text-small)] text-[var(--color-inverse-muted)]">
                        No times on this date. Try another day or barber.
                      </p>
                    )}
                  </div>
                </fieldset>

                <div className="grid gap-[var(--space-xl)] xl:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)]">
                  <fieldset className="sf-panel p-[var(--space-lg)]">
                    <legend className="sf-eyebrow px-1">Your details</legend>
                    <div className="mt-[var(--space-md)] grid gap-3">
                      <label className="block text-[var(--text-small)] font-semibold">Full name
                        <input name="name" autoComplete="name" maxLength={120} value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="sf-input mt-1" required />
                      </label>
                      <label className="block text-[var(--text-small)] font-semibold">Phone
                        <input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} className="sf-input mt-1" required />
                      </label>
                      <label className="block text-[var(--text-small)] font-semibold">Email (optional)
                        <input name="email" type="email" autoComplete="email" maxLength={254} value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} className="sf-input mt-1" />
                      </label>
                      <label className="block text-[var(--text-small)] font-semibold">Notes for the barber (optional)
                        <textarea name="notes" maxLength={2000} value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} className="sf-textarea mt-1" />
                      </label>
                    </div>
                    {error && !savedCommand && (
                      <p role="alert" className="mt-4 rounded-[var(--radius-sm)] bg-[var(--color-error-soft)] p-3 text-[var(--text-small)] font-medium text-[var(--color-error)] break-words">
                        {error}
                      </p>
                    )}
                    <button type="submit" disabled={pending || !storageReady || !!savedCommand || !bookingEligibility.success || !bookingEligibility.data} className="sf-btn sf-btn-primary mt-5 w-full">
                      {pending ? 'Booking…' : 'Request appointment'}
                    </button>
                  </fieldset>

                  <aside className="sf-panel h-fit overflow-hidden" aria-label="Visit summary">
                    <StorefrontImage
                      src={(selectedBarber?.imagePath || selectedService?.imagePath)?.endsWith('.svg') ? '/images/barbershop/photo/chair-service.webp' : selectedBarber?.imagePath || selectedService?.imagePath}
                      fallbackSrc="/images/barbershop/photo/chair-service.webp"
                      alt=""
                      className="aspect-[4/3] border-b border-[var(--color-rule)]"
                      priority
                      sizes="(max-width: 1280px) 100vw, 28vw"
                    />
                    <div className="p-[var(--space-lg)]">
                    <p className="sf-eyebrow">Visit summary</p>
                    <dl className="mt-[var(--space-md)] space-y-4 text-[var(--text-small)]">
                      <div>
                        <dt className="font-semibold text-[var(--color-ink-muted)]">Service</dt>
                        <dd className="mt-1 font-medium">{selectedService?.name || '—'}</dd>
                        {selectedService && (
                          <dd className="text-[var(--color-ink-muted)]">
                            {formatDuration(selectedService.durationMinutes)} · {formatMoney(selectedService.price)}
                          </dd>
                        )}
                      </div>
                      <div>
                        <dt className="font-semibold text-[var(--color-ink-muted)]">Barber</dt>
                        <dd className="mt-1 font-medium">{selectedBarber?.displayName || 'First available'}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-[var(--color-ink-muted)]">When</dt>
                        <dd className="mt-1 font-medium">{selectedSlot ? formatShopDateTime(selectedSlot.startsAt, settings.timezone) : 'Choose a time'}</dd>
                      </div>
                      <div className="border-t border-[var(--color-rule)] pt-4">
                        {selectedService?.depositRequired
                          ? `Deposit expected: ${formatMoney(selectedService.depositAmount || 0)}`
                          : 'Pay in the shop after your visit.'}
                      </div>
                    </dl>
                    </div>
                  </aside>
                </div>
              </div>
            </form>
          )}
        </div>

        {settings.phone ? (
          <section className="border-t border-[var(--color-rule)] bg-[var(--color-paper-2)]">
            <div className="sf-container-narrow py-[var(--space-lg)] text-center text-[var(--text-small)] text-[var(--color-ink-muted)]">
              Questions? Call {settings.phone}.
            </div>
          </section>
        ) : null}
    </main>
  );
}
