/** Shop wall-clock conversion: independent of browser/server TZ; no global TZ mutation. */
export function shopDateParts(value: Date | string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}
export function shopDateKey(value: Date | string, timeZone: string) {
  const p = shopDateParts(value, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}
export function shopMinute(value: Date | string, timeZone: string) {
  const p = shopDateParts(value, timeZone);
  return Number(p.hour) * 60 + Number(p.minute);
}
export function shopWallTime(date: string, minute: number, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day, 0, minute);
  let instant = target;
  for (let i = 0; i < 4; i++) {
    const p = shopDateParts(new Date(instant), timeZone);
    const represented = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
    const delta = target - represented;
    if (!delta) return new Date(instant);
    instant += delta;
  }
  throw new Error('This local time does not exist in the shop timezone. Choose another time.');
}
export function shopDayRange(value: string | Date, timeZone: string) {
  const key = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : shopDateKey(value, timeZone);
  const next = new Date(`${key}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start: shopWallTime(key, 0, timeZone), end: shopWallTime(next.toISOString().slice(0, 10), 0, timeZone) };
}
export function formatShopDateTime(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
