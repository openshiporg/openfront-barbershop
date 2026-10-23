'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import type { QueueLoadResult, QueueStatus } from '../lib/queueTypes';
import { normalizeQueueResponse } from '../lib/normalizeQueueResponse';

export type QueueServiceSummary = {
  id: string;
  name?: string | null;
  durationMinutes?: number | null;
  price?: number | null;
};

export type QueueEntry = {
  id: string;
  customerName?: string | null;
  phone?: string | null;
  partySize?: number | null;
  status?: QueueStatus | null;
  quotedWaitMinutes?: number | null;
  checkedInAt?: string | null;
  seatedAt?: string | null;
  notes?: string | null;
  requestedService?: QueueServiceSummary | null;
  requestedBarber?: { id: string; displayName?: string | null; chairNumber?: string | null } | null;
  appointment?: { id: string; status?: string | null; startsAt?: string | null; serviceTitleSnapshot?: string | null; barberNameSnapshot?: string | null } | null;
  customer?: { id: string; firstName?: string | null; lastName?: string | null; phone?: string | null } | null;
};

export type QueueServiceOption = QueueServiceSummary & { specialistIds: string[] };
export type QueueBarberOption = { id: string; displayName?: string | null; chairNumber?: string | null };

export type QueueProjectionData = {
  active: QueueEntry[];
  served: QueueEntry[];
  counts: Record<string, number>;
  activeTotal: number;
  timeZone?: string | null;
  activeMatching: number;
  search: string;
  page: number;
  pageSize: number;
  hasMoreActive: boolean;
  services: QueueServiceOption[];
  barbers: QueueBarberOption[];
};

type CommandResult = { success: boolean; error?: string | null; data?: Record<string, unknown> | null };

export async function getQueueData(input: { search?: string; page?: number } = {}): Promise<QueueLoadResult<QueueProjectionData>> {
  const response = await keystoneClient<{ platformQueue: { success: boolean; error?: string | null; data?: QueueProjectionData | null } }>(`
    query QueueProjection($search: String, $page: Int) { platformQueue(search: $search, page: $page) { success error data } }
  `, { search: input.search || null, page: input.page || 1 }, { cache: 'no-store' });
  return normalizeQueueResponse(response);
}

export async function updateQueueEntryStatus(id: string, status: QueueStatus) {
  const query = `
    mutation TransitionQueueEntry($id: ID!, $status: String!, $idempotencyKey: String!) {
      transitionQueueEntry(queueEntryId: $id, toStatus: $status, idempotencyKey: $idempotencyKey) {
        success
        error
        queueEntry { id status updatedAt }
      }
    }
  `;

  const response = await keystoneClient(query, {
    id,
    status,
    idempotencyKey: `platform:${id}:${status}`,
  });
  const result = response.data?.transitionQueueEntry;
  if (response.success && result?.success) {
    revalidatePath('/dashboard/platform/queue');
    revalidatePath('/dashboard/walk-in-queue-entries');
  }
  return result ?? { success: false, error: response.error || 'Unable to update the queue entry.' };
}

export async function createAppointmentFromQueue(entry: QueueEntry) {
  if (!entry?.id) {
    return { success: false as const, error: 'Queue entry is required.' };
  }

  const query = `
    mutation SeatWalkIn($queueEntryId: ID!) {
      seatWalkInQueueEntry(queueEntryId: $queueEntryId) {
        success
        error
        seated { queueEntryId appointmentId status startsAt barberId chairNumber }
      }
    }
  `;
  const response = await keystoneClient(query, { queueEntryId: entry.id });
  const result = response.data?.seatWalkInQueueEntry;

  if (response.success && result?.success) {
    revalidatePath('/dashboard/platform/queue');
    revalidatePath('/dashboard/platform/booking');
    revalidatePath('/dashboard/appointments');
  }

  return result ?? { success: false, error: response.error || 'Unable to seat this walk-in.' };
}

export async function createStaffQueueEntryAction(input: { customerName: string; phone?: string; partySize: number; requestedServiceId?: string; requestedBarberId?: string; notes?: string; quotedWaitMinutes: number | null }, idempotencyKey: string): Promise<CommandResult> {
  if (!idempotencyKey) return { success: false, error: 'Request key is missing. Reload and try again.' };
  const response = await keystoneClient<{ createStaffQueueEntry: CommandResult }>(`
    mutation CreateStaffQueueEntry($name: String!, $phone: String, $partySize: Int, $serviceId: ID, $barberId: ID, $notes: String, $wait: Int, $key: String!) {
      createStaffQueueEntry(customerName: $name, phone: $phone, partySize: $partySize, requestedServiceId: $serviceId, requestedBarberId: $barberId, notes: $notes, quotedWaitMinutes: $wait, idempotencyKey: $key) { success error data }
    }
  `, { name: input.customerName, phone: input.phone || null, partySize: input.partySize, serviceId: input.requestedServiceId || null, barberId: input.requestedBarberId || null, notes: input.notes || null, wait: input.quotedWaitMinutes, key: idempotencyKey });
  const result = response.data?.createStaffQueueEntry;
  if (response.success && result?.success) revalidatePath('/dashboard/platform/queue');
  return result ?? { success: false, error: response.error || 'Unable to add this walk-in.' };
}

export async function assignQueueEntryAction(input: { queueEntryId: string; requestedServiceId: string; requestedBarberId?: string }, idempotencyKey: string): Promise<CommandResult> {
  if (!idempotencyKey) return { success: false, error: 'Request key is missing. Reload and try again.' };
  const response = await keystoneClient<{ assignWalkInQueueEntry: CommandResult }>(`
    mutation AssignWalkIn($id: ID!, $serviceId: ID!, $barberId: ID, $key: String!) {
      assignWalkInQueueEntry(queueEntryId: $id, requestedServiceId: $serviceId, requestedBarberId: $barberId, idempotencyKey: $key) { success error data }
    }
  `, { id: input.queueEntryId, serviceId: input.requestedServiceId, barberId: input.requestedBarberId || null, key: idempotencyKey });
  const result = response.data?.assignWalkInQueueEntry;
  if (response.success && result?.success) revalidatePath('/dashboard/platform/queue');
  return result ?? { success: false, error: response.error || 'Unable to update this walk-in.' };
}
