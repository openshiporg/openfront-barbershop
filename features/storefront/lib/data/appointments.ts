'use server';

import { storefrontClient } from '../config';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { getAuthHeaders } from '../../../dashboard/lib/cookies';
import { type GuestBookingCommand, validateGuestBookingCommand } from '../../../shared/guest-booking-command';
import { rememberAccess } from '../access-cookies';
import { CREATE_STOREFRONT_BOOKING_MUTATION, RECOVER_GUEST_BOOKING_MUTATION, normalizeCreateBookingResult, type CreateBookingResult } from './public-appointment-contracts';

export type { StorefrontBookedAppointment } from './public-appointment-contracts';

const interrupted = () => ({ success: false as const, disposition: 'unresolved' as const, error: 'We couldn’t confirm whether your booking request went through. Check again before booking another time.' });

async function normalizeOwnedResult(command: GuestBookingCommand, result: CreateBookingResult) {
  if (result.success && (result.disposition !== 'accepted' || result.accessToken !== command.guestProof)) return interrupted();
  if (!result.success && result.disposition === 'closed' && (result.appointment || result.accessToken)) return interrupted();
  const normalized = normalizeCreateBookingResult(result);
  // The status link carries only the booking id; access stays in an HttpOnly cookie.
  if (normalized.success) await rememberAccess('appointment', normalized.appointment.id, normalized.accessToken);
  return normalized.success ? { success: true as const, disposition: 'accepted' as const, appointment: normalized.appointment } : normalized;
}

async function signedInAs(accountId: string) {
  const identity = await keystoneClient<{ authenticatedItem: { id: string } | null }>('query { authenticatedItem { ... on User { id } } }');
  return identity.success && identity.data.authenticatedItem?.id === accountId;
}

export async function createStorefrontBooking(command: GuestBookingCommand, accountId = '') {
  try {
    validateGuestBookingCommand(command);
    // Do not silently strip a current account cookie and book as a guest.
    if (accountId) {
      if (!(await signedInAs(accountId))) return interrupted();
      const result = await keystoneClient<{ createOnlineBooking: CreateBookingResult }>(String(CREATE_STOREFRONT_BOOKING_MUTATION).replace('createOnlineBooking(', 'createOnlineBooking: createAccountBooking('), command);
      return result.success ? normalizeOwnedResult(command, result.data.createOnlineBooking) : interrupted();
    }
    if ((await getAuthHeaders()).Cookie) return interrupted();
    const result = await storefrontClient.request<{ createOnlineBooking: CreateBookingResult }>(CREATE_STOREFRONT_BOOKING_MUTATION, command);
    return normalizeOwnedResult(command, result.createOnlineBooking);
  } catch {
    // Unknown transport/commit outcome is not rollback. Never log guest secrets.
    return interrupted();
  }
}

export async function recoverStorefrontBooking(command: GuestBookingCommand, closeIfAbsent = false, accountId = '') {
  try {
    validateGuestBookingCommand(command);
    if (accountId) {
      if (!(await signedInAs(accountId))) return interrupted();
      const result = await keystoneClient<{ recoverGuestBooking: CreateBookingResult }>(String(RECOVER_GUEST_BOOKING_MUTATION).replace('recoverGuestBooking(', 'recoverGuestBooking: recoverAccountBooking('), { ...command, closeIfAbsent });
      return result.success ? normalizeOwnedResult(command, result.data.recoverGuestBooking) : interrupted();
    }
    if ((await getAuthHeaders()).Cookie) return interrupted();
    const result = await storefrontClient.request<{ recoverGuestBooking: CreateBookingResult }>(RECOVER_GUEST_BOOKING_MUTATION, { ...command, closeIfAbsent });
    return normalizeOwnedResult(command, result.recoverGuestBooking);
  } catch { return interrupted(); }
}
