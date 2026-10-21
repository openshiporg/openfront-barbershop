'use server';

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { readAccess } from '../access-cookie-read';
import type { PublicBookingEligibility } from '../../../shared/public-booking-eligibility';
import { MANAGE_PUBLIC_APPOINTMENT_MUTATION, PUBLIC_APPOINTMENT_QUERY, SIGN_PUBLIC_WAIVER_MUTATION } from './public-appointment-contracts';

export type PublicAppointmentCustomer = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  packageBalances?: {
    id: string;
    remainingVisits?: number | null;
    status?: string | null;
    expiresAt?: string | null;
    servicePackageName?: string | null;
    membershipPlanName?: string | null;
  }[] | null;
};

export type PublicAppointment = {
  id: string;
  bookingEligibility?: PublicBookingEligibility | null;
  bookingTimezone?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  durationMinutes?: number | null;
  status?: string | null;
  source?: string | null;
  paymentStatus?: string | null;
  price?: number | null;
  depositAmount?: number | null;
  customerNotes?: string | null;
  waiverRequired?: boolean | null;
  waiverTemplateKey?: string | null;
  waiverTemplateVersion?: string | null;
  waiverTemplateText?: string | null;
  waiverTemplateHash?: string | null;
  waiverSigned?: boolean | null;
  customer?: PublicAppointmentCustomer | null;
  barber?: { id: string; displayName?: string | null; imagePath?: string | null; chairNumber?: string | null } | null;
  lineItems?: {
    id: string;
    title?: string | null;
    price?: number | null;
    durationMinutes?: number | null;
    imagePath?: string | null;
    modifiers?: Record<string, unknown>[] | null;
    barberName?: string | null;
    barberChairNumber?: string | null;
    packageBalanceId?: string | null;
    packageName?: string | null;
    packageVisitsConsumed?: number | null;
  }[] | null;
  service?: {
    id: string;
    name?: string | null;
    description?: string | null;
    imagePath?: string | null;
    durationMinutes?: number | null;
    price?: number | null;
    depositRequired?: boolean | null;
    depositAmount?: number | null;
  } | null;
  transaction?: {
    id: string;
    status?: string | null;
    total?: number | null;
    formattedTotal?: string | null;
    paymentMethod?: string | null;
    completedAt?: string | null;
    refundedAmount?: number | null;
    formattedRefundedAmount?: string | null;
    refundedAt?: string | null;
  } | null;
};

export type PublicAppointmentLookup =
  | { status: 'found'; appointment: PublicAppointment }
  | { status: 'not_found' }
  | { status: 'unavailable' };

export type AppointmentChangeOutcome = {
  appointmentId: string;
  action: 'cancel' | 'reschedule';
  startsAt?: string | null;
  feeAmount: number;
  depositConsequence: 'none' | 'refund_required' | 'forfeiture_pending' | 'manual_review';
  preview?: boolean;
  replayed?: boolean;
  policyName?: string;
  policyVersion?: string;
};

/**
 * Uses the signed-in session (account bookings) or this browser's access cookie
 * (guest bookings). A failed request is "unavailable", never "not found".
 */
export async function getPublicAppointment(appointmentId: string): Promise<PublicAppointmentLookup> {
  const accessToken = await readAccess('appointment', appointmentId);
  const result = await keystoneClient<{ getPublicAppointment: PublicAppointment | null }>(String(PUBLIC_APPOINTMENT_QUERY), { appointmentId, accessToken: accessToken || null }, { cache: 'no-store' });
  if (!result.success) return { status: 'unavailable' };
  return result.data.getPublicAppointment ? { status: 'found', appointment: result.data.getPublicAppointment } : { status: 'not_found' };
}

type CommandResult<T> = { success: boolean; error?: string | null; data?: T | null };

export async function managePublicAppointment(input: { appointmentId: string; action: 'cancel' | 'reschedule'; startsAt?: string; reason: string; idempotencyKey: string; preview?: boolean; acceptedFeeAmount?: number }): Promise<CommandResult<AppointmentChangeOutcome>> {
  const accessToken = await readAccess('appointment', input.appointmentId);
  const result = await keystoneClient<{ managePublicAppointment: CommandResult<AppointmentChangeOutcome> }>(String(MANAGE_PUBLIC_APPOINTMENT_MUTATION), { ...input, accessToken: accessToken || null });
  if (!result.success) return { success: false, error: 'We couldn’t confirm whether your change went through. Reload this page to check before trying again.' };
  return result.data.managePublicAppointment;
}

export async function signPublicWaiver(input: { appointmentId: string; signerName: string; signerRole: 'customer' | 'guardian'; guardianName?: string; affirmation: boolean; idempotencyKey: string }): Promise<CommandResult<{ waiverId: string }>> {
  const accessToken = await readAccess('appointment', input.appointmentId);
  const result = await keystoneClient<{ signPublicWaiver: CommandResult<{ waiverId: string }> }>(String(SIGN_PUBLIC_WAIVER_MUTATION), { ...input, accessToken: accessToken || null });
  if (!result.success) return { success: false, error: 'We couldn’t confirm whether your signature was saved. Reload this page to check before signing again.' };
  return result.data.signPublicWaiver;
}
