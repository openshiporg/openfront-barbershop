import { buildSlotsForSchedule, dayKeyForDate, dayRange, occupiedBufferMinutes, type AvailabilitySlot } from "../utils/availability";
import { assertAppointmentCandidateSetComplete, MAX_BOOKING_CAPACITY_CANDIDATES, shopDayAppointmentCandidateFilter } from '../utils/bookingCapacity';
import { requireEffectivePractitionerAuthority } from '../utils/practitionerAuthority';
import { displayTimeToMinutes } from '../utils/availability';
import { shopWallTime, shopMinute } from '../../shared/shop-time';
import { resolvePublishedShop } from '../utils/publicShop';
import { clipToPostedHours } from '../../shared/shop-hours';

// Matches the online booking window enforced in createOnlineBooking.
const BOOKING_HORIZON_MS = 90 * 86400_000;

type Args = { barberId: string; serviceId?: string; date: string; serviceDuration: number; includeUnavailable?: boolean | null };
type ScheduleRecord = { id: string; dayOfWeek: string; isWorking?: boolean | null; startMinute?: number | null; endMinute?: number | null; breakStartMinute?: number | null; breakEndMinute?: number | null; barber?: { id: string; displayName?: string | null } | null };
type AvailabilitySudoContext = {
  query: { BarberSchedule: { findMany(args: Record<string, unknown>): Promise<ScheduleRecord[]> } };
  prisma: {
    $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
    service: { findFirst(args: Record<string, unknown>): Promise<{ id: string; durationMinutes: number; depositRequired: boolean; bookingBufferMinutes?: number | null; specialists: Array<{ id: string }> } | null> };
    shop: { findMany(args: Record<string, unknown>): Promise<Array<{ id: string }>> };
    barber: { findUnique(args: Record<string, unknown>): Promise<{ id: string; status: string; bookingEnabled: boolean; bufferMinutes?: number | null; chairId?: string | null; chair?: { id: string; status: string } | null; shop?: { id: string; status?: string; isPublic?: boolean; timezone?: string; hours?: unknown } | null } | null> };
    scheduleException: { findMany(args: Record<string, unknown>): Promise<Array<{ exceptionType: string; startsAt: Date; endsAt: Date; reason: string | null }>> };
    staffShift: { findMany(args: Record<string, unknown>): Promise<Array<{ scheduledStart: Date; scheduledEnd: Date }>> };
    appointment: { findMany(args: Record<string, unknown>): Promise<Array<{ id: string; startsAt: Date; endsAt: Date | null; durationMinutes: number | null; barberId: string | null; status?: string | null }>> };
  };
};
type AvailabilityContext = { sudo(): AvailabilitySudoContext };

