/** "America/New_York" reads as "Eastern Time"; an unknown zone stays as entered. */
export function timeZoneName(timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longGeneric' }).formatToParts(new Date()).find((part) => part.type === 'timeZoneName')?.value || timeZone;
  } catch { return timeZone; }
}

/** Open times a visit can move to: the barber's open slots minus the time it already holds. */
export function rescheduleSlots<T extends { startsAt: string }>(slots: T[], currentStartsAt?: string | null): T[] {
  const current = currentStartsAt ? new Date(currentStartsAt).getTime() : NaN;
  return slots.filter((slot) => new Date(slot.startsAt).getTime() !== current);
}
