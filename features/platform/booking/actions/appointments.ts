'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import type { AppointmentBoardBarber, AppointmentBoardItem, AppointmentStatus, BookingServiceOption } from '../lib/appointmentTypes';

export type BookingProjectionData = {
  timeZone: string;
  date: string;
  status: AppointmentStatus | null;
  page: number;
  pageSize: number;
  matching: number;
  appointments: AppointmentBoardItem[];
  barbers: AppointmentBoardBarber[];
  services: BookingServiceOption[];
  statusCounts: Record<string, number>;
  metrics: { scheduled: number; inShop: number; activeFlow: number; bookedValue: number };
};

export type BookingLoadResult =
  | { success: true; data: BookingProjectionData }
  | { success: false; kind: 'forbidden' | 'unavailable'; error: string };

type CommandResult = { success: boolean; error?: string | null; data?: Record<string, unknown> | null };

function isForbidden(message?: string | null) {
  return /not authorized|permission|revoked|active shop|select exactly one|sign in/i.test(message || '');
}

export async function getBookingBoardData(input: { date?: string; status?: string; page?: number }): Promise<BookingLoadResult> {
  const response = await keystoneClient<{ platformBooking: { success: boolean; error?: string | null; data?: BookingProjectionData | null } }>(`
    query BookingBoardProjection($date: String, $status: String, $page: Int) {
      platformBooking(date: $date, status: $status, page: $page) { success error data }
    }
  `, { date: input.date, status: input.status, page: input.page }, { cache: 'no-store' });
  if (!response.success) return { success: false, kind: isForbidden(response.error) ? 'forbidden' : 'unavailable', error: response.error || 'Booking board unavailable.' };
  const result = response.data?.platformBooking;
  if (!result?.success || !result.data) {
    const error = result?.error || 'Booking board unavailable.';
    return { success: false, kind: isForbidden(error) ? 'forbidden' : 'unavailable', error };
  }
  return { success: true, data: result.data };
}

export async function markAppointmentNoShowAction(id: string, policyId?: string) {
  const response = await keystoneClient(`
    mutation MarkNoShow($id: ID!, $policyId: ID, $reason: String!, $key: String!) {
      markAppointmentNoShow(appointmentId: $id, policyId: $policyId, reason: $reason, idempotencyKey: $key) { success error data }
    }
  `, { id, policyId, reason: 'Marked no-show from booking board', key: `platform:no-show:${id}:${policyId || 'default'}` });
  if (response.success && response.data?.markAppointmentNoShow?.success) revalidatePath('/dashboard/platform/booking');
  return response.data?.markAppointmentNoShow || { success: false, error: response.error || 'Unable to mark no-show.' };
}

// Forward status flow only. Cancellation goes through manageStaffAppointmentAction
// (reason + change history) and no-shows through markAppointmentNoShowAction.
export type ForwardAppointmentStatus = Extract<AppointmentStatus, 'confirmed' | 'checked_in' | 'in_chair' | 'completed'>;
const FORWARD_STATUSES: ForwardAppointmentStatus[] = ['confirmed', 'checked_in', 'in_chair', 'completed'];

export async function updateAppointmentStatus(id: string, status: ForwardAppointmentStatus) {
  if (!FORWARD_STATUSES.includes(status)) return { success: false, error: 'Use Change to cancel an appointment, or No-show to record a no-show.' };
  const query = `
    mutation TransitionAppointment($id: ID!, $status: String!, $idempotencyKey: String!) {
      transitionAppointment(appointmentId: $id, toStatus: $status, idempotencyKey: $idempotencyKey) {
        success
        error
        appointment { id status paymentStatus updatedAt }
      }
    }
  `;

  const response = await keystoneClient(query, {
    id,
    status,
    idempotencyKey: `platform:${id}:${status}`,
  });

  const result = response.data?.transitionAppointment;
  if (response.success && result?.success) {
    revalidatePath('/dashboard/platform/booking');
    revalidatePath('/dashboard/appointments');
  }

  return result ?? { success: false, error: response.error || 'Unable to update appointment.' };
}

