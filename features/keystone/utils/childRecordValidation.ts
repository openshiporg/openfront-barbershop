import { activeShopIds, type Session } from '../access';
import { connectedRelationshipId } from './shopRelationshipHooks';

type RecordData = Record<string, unknown>;
type Args = { resolvedData: RecordData; item?: RecordData; context: { session?: Session; prisma: unknown }; addValidationError(message: string): void };
type Parent = { id: string; shopId: string };
type Client = Record<string, { findUnique(args: { where: { id: string }; select: { id: true; shopId: true } }): Promise<Parent | null> }>;

export async function validateOwnedParents(args: Args, parents: Array<{ field: string; delegate: string }>) {
  const shops: string[] = [];
  for (const { field, delegate } of parents) {
    const id = args.resolvedData[field] === undefined ? String(args.item?.[`${field}Id`] || '') : connectedRelationshipId(args.resolvedData[field]);
    if (!id) { args.addValidationError(`${field} is required.`); continue; }
    const parent = await (args.context.prisma as Client)[delegate].findUnique({ where: { id }, select: { id: true, shopId: true } });
    if (!parent?.shopId) { args.addValidationError(`${field} is unavailable.`); continue; }
    shops.push(parent.shopId);
    if (args.context.session && !activeShopIds(args.context.session).includes(parent.shopId)) args.addValidationError('Not authorized to change this shop record.');
  }
  if (new Set(shops).size > 1) args.addValidationError('Related records must belong to the same shop.');
}

export function scheduleWindowError(data: RecordData): string | null {
  for (const key of ['startMinute', 'endMinute', 'breakStartMinute', 'breakEndMinute']) {
    const value = data[key];
    if (value != null && (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 1440)) return 'Schedule minutes must be integers between 0 and 1440.';
  }
  if (!data.isWorking) return null;
  const start = Number(data.startMinute); const end = Number(data.endMinute);
  if (!(start < end)) return 'A working schedule must end after it starts on the same shop day.';
  const a = data.breakStartMinute; const b = data.breakEndMinute;
  if ((a == null) !== (b == null)) return 'Set both break times or neither.';
  if (a != null && b != null && !(Number(a) >= start && Number(a) < Number(b) && Number(b) <= end)) return 'The break must fall inside the working window.';
  return null;
}

const UPCOMING_APPOINTMENT_STATUSES = ['requested', 'confirmed', 'checked_in', 'in_chair'];

type UpcomingClient = {
  barber: { findUnique(args: Record<string, unknown>): Promise<{ shop: { timezone: string | null } | null } | null> };
  appointment: { findMany(args: Record<string, unknown>): Promise<Array<{ startsAt: Date; endsAt: Date | null }>> };
};

/** Accepted upcoming appointments for a barber that a schedule/staff change
 * would strand. Configuration changes must not silently invalidate bookings. */
export async function upcomingBarberAppointments(prisma: unknown, barberId: string) {
  const client = prisma as UpcomingClient;
  const [barber, appointments] = await Promise.all([
    client.barber.findUnique({ where: { id: barberId }, select: { shop: { select: { timezone: true } } } }),
    client.appointment.findMany({
      where: { barberId, status: { in: UPCOMING_APPOINTMENT_STATUSES }, OR: [{ startsAt: { gte: new Date() } }, { status: 'in_chair' }] },
      select: { startsAt: true, endsAt: true },
      take: 1000,
    }),
  ]);
  return { timeZone: barber?.shop?.timezone || 'America/New_York', appointments };
}

function shopWeekdayAndMinute(value: Date, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(value).map((part) => [part.type, part.value]));
  return { weekday: String(parts.weekday).toLowerCase(), minute: Number(parts.hour) * 60 + Number(parts.minute) };
}

async function scheduleStrandsAppointments(args: Args, data: RecordData, removing: boolean) {
  const barberId = args.resolvedData.barber === undefined ? String(args.item?.barberId || '') : connectedRelationshipId(args.resolvedData.barber);
  const dayOfWeek = String(data.dayOfWeek || '');
  if (!barberId || !dayOfWeek) return 0;
  const { timeZone, appointments } = await upcomingBarberAppointments(args.context.prisma, barberId);
  return appointments.filter((appointment) => {
    const start = shopWeekdayAndMinute(appointment.startsAt, timeZone);
    if (start.weekday !== dayOfWeek) return false;
    if (removing || !data.isWorking) return true;
    const endMinute = appointment.endsAt ? start.minute + Math.round((appointment.endsAt.getTime() - appointment.startsAt.getTime()) / 60_000) : start.minute;
    if (start.minute < Number(data.startMinute) || endMinute > Number(data.endMinute)) return true;
    const a = data.breakStartMinute; const b = data.breakEndMinute;
    return a != null && b != null && start.minute < Number(b) && endMinute > Number(a);
  }).length;
}

export async function validateSchedule(args: Args & { operation?: string }) {
  if (args.operation === 'delete') {
    const stranded = await scheduleStrandsAppointments(args, { ...args.item }, true);
    if (stranded) args.addValidationError(`${stranded} upcoming appointment(s) rely on this working day. Reschedule or cancel them before removing it.`);
    return;
  }
  await validateOwnedParents(args, [{ field: 'barber', delegate: 'barber' }]);
  const data = { ...args.item, ...args.resolvedData };
  const error = scheduleWindowError(data);
  if (error) { args.addValidationError(error); return; }
  if (args.item) {
    const stranded = await scheduleStrandsAppointments(args, data, false);
    if (stranded) args.addValidationError(`${stranded} upcoming appointment(s) fall outside these hours. Reschedule or cancel them before changing this day.`);
  }
}

export function validatePackageItem(args: Args) {
  return validateOwnedParents(args, [{ field: 'package', delegate: 'servicePackage' }, { field: 'service', delegate: 'service' }]);
}
