import { shopDateParts } from '../../shared/shop-time';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const LABELS: Record<(typeof DAYS)[number], string> = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
const RANGE = /(\d{1,2})(?::(\d{2}))?\s*([AP]M)\s*[-–—to]+\s*(\d{1,2})(?::(\d{2}))?\s*([AP]M)/i;

export type ShopHoursDay = { key: string; label: string; text: string; today: boolean };
export type ShopOpenState = { open: boolean; label: string } | null;

function toMinute(hour: string, minute: string | undefined, meridiem: string) {
  const h = Number(hour) % 12 + (meridiem.toUpperCase() === 'PM' ? 12 : 0);
  return h * 60 + Number(minute || 0);
}

function weekdayKey(timeZone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(new Date()).toLowerCase();
}

/** Merchant-entered weekly hours ("9:00 AM - 7:00 PM" per weekday), read in the shop timezone. */
export function shopHours(hours: Record<string, unknown> | null | undefined, timeZone: string): { days: ShopHoursDay[]; state: ShopOpenState } {
  let today = '';
  try { today = weekdayKey(timeZone); } catch { return { days: [], state: null }; }
  const days = DAYS.flatMap((key) => {
    const value = hours?.[key];
    return typeof value === 'string' && value.trim() ? [{ key, label: LABELS[key], text: value.trim(), today: key === today }] : [];
  });
  const current = days.find((day) => day.today);
  if (!days.length) return { days, state: null };
  if (!current || /closed/i.test(current.text)) return { days, state: { open: false, label: 'Closed today' } };
  const match = RANGE.exec(current.text);
  if (!match) return { days, state: null };
  const parts = shopDateParts(new Date(), timeZone);
  const now = Number(parts.hour) * 60 + Number(parts.minute);
  const opens = toMinute(match[1], match[2], match[3]);
  const closes = toMinute(match[4], match[5], match[6]);
  const closeLabel = `${match[4]}:${match[5] || '00'} ${match[6].toUpperCase()}`;
  const openLabel = `${match[1]}:${match[2] || '00'} ${match[3].toUpperCase()}`;
  if (now >= opens && now < closes) return { days, state: { open: true, label: `Open until ${closeLabel}` } };
  return { days, state: { open: false, label: now < opens ? `Opens ${openLabel}` : 'Closed now' } };
}
