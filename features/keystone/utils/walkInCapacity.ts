import { nextPostedOpening, postedDayWindow } from '../../shared/shop-hours';
import { shopDateKey, shopMinute } from '../../shared/shop-time';
import { dayKeyForDate } from './availability';

type CapacityClient = {
  barber: { findMany(args: Record<string, unknown>): Promise<Array<{ id: string; schedules: Array<{ dayOfWeek: string; isWorking: boolean | null; startMinute: number | null; endMinute: number | null; breakStartMinute: number | null; breakEndMinute: number | null }> }>> };
  scheduleException: { findMany(args: Record<string, unknown>): Promise<Array<{ exceptionType: string; barberId: string | null; chairId: string | null }>> };
};

export type WalkInStatus = { open: boolean; barbersOnNow: number; opensAt: string | null; onNowIds: string[] };

/**
 * Walk-ins are open when the posted hours say the shop is open now, no shop
 * closure covers now, and at least one bookable barber is on their weekly
 * hours (outside a break) without time off right now.
 */
export async function walkInStatus(client: unknown, shop: { id: string; timezone?: string | null; hours?: unknown }, now = new Date()): Promise<WalkInStatus> {
  const prisma = client as CapacityClient;
  const timeZone = shop.timezone || 'UTC';
  const today = dayKeyForDate(shopDateKey(now, timeZone), timeZone);
  const minute = shopMinute(now, timeZone);
  const opensAt = nextPostedOpening(shop.hours, today, minute);
  const window = postedDayWindow(shop.hours, today);
  if (window === 'closed' || (window && (minute < window.startMinute || minute >= window.endMinute))) return { open: false, barbersOnNow: 0, opensAt, onNowIds: [] };

  const [barbers, exceptions] = await Promise.all([
    prisma.barber.findMany({ where: { shopId: shop.id, status: 'active', bookingEnabled: true }, select: { id: true, schedules: { where: { dayOfWeek: today, isWorking: true }, select: { dayOfWeek: true, isWorking: true, startMinute: true, endMinute: true, breakStartMinute: true, breakEndMinute: true } } } }),
    prisma.scheduleException.findMany({ where: { shopId: shop.id, status: 'active', startsAt: { lte: now }, endsAt: { gt: now }, exceptionType: { in: ['shop_closure', 'time_off'] } }, select: { exceptionType: true, barberId: true, chairId: true } }),
  ]);
  if (exceptions.some((item) => item.exceptionType === 'shop_closure' && !item.barberId && !item.chairId)) return { open: false, barbersOnNow: 0, opensAt, onNowIds: [] };
  const away = new Set(exceptions.filter((item) => item.exceptionType === 'time_off' && item.barberId).map((item) => item.barberId));
  const onNowIds = barbers.filter((barber) => !away.has(barber.id) && barber.schedules.some((schedule) =>
    (schedule.startMinute ?? 0) <= minute && minute < (schedule.endMinute ?? 0)
    && !(schedule.breakStartMinute != null && schedule.breakEndMinute != null && minute >= schedule.breakStartMinute && minute < schedule.breakEndMinute))).map((barber) => barber.id);
  return { open: onNowIds.length > 0, barbersOnNow: onNowIds.length, opensAt, onNowIds };
}
