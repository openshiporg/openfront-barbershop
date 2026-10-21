'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

type CommandResult = { success: boolean; error?: string | null };

// The command key is created by the browser before dispatch and passed through
// unchanged, so a retry of the same intent replays instead of repeating it.
async function run(query: string, variables: Record<string, unknown>): Promise<CommandResult> {
  if (typeof variables.key !== 'string' || variables.key.length < 8) return { success: false, error: 'A command key is required.' };
  const response = await keystoneClient<{ result: { success: boolean; error?: string | null; data?: unknown } }>(query, variables);
  const result = response.data?.result;
  if (!response.success || !result) return { success: false, error: response.error || 'Workforce command failed.' };
  if (result.success) revalidatePath('/dashboard/platform/staff');
  return { success: Boolean(result.success), error: result.error || null };
}

export async function scheduleShiftAction(input: { barberId: string; scheduledStart: string; scheduledEnd: string }, key: string) {
  return run(`mutation Shift($barberId: ID!, $start: String!, $end: String!, $key: String!) { result: manageStaffShift(action: "schedule", barberId: $barberId, scheduledStart: $start, scheduledEnd: $end, idempotencyKey: $key) { success error data } }`, { barberId: input.barberId, start: input.scheduledStart, end: input.scheduledEnd, key });
}

export async function transitionShiftAction(shiftId: string, action: 'clock_in' | 'clock_out' | 'cancel', key: string) {
  return run(`mutation Shift($shiftId: ID!, $action: String!, $key: String!) { result: manageStaffShift(action: $action, shiftId: $shiftId, idempotencyKey: $key) { success error data } }`, { shiftId, action, key });
}

export async function createScheduleExceptionAction(input: { barberId?: string; chairId?: string; exceptionType: 'time_off' | 'working_override' | 'shop_closure' | 'chair_unavailable'; startsAt: string; endsAt: string; reason: string }, key: string) {
  return run(`mutation Exception($barberId: ID, $chairId: ID, $type: String!, $start: String!, $end: String!, $reason: String!, $key: String!) { result: manageScheduleException(action: "create", barberId: $barberId, chairId: $chairId, exceptionType: $type, startsAt: $start, endsAt: $end, reason: $reason, idempotencyKey: $key) { success error data } }`, { barberId: input.barberId, chairId: input.chairId, type: input.exceptionType, start: input.startsAt, end: input.endsAt, reason: input.reason, key });
}

export async function cancelScheduleExceptionAction(exceptionId: string, key: string) {
  return run(`mutation Exception($id: ID!, $key: String!) { result: manageScheduleException(action: "cancel", exceptionId: $id, idempotencyKey: $key) { success error data } }`, { id: exceptionId, key });
}

export async function linkBarberAccountAction(barberId: string, userId: string | null, key: string) {
  return run(`mutation LinkBarberAccount($barberId: ID!, $userId: ID, $key: String!) { result: linkBarberAccount(barberId: $barberId, userId: $userId, idempotencyKey: $key) { success error data } }`, { barberId, userId, key });
}
