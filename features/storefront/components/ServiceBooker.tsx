'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { formatShopDateTime } from '../../shared/shop-time';
import type { StorefrontBarber, StorefrontService } from '../lib/data/services';
import { formatDuration, formatMoney } from '../lib/format';
import { bookHref, shopDays, useSlots } from '../lib/use-slots';
import { barberPhoto } from './BarberCard';
import { StorefrontImage } from './StorefrontImage';

/** Service page: choose a day, a time and a barber; the summary hands every choice to /book. */
export function ServiceBooker({ service, barbers, timeZone }: { service: StorefrontService; barbers: StorefrontBarber[]; timeZone: string }) {
  const days = useMemo(() => shopDays(timeZone, 7), [timeZone]);
  const [date, setDate] = useState(days[0]?.key || '');
  const [barberId, setBarberId] = useState('any');
  const [startsAt, setStartsAt] = useState('');
  const barberIds = barberId === 'any' ? barbers.map((barber) => barber.id) : [barberId];
  const { loading, slots, error } = useSlots({ serviceId: service.id, durationMinutes: service.durationMinutes, barberIds, date });
  const [touched, setTouched] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // Until the visitor picks a day, move past closed or full days to the first with open times.
  useEffect(() => {
    const index = days.findIndex((item) => item.key === date);
    if (!touched && !loading && !error && !slots.length && index >= 0 && index < days.length - 1) setDate(days[index + 1].key);
  }, [touched, loading, error, slots.length, date, days]);
  const chosen = slots.find((slot) => slot.startsAt === startsAt);
  const barber = barbers.find((item) => item.id === barberId) || null;
  const photo = barber ? barberPhoto(barber) : null;
  const day = days.find((item) => item.key === date);

  return (
    <>
      <section className="sf-detail-mid" aria-labelledby="detail-when">
        <h2 id="detail-when" className="sf-detail-h">Select date &amp; time</h2>
        <div className="sf-days" role="group" aria-label="Day">
          {days.map((item) => (
            <button key={item.key} type="button" className="sf-day" aria-pressed={item.key === date} onClick={() => { setTouched(true); setShowAll(false); setDate(item.key); setStartsAt(''); }} aria-label={`${item.weekday} ${item.month} ${item.day}`}>
              <span>{item.weekday}</span><b>{item.day}</b>
            </button>
          ))}
        </div>
        <div className="sf-slot-list" aria-busy={loading}>
          {loading ? <p role="status">Checking times…</p>
            : !slots.length ? <p role="status">{error || `No open times${day ? ` on ${day.weekday} ${day.day}` : ''}. Try another day.`}</p>
            : (showAll ? slots : slots.slice(0, 12)).map((slot) => (
              <button key={slot.startsAt} type="button" className="sf-slot-line" aria-pressed={slot.startsAt === startsAt} onClick={() => setStartsAt(slot.startsAt)}>{slot.label}</button>
            ))}
        </div>
        {!loading && slots.length > 12 && !showAll ? <button type="button" className="sf-btn is-quiet justify-self-start" onClick={() => setShowAll(true)}>{slots.length - 12} more times</button> : null}

        {barbers.length > 1 ? (
          <>
            <h2 className="sf-detail-h is-small">Barber</h2>
            <div className="sf-pick-barbers" role="group" aria-label="Barber">
              <button type="button" className="sf-pick-barber is-any" aria-pressed={barberId === 'any'} onClick={() => { setBarberId('any'); setStartsAt(''); }}>
                <span className="sf-pick-barber-name">First available</span>
                {barberId === 'any' ? <span className="sf-pick-tick" aria-hidden="true"><Check /></span> : null}
              </button>
              {barbers.map((item) => {
                const p = barberPhoto(item);
                return (
                  <button key={item.id} type="button" className="sf-pick-barber" aria-pressed={barberId === item.id} onClick={() => { setBarberId(item.id); setStartsAt(''); }}>
                    <span className="sf-pick-barber-photo"><StorefrontImage src={p.src} fallbackSrc={p.fallback} alt="" sizes="120px" /></span>
                    <span className="sf-pick-barber-name">{item.displayName}</span>
                    {barberId === item.id ? <span className="sf-pick-tick" aria-hidden="true"><Check /></span> : null}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </section>

      <aside className="sf-detail-summary" aria-labelledby="detail-summary">
        <h2 id="detail-summary" className="sf-detail-summary-h">Your booking</h2>
        {barber && photo ? (
          <div className="sf-with">
            <span className="sf-with-tab">With {barber.displayName.split(' ')[0]}</span>
            <span className="sf-with-photo"><StorefrontImage src={photo.src} fallbackSrc={photo.fallback} alt={barber.displayName} sizes="200px" /></span>
          </div>
        ) : null}
        <dl className="sf-receipt">
          <div><dt>Service</dt><dd>{service.name}</dd></div>
          <div><dt>Barber</dt><dd>{barber?.displayName || 'First available'}</dd></div>
          <div><dt>Date</dt><dd>{day ? `${day.weekday}, ${day.month} ${day.day}` : '—'}</dd></div>
          <div><dt>Time</dt><dd>{chosen ? formatShopDateTime(chosen.startsAt, timeZone).split(', ').pop() : '—'}</dd></div>
          <div><dt>Duration</dt><dd>{formatDuration(service.durationMinutes)}</dd></div>
          {service.depositRequired ? <div><dt>Deposit</dt><dd>{formatMoney(service.depositAmount || 0)}, paid online</dd></div> : null}
        </dl>
        <p className="sf-receipt-total"><span>Total</span><b>{formatMoney(service.price)}</b></p>
        <Link href={bookHref({ serviceId: service.id, barberId: barberId === 'any' ? null : barberId, date, startsAt: chosen?.startsAt })} className="sf-confirm">
          {chosen ? 'Confirm booking' : 'Choose a time'}
        </Link>
        <p className="sf-small sf-muted">Your details and confirmation are on the next step.</p>
      </aside>
    </>
  );
}
