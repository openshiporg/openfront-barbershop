import { shopDateKey, shopDayRange, shopMinute, shopWallTime } from '../../shared/shop-time';

/** Cleanup after a visit: the longer of the barber's and the service's buffer. */
export function occupiedBufferMinutes(barberBufferMinutes?: number | null, serviceBufferMinutes?: number | null) {
  const value = (input?: number | null) => (Number.isFinite(input) ? Math.max(0, Math.floor(Number(input))) : 0);
  return Math.max(value(barberBufferMinutes), value(serviceBufferMinutes));
}

export type AvailabilitySlot = {
  time: string;
  startsAt?: string | null;
  available: boolean;
  barberId?: string | null;
  barberName?: string | null;
  blockedReason?: string | null;
};

type Schedule = {
  dayOfWeek: string;
  isWorking?: boolean | null;
  startMinute?: number | null;
  endMinute?: number | null;
  breakStartMinute?: number | null;
  breakEndMinute?: number | null;
  barber?: { id: string; displayName?: string | null } | null;
};

type AppointmentWindow = {
  id?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  durationMinutes?: number | null;
  status?: string | null;
  barber?: { id: string } | null;
};

/**
 * When an existing appointment frees its barber/chair, in epoch ms. Matches walk-in
 * seating: a guest still in the chair occupies it until completed (at least until
 * now), and a legacy row without an end time is never treated as free capacity.
 */
export function appointmentOccupiedUntil(appointment: AppointmentWindow, bufferMinutes = 0, now = Date.now()) {
  if (!appointment.endsAt) return Number.POSITIVE_INFINITY;
  const buffer = Math.max(0, bufferMinutes || 0) * 60_000;
  const plannedEnd = new Date(appointment.endsAt).getTime() + buffer;
  return appointment.status === 'in_chair' ? Math.max(plannedEnd, now + buffer) : plannedEnd;
}

export type BlockingWindow = {
  startsAt: string | Date;
  endsAt: string | Date;
  reason?: string | null;
};

const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function minutesToDisplayTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const hour12 = hours % 12 || 12;
  const period = hours >= 12 ? "PM" : "AM";
  return `${hour12}:${mins.toString().padStart(2, "0")} ${period}`;
}

export function displayTimeToMinutes(time: string) {
  const [raw, period] = time.trim().split(/\s+/);
  const [hoursRaw, minutesRaw] = raw.split(":").map(Number);
  let hours = hoursRaw;
  if (period?.toUpperCase() === "PM" && hours !== 12) hours += 12;
  if (period?.toUpperCase() === "AM" && hours === 12) hours = 0;
  return hours * 60 + (minutesRaw || 0);
}

export function dayKeyForDate(date: string | Date, timeZone?: string) {
  if (timeZone) {
    const key = typeof date === 'string' ? date : shopDateKey(date, timeZone);
    return dayKeys[new Date(`${key}T12:00:00Z`).getUTCDay()];
  }
  const value = typeof date === "string" ? new Date(`${date}T00:00:00.000`) : date;
  return dayKeys[value.getDay()];
}

