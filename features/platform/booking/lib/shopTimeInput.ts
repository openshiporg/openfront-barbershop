import { shopWallTime } from '@/features/shared/shop-time';

/** Converts a shop-local date + time entry into a UTC instant, or a field error. */
export function parseShopDateTime(date: string, time: string, timeZone: string): { ok: true; iso: string } | { ok: false; error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'Enter a date.' };
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return { ok: false, error: 'Enter a time.' };
  const minute = Number(match[1]) * 60 + Number(match[2]);
  if (minute >= 1440) return { ok: false, error: 'Enter a valid time.' };
  try {
    return { ok: true, iso: shopWallTime(date, minute, timeZone).toISOString() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'That local time does not exist in the shop timezone.' };
  }
}