export default async function checkBarberAvailability(_root: unknown, args: Args, context: AvailabilityContext): Promise<AvailabilitySlot[]> {
  const barberId = args.barberId?.trim();
  const serviceDuration = Math.min(480, Math.max(5, Math.floor(Number(args.serviceDuration || 30))));
  if (!barberId || !args.serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(args.date || '')) return [];
  const sudo = context.sudo();
  const [barber, publishedShop] = await Promise.all([
    sudo.prisma.barber.findUnique({ where: { id: barberId }, select: { id: true, status: true, bookingEnabled: true, bufferMinutes: true, chairId: true, chair: { select: { id: true, status: true } }, shop: { select: { id: true, status: true, isPublic: true, timezone: true, hours: true } } } }),
    resolvePublishedShop(sudo.prisma, { id: true }),
  ]);
  const shop = barber?.shop;
  if (!barber || !publishedShop || barber.status !== 'active' || !barber.bookingEnabled || !barber.chair || barber.chair.status !== 'active' || shop?.id !== publishedShop.id || shop.status !== 'active' || !shop.isPublic) return [];

  const service = await sudo.prisma.service.findFirst({ where: { id: args.serviceId, shopId: shop.id, status: 'active' }, select: { id: true, durationMinutes: true, depositRequired: true, bookingBufferMinutes: true, specialists: { select: { id: true } } } });
  if (!service || service.depositRequired || service.durationMinutes !== serviceDuration || (service.specialists.length && !service.specialists.some(item => item.id === barberId))) return [];
  const timeZone = shop.timezone || 'UTC';
  const dayOfWeek = dayKeyForDate(args.date, timeZone); const { start, end } = dayRange(args.date, timeZone);
  if (Number.isNaN(start.getTime()) || end <= new Date() || start.getTime() > Date.now() + BOOKING_HORIZON_MS) return [];
  const minute = (value: Date) => value <= start ? 0 : value >= end ? 1440 : shopMinute(value, timeZone);
  const bufferMinutes = occupiedBufferMinutes(barber.bufferMinutes, service.bookingBufferMinutes);

  const [schedules, exceptions, appointments, shifts] = await Promise.all([
    sudo.query.BarberSchedule.findMany({ where: { barber: { id: { equals: barberId } }, isWorking: { equals: true } }, query: "id dayOfWeek isWorking startMinute endMinute breakStartMinute breakEndMinute barber { id displayName }", take: 7 }),
    sudo.prisma.scheduleException.findMany({ where: { shopId: shop.id, status: 'active', startsAt: { lt: end }, endsAt: { gt: start }, OR: [{ barberId }, { exceptionType: 'shop_closure', barberId: null, chairId: null }, ...(barber.chairId ? [{ chairId: barber.chairId }] : [])] }, select: { exceptionType: true, startsAt: true, endsAt: true, reason: true } }),
    sudo.prisma.appointment.findMany({ where: { shopId: shop.id, ...shopDayAppointmentCandidateFilter(start, end, bufferMinutes), status: { in: ["requested", "confirmed", "checked_in", "in_chair"] }, OR: [{ barberId }, ...(barber.chairId ? [{ chairId: barber.chairId }] : [])] }, select: { id: true, startsAt: true, endsAt: true, durationMinutes: true, barberId: true, status: true }, take: MAX_BOOKING_CAPACITY_CANDIDATES + 1 }),
    sudo.prisma.staffShift.findMany({ where: { shopId: shop.id, barberId, status: { in: ['scheduled', 'clocked_in'] }, scheduledStart: { lt: end }, scheduledEnd: { gt: start } }, select: { scheduledStart: true, scheduledEnd: true } }),
  ]);
  assertAppointmentCandidateSetComplete(appointments);

  const weekly = schedules.find((candidate) => candidate.dayOfWeek === dayOfWeek);
  const override = exceptions.find((item) => item.exceptionType === 'working_override');
  // Online times stay inside the shop's posted hours as well as the barber's own.
  const schedule = clipToPostedHours(override ? { id: `override-${barberId}`, dayOfWeek, isWorking: true, startMinute: minute(override.startsAt), endMinute: minute(override.endsAt), barber: { id: barberId, displayName: '' } } : weekly, shop.hours, dayOfWeek);
  if (!schedule) return [];
  const orderedShifts = [...shifts].sort((left, right) => left.scheduledStart.getTime() - right.scheduledStart.getTime());
  const effectiveSchedule = orderedShifts.length ? { ...schedule, startMinute: Math.max(schedule.startMinute ?? 0, minute(orderedShifts[0].scheduledStart)), endMinute: Math.min(schedule.endMinute ?? 1440, minute(orderedShifts[orderedShifts.length - 1].scheduledEnd)) } : schedule;
  const shiftGaps = orderedShifts.slice(0, -1).map((shift, index) => ({ startsAt: shift.scheduledEnd, endsAt: orderedShifts[index + 1].scheduledStart, reason: 'Outside scheduled shift' })).filter((gap) => gap.endsAt > gap.startsAt);
  const slots = buildSlotsForSchedule({
    schedule: effectiveSchedule, date: args.date, timeZone,
    appointments: appointments.map((item) => ({ id: item.id, startsAt: item.startsAt.toISOString(), endsAt: item.endsAt ? item.endsAt.toISOString() : null, durationMinutes: item.durationMinutes, status: item.status || null, barber: item.barberId ? { id: item.barberId } : null })),
    occupiedAppointmentBufferMinutes: bufferMinutes,
    serviceDuration: serviceDuration + bufferMinutes,
    includeUnavailable: Boolean(args.includeUnavailable),
    blockingWindows: [...exceptions.filter((item) => item.exceptionType !== 'working_override').map((item) => ({ startsAt: item.startsAt, endsAt: item.endsAt, reason: item.reason })), ...shiftGaps],
  });
  const checked = await Promise.all(slots.map(async slot => {
    if (!slot.available) return slot;
    try {
      await requireEffectivePractitionerAuthority(sudo.prisma, { shopId: shop.id, barberId, serviceId: service.id, at: slot.startsAt ? new Date(slot.startsAt) : shopWallTime(args.date, displayTimeToMinutes(slot.time), timeZone) });
      return slot;
    } catch { return { ...slot, available: false, blockedReason: 'Practitioner authority unavailable' }; }
  }));
  return checked.filter(slot => slot.available || args.includeUnavailable);
}