export type StaffBookingInput = {
  customerId?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerPhone?: string;
  customerEmail?: string;
  serviceId: string;
  barberId: string;
  startsAt: string;
  notes?: string;
  source?: 'phone' | 'staff' | 'walk_in';
  waitlistEntryId?: string;
};

export async function createStaffAppointmentAction(input: StaffBookingInput, idempotencyKey: string): Promise<CommandResult> {
  if (!idempotencyKey) return { success: false, error: 'Request key is missing. Reload and try again.' };
  const response = await keystoneClient<{ createStaffAppointment: CommandResult }>(`
    mutation CreateStaffAppointment($customerId: ID, $firstName: String, $lastName: String, $phone: String, $email: String, $serviceId: ID!, $barberId: ID!, $startsAt: String!, $notes: String, $source: String, $waitlistEntryId: ID, $key: String!) {
      createStaffAppointment(customerId: $customerId, customerFirstName: $firstName, customerLastName: $lastName, customerPhone: $phone, customerEmail: $email, serviceId: $serviceId, barberId: $barberId, startsAt: $startsAt, notes: $notes, source: $source, waitlistEntryId: $waitlistEntryId, idempotencyKey: $key) { success error data }
    }
  `, {
    customerId: input.customerId || null, firstName: input.customerFirstName || null, lastName: input.customerLastName || null,
    phone: input.customerPhone || null, email: input.customerEmail || null, serviceId: input.serviceId, barberId: input.barberId,
    startsAt: input.startsAt, notes: input.notes || null, source: input.source || 'staff', waitlistEntryId: input.waitlistEntryId || null, key: idempotencyKey,
  });
  const result = response.data?.createStaffAppointment;
  if (response.success && result?.success) {
    revalidatePath('/dashboard/platform/booking');
    revalidatePath('/dashboard/platform/barbershop');
  }
  return result ?? { success: false, error: response.error || 'Unable to book this appointment.' };
}

export async function manageStaffAppointmentAction(input: { appointmentId: string; action: 'cancel' | 'reschedule'; startsAt?: string; barberId?: string; reason: string }, idempotencyKey: string): Promise<CommandResult> {
  if (!idempotencyKey) return { success: false, error: 'Request key is missing. Reload and try again.' };
  const response = await keystoneClient<{ manageStaffAppointment: CommandResult }>(`
    mutation ManageStaffAppointment($appointmentId: ID!, $action: String!, $startsAt: String, $barberId: ID, $reason: String!, $key: String!) {
      manageStaffAppointment(appointmentId: $appointmentId, action: $action, startsAt: $startsAt, barberId: $barberId, reason: $reason, idempotencyKey: $key) { success error data }
    }
  `, { appointmentId: input.appointmentId, action: input.action, startsAt: input.startsAt || null, barberId: input.barberId || null, reason: input.reason, key: idempotencyKey });
  const result = response.data?.manageStaffAppointment;
  if (response.success && result?.success) {
    revalidatePath('/dashboard/platform/booking');
    revalidatePath('/dashboard/appointments');
  }
  return result ?? { success: false, error: response.error || 'Unable to change this appointment.' };
}

export type CustomerMatch = { id: string; firstName?: string | null; lastName?: string | null; phone?: string | null; email?: string | null };

export async function searchBookingCustomersAction(search: string): Promise<{ success: boolean; error?: string | null; customers: CustomerMatch[] }> {
  const term = search.trim().slice(0, 120);
  if (term.length < 2) return { success: true, customers: [] };
  const response = await keystoneClient<{ customers: CustomerMatch[] | null }>(`
    query BookingCustomerSearch($term: String!) {
      customers(
        where: { OR: [{ firstName: { contains: $term, mode: insensitive } }, { lastName: { contains: $term, mode: insensitive } }, { phone: { contains: $term } }, { email: { contains: $term, mode: insensitive } }] }
        orderBy: [{ lastVisitAt: desc }, { id: asc }]
        take: 10
      ) { id firstName lastName phone email }
    }
  `, { term }, { cache: 'no-store' });
  if (!response.success) return { success: false, error: response.error || 'Customer search unavailable.', customers: [] };
  return { success: true, customers: response.data?.customers || [] };
}
