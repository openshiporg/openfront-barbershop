'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, Scissors, User } from 'lucide-react';
import type { StorefrontBarber, StorefrontService } from '../lib/data/services';
import { formatDuration, formatMoney } from '../lib/format';
import { bookHref, shopDays, useSlots } from '../lib/use-slots';
import { barberPhoto } from './BarberCard';
import { StorefrontImage } from './StorefrontImage';

type QuickBookProps = {
  services: StorefrontService[];
  barbers: StorefrontBarber[];
  timeZone: string;
  onlineDeposits: boolean;
  /** Phone home lays the three steps out as sections instead of a card. */
  layout?: 'card' | 'sections';
};

/** Service → barber → time on the home page; "Book appointment" opens /book with every choice carried over. */
export function QuickBook({ services, barbers, timeZone, onlineDeposits, layout = 'card' }: QuickBookProps) {
  const bookable = useMemo(() => services.filter((service) => !service.depositRequired || onlineDeposits), [services, onlineDeposits]);
  const days = useMemo(() => shopDays(timeZone, 14), [timeZone]);
  const [serviceId, setServiceId] = useState(bookable[0]?.id || '');
  const [barberId, setBarberId] = useState<string>('any');
  const [dayIndex, setDayIndex] = useState(0);
  const [startsAt, setStartsAt] = useState('');
  const [touchedDay, setTouchedDay] = useState(false);

  const service = bookable.find((item) => item.id === serviceId);
  const serviceBarbers = service?.specialists?.length ? barbers.filter((barber) => service.specialists!.some((item) => item.id === barber.id)) : barbers;
  const day = days[dayIndex];
  const barberIds = barberId === 'any' ? serviceBarbers.map((barber) => barber.id) : [barberId];
  const { loading, slots, error } = useSlots({ serviceId: service?.id, durationMinutes: service?.durationMinutes, barberIds, date: day?.key || '' });
  const chosen = slots.find((slot) => slot.startsAt === startsAt);

  // Until the visitor picks a day, skip closed or full days so the first open times show.
  useEffect(() => {
    if (!touchedDay && !loading && !error && !slots.length && dayIndex < Math.min(6, days.length - 1)) setDayIndex((index) => index + 1);
  }, [touchedDay, loading, error, slots.length, dayIndex, days.length]);

  if (!bookable.length || !barbers.length || !day) return null;

  const chooseService = (id: string) => {
    setServiceId(id);
    setStartsAt('');
    const next = bookable.find((item) => item.id === id);
    if (barberId !== 'any' && next?.specialists?.length && !next.specialists.some((item) => item.id === barberId)) setBarberId('any');
  };

  return (
    <section className={`sf-quick ${layout === 'sections' ? 'is-sections' : ''}`} aria-label="Book a haircut">
      <fieldset className="sf-quick-step">
        <legend><span className="sf-quick-ico" aria-hidden="true"><Scissors /></span>Service{bookable.length > 3 ? <Link href="/services" className="sf-quick-more">All {bookable.length} services</Link> : null}</legend>
        <div className="sf-quick-services">
          {bookable.slice(0, 3).map((item) => (
            <button key={item.id} type="button" className="sf-quick-service" aria-pressed={item.id === serviceId} onClick={() => chooseService(item.id)}>
              <span className="sf-quick-check" aria-hidden="true">{item.id === serviceId ? <Check /> : null}</span>
              <span className="sf-quick-service-name">{item.name}</span>
              <span className="sf-quick-service-meta">{formatMoney(item.price)} · {formatDuration(item.durationMinutes)}</span>
              <ChevronRight aria-hidden="true" className="sf-quick-chev" />
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="sf-quick-step">
        <legend><span className="sf-quick-ico" aria-hidden="true"><User /></span>Barber</legend>
        <div className="sf-quick-barbers">
          {serviceBarbers.slice(0, 3).map((barber) => {
            const photo = barberPhoto(barber);
            const pressed = barberId === barber.id;
            return (
              <button key={barber.id} type="button" className="sf-quick-barber" aria-pressed={pressed} onClick={() => { setBarberId(pressed ? 'any' : barber.id); setStartsAt(''); }}>
                <span className="sf-quick-barber-photo">
                  <StorefrontImage src={photo.src} fallbackSrc={photo.fallback} alt="" sizes="160px" />
                </span>
                <span className="sf-quick-barber-name">{barber.displayName.split(' ')[0]}</span>
                {barber.chairNumber ? <span className="sf-quick-barber-meta">Chair {barber.chairNumber}</span> : null}
                {pressed ? <span className="sf-quick-tick" aria-hidden="true"><Check /></span> : null}
              </button>
            );
          })}
        </div>
        <p className="sf-quick-note">{barberId === 'any' ? 'First available barber' : `With ${serviceBarbers.find((barber) => barber.id === barberId)?.displayName}`}</p>
      </fieldset>

      <fieldset className="sf-quick-step">
        <legend><span className="sf-quick-ico" aria-hidden="true"><CalendarDays /></span>Time</legend>
        <div className="sf-quick-day">
          <button type="button" aria-label="Previous day" disabled={dayIndex === 0} onClick={() => { setTouchedDay(true); setDayIndex(dayIndex - 1); setStartsAt(''); }}><ChevronLeft aria-hidden="true" /></button>
          <p aria-live="polite">{dayIndex === 0 ? <><b>Today</b> · </> : dayIndex === 1 ? <><b>Tomorrow</b> · </> : null}{day.weekday} {day.day} {day.month}</p>
          <button type="button" aria-label="Next day" disabled={dayIndex === days.length - 1} onClick={() => { setTouchedDay(true); setDayIndex(dayIndex + 1); setStartsAt(''); }}><ChevronRight aria-hidden="true" /></button>
        </div>
        <div className="sf-quick-slots" aria-busy={loading}>
          {loading ? <p className="sf-quick-empty" role="status">Checking times…</p>
            : error && !slots.length ? <p className="sf-quick-empty" role="status">{error}</p>
            : !slots.length ? <p className="sf-quick-empty">No open times. <button type="button" className="sf-link" onClick={() => { setTouchedDay(true); setDayIndex(Math.min(dayIndex + 1, days.length - 1)); setStartsAt(''); }}>Next day</button></p>
            : slots.slice(0, 12).map((slot) => (
              <button key={slot.startsAt} type="button" className="sf-quick-slot" aria-pressed={slot.startsAt === startsAt} onClick={() => setStartsAt(slot.startsAt)}>{slot.label.replace(/\s?(AM|PM)$/i, (m) => m.toLowerCase())}</button>
            ))}
        </div>
      </fieldset>

      <Link
        href={bookHref({ serviceId: service?.id, barberId: barberId === 'any' ? null : barberId, date: day.key, startsAt: chosen?.startsAt })}
        className="sf-quick-cta"
      >
        Book appointment <ArrowRight aria-hidden="true" />
      </Link>
    </section>
  );
}