export function dayRange(date: string | Date, timeZone?: string) {
  if (timeZone) return shopDayRange(date, timeZone);
  const start = typeof date === "string" ? new Date(`${date}T00:00:00.000`) : new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

function appointmentWindow(appointment: AppointmentWindow) {
  if (!appointment.startsAt) return null;
  const startsAt = new Date(appointment.startsAt);
  const start = startsAt.getHours() * 60 + startsAt.getMinutes();
  if (appointment.endsAt) {
    const endsAt = new Date(appointment.endsAt);
    return { start, end: endsAt.getHours() * 60 + endsAt.getMinutes() };
  }
  return { start, end: start + (appointment.durationMinutes || 30) };
}

export function buildSlotsForSchedule({
  schedule,
  appointments,
  serviceDuration,
  slotStep = 15,
  includeUnavailable = false,
  blockingWindows = [],
  date,
  timeZone,
  now = new Date(),
  occupiedAppointmentBufferMinutes = 0,
}: {
  occupiedAppointmentBufferMinutes?: number;
  now?: Date;
  date?: string;
  timeZone?: string;
  schedule: Schedule;
  appointments: AppointmentWindow[];
  serviceDuration: number;
  slotStep?: number;
  includeUnavailable?: boolean;
  blockingWindows?: BlockingWindow[];
}): AvailabilitySlot[] {
  if (!schedule?.isWorking) return [];
  const startMinute = schedule.startMinute ?? 540;
  const endMinute = schedule.endMinute ?? 1020;
  const latestStart = endMinute - serviceDuration;
  const booked = appointments.map(appointmentWindow).filter(Boolean) as { start: number; end: number }[];
  const blocked = blockingWindows.map((window) => {
    const start = new Date(window.startsAt); const end = new Date(window.endsAt);
    return { start: start.getHours() * 60 + start.getMinutes(), end: end.getHours() * 60 + end.getMinutes(), reason: window.reason || 'Schedule exception' };
  });
  const slots: AvailabilitySlot[] = [];

  for (let minute = startMinute; minute <= latestStart; minute += slotStep) {
    const slotEnd = minute + serviceDuration;
    const duringBreak = typeof schedule.breakStartMinute === "number" && typeof schedule.breakEndMinute === "number"
      ? overlaps(minute, slotEnd, schedule.breakStartMinute, schedule.breakEndMinute)
      : false;
    let instant: Date | undefined;
    if (date && timeZone) {
      try { instant = shopWallTime(date, minute, timeZone); } catch { continue; }
      if (instant <= now) continue;
    }
    const instantEnd = instant ? instant.getTime() + serviceDuration * 60_000 : 0;
    const hitsAppointment = instant
      ? appointments.some((item) => item.startsAt && overlaps(instant!.getTime(), instantEnd, new Date(item.startsAt).getTime(), appointmentOccupiedUntil(item, occupiedAppointmentBufferMinutes, now.getTime())))
      : booked.some((window) => overlaps(minute, slotEnd, window.start, window.end));
    const exception = instant
      ? blockingWindows.find((window) => overlaps(instant!.getTime(), instantEnd, new Date(window.startsAt).getTime(), new Date(window.endsAt).getTime()))
      : blocked.find((window) => overlaps(minute, slotEnd, window.start, window.end));
    const blockedReason = duringBreak ? "Break time" : exception?.reason || (hitsAppointment ? "Already booked" : null);
    const available = !blockedReason;

    if (available || includeUnavailable) {
      slots.push({
        time: minutesToDisplayTime(minute),
        startsAt: instant ? instant.toISOString() : null,
        available,
        barberId: schedule.barber?.id || null,
        barberName: schedule.barber?.displayName || null,
        blockedReason,
      });
    }
  }

  return slots;
}

export function isSlotAvailable({
  startsAt,
  serviceDuration,
  schedule,
  appointments,
  blockingWindows = [],
  timeZone,
  occupiedAppointmentBufferMinutes = 0,
}: {
  timeZone?: string;
  startsAt: Date;
  serviceDuration: number;
  schedule?: Schedule | null;
  appointments: AppointmentWindow[];
  blockingWindows?: BlockingWindow[];
  occupiedAppointmentBufferMinutes?: number;
}) {
  if (!schedule?.isWorking) return false;
  const slotStart = timeZone ? shopMinute(startsAt, timeZone) : startsAt.getHours() * 60 + startsAt.getMinutes();
  const slotEnd = slotStart + serviceDuration;
  const occupiedBufferMinutes = Math.max(0, occupiedAppointmentBufferMinutes || 0);
  const startMinute = schedule.startMinute ?? 540;
  const endMinute = schedule.endMinute ?? 1020;

  if (slotStart < startMinute || slotEnd > endMinute) return false;
  if (typeof schedule.breakStartMinute === "number" && typeof schedule.breakEndMinute === "number") {
    if (overlaps(slotStart, slotEnd, schedule.breakStartMinute, schedule.breakEndMinute)) return false;
  }

  if (blockingWindows.some((window) => {
    const blockedStart = new Date(window.startsAt).getTime();
    const blockedEnd = new Date(window.endsAt).getTime();
    const requestedStart = startsAt.getTime();
    return requestedStart < blockedEnd && blockedStart < requestedStart + serviceDuration * 60_000;
  })) return false;

  return !appointments.some((appointment) => {
    if (timeZone && appointment.startsAt) {
      const start = new Date(appointment.startsAt).getTime();
      const end = appointmentOccupiedUntil(appointment, occupiedBufferMinutes);
      return overlaps(startsAt.getTime(), startsAt.getTime() + serviceDuration * 60_000, start, end);
    }
    const window = appointmentWindow(appointment);
    return window ? overlaps(slotStart, slotEnd, window.start, window.end + occupiedBufferMinutes) : false;
  });
}
