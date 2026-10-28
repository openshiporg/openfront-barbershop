import { shopDateParts } from '../../shared/shop-time';
import { parseHoursRange, SHOP_HOURS_DAYS } from '../../shared/shop-hours';

const LABELS: Record<(typeof SHOP_HOURS_DAYS)[number], string> = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };

export type ShopHoursDay = { key: string; label: string; text: string; today: boolean };
export type ShopOpenState = { open: boolean; label: string } | null;

function weekdayKey(timeZone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(new Date()).toLowerCase();
}

function clock(minute: number) {
  const hour = Math.floor(minute / 60);
  return `${hour % 12 || 12}:${String(minute % 60).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

/** Posted hours set the way the board prints them: "9:00 AM – 7:00 PM"; anything unparsed is shown as entered. */
function displayHours(text: string) {
  const window = parseHoursRange(text);
  if (window === 'closed') return 'Closed';
  return window ? `${clock(window.startMinute)} – ${clock(window.endMinute % 1440)}` : text;
}

/** Merchant-entered weekly hours ("9:00 AM - 7:00 PM" per weekday), read in the shop timezone. */
export function shopHours(hours: Record<string, unknown> | null | undefined, timeZone: string): { days: ShopHoursDay[]; state: ShopOpenState } {
  let today = '';
  try { today = weekdayKey(timeZone); } catch { return { days: [], state: null }; }
  const days = SHOP_HOURS_DAYS.flatMap((key) => {
    const value = hours?.[key];
    return typeof value === 'string' && value.trim() ? [{ key, label: LABELS[key], text: displayHours(value.trim()), today: key === today }] : [];
  });
  const current = days.find((day) => day.today);
  if (!days.length) return { days, state: null };
  const window = current ? parseHoursRange(current.text) : 'closed';
  if (window === 'closed') return { days, state: { open: false, label: 'Closed today' } };
  if (!window) return { days, state: null };
  const parts = shopDateParts(new Date(), timeZone);
  const now = Number(parts.hour) * 60 + Number(parts.minute);
  if (now >= window.startMinute && now < window.endMinute) return { days, state: { open: true, label: `Open until ${clock(window.endMinute % 1440)}` } };
  return { days, state: { open: false, label: now < window.startMinute ? `Opens ${clock(window.startMinute)}` : 'Closed now' } };
}
