/** Posted weekly shop hours: one "9:00 AM - 7:00 PM" (or "Closed") string per weekday. */

export const SHOP_HOURS_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export type ShopHoursDayKey = (typeof SHOP_HOURS_DAYS)[number];

const RANGE = /^\s*(\d{1,2})(?::(\d{2}))?\s*([AP]M)\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*([AP]M)\s*$/i;

function toMinute(hour: string, minute: string | undefined, meridiem: string) {
  return (Number(hour) % 12 + (meridiem.toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(minute || 0);
}

/** Opening window in shop minutes, 'closed', or null when the text can't be read. */
export function parseHoursRange(text: string): { startMinute: number; endMinute: number } | 'closed' | null {
  if (/^\s*closed\s*$/i.test(text)) return 'closed';
  const match = RANGE.exec(text);
  if (!match) return null;
  const startMinute = toMinute(match[1], match[2], match[3]);
  const endMinute = toMinute(match[4], match[5], match[6]);
  return endMinute > startMinute ? { startMinute, endMinute } : null;
}

/** The posted window for one weekday; null means no usable hours are posted at all. */
export function postedDayWindow(hours: unknown, dayKey: string): { startMinute: number; endMinute: number } | 'closed' | null {
  if (!hours || typeof hours !== 'object') return null;
  const record = hours as Record<string, unknown>;
  const posted = SHOP_HOURS_DAYS.filter((day) => typeof record[day] === 'string' && String(record[day]).trim());
  if (!posted.length) return null;
  const value = record[dayKey];
  if (typeof value !== 'string' || !value.trim()) return 'closed';
  return parseHoursRange(value);
}

/** Narrows a barber's working window to the shop's posted hours; null when the shop is closed. */
export function clipToPostedHours<T extends { startMinute?: number | null; endMinute?: number | null }>(schedule: T | null | undefined, hours: unknown, dayKey: string): T | null {
  if (!schedule) return null;
  const window = postedDayWindow(hours, dayKey);
  if (window === null) return schedule;
  if (window === 'closed') return null;
  const startMinute = Math.max(schedule.startMinute ?? 0, window.startMinute);
  const endMinute = Math.min(schedule.endMinute ?? 1440, window.endMinute);
  return endMinute > startMinute ? { ...schedule, startMinute, endMinute } : null;
}

/** Validates merchant-entered hours; returns the normalised record or an error. */
export function normalizeShopHours(input: unknown): { hours: Record<ShopHoursDayKey, string> } | { error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Enter hours for each day.' };
  const record = input as Record<string, unknown>;
  const hours = {} as Record<ShopHoursDayKey, string>;
  for (const day of SHOP_HOURS_DAYS) {
    const text = typeof record[day] === 'string' ? String(record[day]).trim() : '';
    const parsed = parseHoursRange(text || 'Closed');
    if (!parsed) return { error: `Hours for ${day[0].toUpperCase()}${day.slice(1)} must look like 9:00 AM - 7:00 PM, or Closed.` };
    hours[day] = parsed === 'closed' ? 'Closed' : text;
  }
  return { hours };
}

const pad = (value: number) => String(value).padStart(2, '0');

/** "9:00 AM - 7:00 PM" → { open: '09:00', close: '19:00' } for time inputs; null when closed or unreadable. */
export function hoursTextToTimes(text: string | null | undefined): { open: string; close: string } | null {
  const window = parseHoursRange(text || '');
  if (!window || window === 'closed') return null;
  const time = (minute: number) => `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
  return { open: time(window.startMinute), close: time(window.endMinute) };
}

/** Time-input values ("09:00", "19:00") → "9:00 AM - 7:00 PM". */
export function timesToHoursText(open: string, close: string) {
  const label = (value: string) => {
    const [hour, minute] = value.split(':').map(Number);
    return `${hour % 12 || 12}:${pad(minute || 0)} ${hour >= 12 ? 'PM' : 'AM'}`;
  };
  return `${label(open)} - ${label(close)}`;
}
