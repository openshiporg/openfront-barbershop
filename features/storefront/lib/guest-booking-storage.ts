import { type GuestBookingBody, type GuestBookingCommand, guestBookingBody, validateGuestBookingCommand } from '../../shared/guest-booking-command';

// Only a booking request whose outcome is still unknown is kept, in this tab's
// session storage, so it can be checked or resent exactly after a lost response.
// It is removed as soon as the outcome is known; no history is retained.
export const GUEST_BOOKING_STORAGE_KEY = 'openfront:guest-booking:v1';
type PrivateStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Saved = { version: 1; current: GuestBookingCommand | null };

export function readGuestBookingStorage(storage: PrivateStorage): Saved {
  const bytes = storage.getItem(GUEST_BOOKING_STORAGE_KEY);
  if (bytes === null) return { version: 1, current: null };
  const saved = JSON.parse(bytes) as Saved;
  if (!saved || saved.version !== 1 || !('current' in saved)
    || !(saved.current === null || (typeof saved.current === 'object' && !Array.isArray(saved.current)))) throw new Error('Saved booking request could not be read.');
  if (saved.current) {
    validateGuestBookingCommand(saved.current);
    if (Object.keys(saved.current).sort().join() !== 'guestProof,requestBody,requestKey') throw new Error('Saved booking request could not be read.');
  }
  return { version: 1, current: saved.current };
}

function write(storage: PrivateStorage, saved: Saved) {
  const bytes = JSON.stringify(saved);
  storage.setItem(GUEST_BOOKING_STORAGE_KEY, bytes);
  if (storage.getItem(GUEST_BOOKING_STORAGE_KEY) !== bytes) throw new Error('Booking request could not be saved in this browser.');
  return saved;
}

function randomCapability(random: Pick<Crypto, 'getRandomValues'>) {
  const bytes = random.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function saveNewGuestBooking(storage: PrivateStorage, random: Pick<Crypto, 'getRandomValues'>, input: Omit<GuestBookingBody, 'purpose'>): GuestBookingCommand {
  const saved = readGuestBookingStorage(storage);
  if (saved.current) throw new Error('Check your earlier booking request before making a new one.');
  if (!random?.getRandomValues) throw new Error('Secure request generation is unavailable in this browser.');
  const command = { requestKey: randomCapability(random), guestProof: randomCapability(random), requestBody: JSON.stringify(guestBookingBody(input)) };
  validateGuestBookingCommand(command);
  write(storage, { version: 1, current: command });
  return command;
}

export function verifySavedGuestBooking(storage: PrivateStorage, command: GuestBookingCommand) {
  const saved = readGuestBookingStorage(storage);
  if (JSON.stringify(saved.current) !== JSON.stringify(command)) throw new Error('The saved booking request changed in another tab. Reload the page.');
  return command;
}

/** Call only once the server has given a definite outcome for this exact request. */
export function clearResolvedGuestBooking(storage: PrivateStorage, command: GuestBookingCommand) {
  const saved = readGuestBookingStorage(storage);
  if (saved.current && JSON.stringify(saved.current) !== JSON.stringify(command)) return;
  storage.removeItem(GUEST_BOOKING_STORAGE_KEY);
}

export async function dispatchSavedGuestBooking<T>(storage: PrivateStorage, command: GuestBookingCommand, dispatch: (command: GuestBookingCommand) => Promise<T>): Promise<T> {
  return dispatch(verifySavedGuestBooking(storage, command));
}
