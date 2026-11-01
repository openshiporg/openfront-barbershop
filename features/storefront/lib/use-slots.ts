'use client';

import { useEffect, useMemo, useState } from 'react';
import { shopDateKey } from '../../shared/shop-time';
import { getAvailableTimeSlots, type StorefrontTimeSlot } from './data/availability';

export type ShopDay = { key: string; weekday: string; day: string; month: string };

/** The next `count` days in the shop's own calendar, today first. */
export function shopDays(timeZone: string, count = 7): ShopDay[] {
  let today: string;
  try { today = shopDateKey(new Date(), timeZone); } catch { return []; }
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(date);
    return { key: date.toISOString().slice(0, 10), weekday: fmt({ weekday: 'short' }), day: fmt({ day: 'numeric' }), month: fmt({ month: 'short' }) };
  });
}

/**
 * Open start times for one service on one shop day, merged across the given barbers
 * (exact start instants identify slots; labels are display only).
 */
export function useSlots({ serviceId, durationMinutes, barberIds, date }: { serviceId?: string; durationMinutes?: number; barberIds: string[]; date: string }) {
  const [state, setState] = useState<{ key: string; slots: StorefrontTimeSlot[]; error: string | null }>({ key: '', slots: [], error: null });
  const key = `${serviceId}|${durationMinutes}|${barberIds.join(',')}|${date}`;

  useEffect(() => {
    if (!serviceId || !durationMinutes || !barberIds.length || !date) return;
    let cancelled = false;
    Promise.all(barberIds.map((barberId) => getAvailableTimeSlots(barberId, date, durationMinutes, serviceId)))
      .then((results) => {
        if (cancelled) return;
        const byInstant = new Map<string, StorefrontTimeSlot>();
        for (const result of results) for (const slot of result.slots) byInstant.set(slot.startsAt, slot);
        setState({
          key,
          slots: [...byInstant.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
          error: results.some((result) => result.error) ? 'Some times couldn’t be loaded. Try again or call the shop.' : null,
        });
      })
      .catch(() => { if (!cancelled) setState({ key, slots: [], error: 'Available times couldn’t be loaded. Try again or call the shop.' }); });
    return () => { cancelled = true; };
    // barberIds is folded into `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loading = Boolean(serviceId && durationMinutes && barberIds.length && date) && state.key !== key;
  return useMemo(() => ({ loading, slots: loading ? [] : state.slots, error: loading ? null : state.error }), [loading, state]);
}

/** Query string that opens /book with the visitor's choices already made. */
export function bookHref({ serviceId, barberId, date, startsAt }: { serviceId?: string; barberId?: string | null; date?: string; startsAt?: string }) {
  const params = new URLSearchParams();
  if (serviceId) params.set('service', serviceId);
  if (barberId) params.set('barber', barberId);
  if (date) params.set('date', date);
  if (startsAt) params.set('at', startsAt);
  const query = params.toString();
  return query ? `/book?${query}` : '/book';
}
