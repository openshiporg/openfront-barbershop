'use server';

import { revalidatePath } from 'next/cache';

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

type CommandResult = { success: boolean; error: string | null };

// Every command key is created by the browser for one operator intent and is
// passed through unchanged; a retry of the same intent replays the original.
async function command(name: string, query: string, variables: Record<string, unknown>, paths: string[]): Promise<CommandResult> {
  if (typeof variables.key !== 'string' || variables.key.length < 8) return { success: false, error: 'A command key is required.' };
  const response = await keystoneClient<Record<string, { success: boolean; error?: string | null } | undefined>>(query, variables);
  const result = response.data?.[name];
  if (!response.success || !result) return { success: false, error: response.error || 'Unable to complete this action.' };
  if (result.success) paths.forEach((path) => revalidatePath(path));
  return { success: Boolean(result.success), error: result.error || null };
}

export async function transitionCommissionAction(commissionId: string, toStatus: 'approved' | 'voided', key: string) {
  return command('transitionCommission', `mutation TransitionCommission($id: ID!, $status: String!, $key: String!) { transitionCommission(commissionId: $id, toStatus: $status, idempotencyKey: $key) { success error data } }`, { id: commissionId, status: toStatus, key }, ['/dashboard/platform/barbershop']);
}

export async function payCommissionAction(commissionId: string, payoutReference: string, key: string) {
  return command('payApprovedCommissions', `mutation PayCommissions($ids: [ID!]!, $notes: String, $key: String!) { payApprovedCommissions(commissionIds: $ids, notes: $notes, idempotencyKey: $key) { success error data } }`, { ids: [commissionId], notes: payoutReference.trim(), key }, ['/dashboard/platform/barbershop', '/dashboard/platform/reports']);
}

export async function manageWaitlistAction(input: { action: 'create' | 'notify' | 'expire'; waitlistEntryId?: string; customerName?: string; phone?: string; requestedServiceId?: string; requestedBarberId?: string; preferredAt?: string }, key: string) {
  return command('manageWaitlist', `mutation Waitlist($action: String!, $id: ID, $name: String, $phone: String, $serviceId: ID, $barberId: ID, $preferredAt: String, $key: String!) { manageWaitlist(action: $action, waitlistEntryId: $id, customerName: $name, phone: $phone, requestedServiceId: $serviceId, requestedBarberId: $barberId, preferredAt: $preferredAt, idempotencyKey: $key) { success error data } }`, { action: input.action, id: input.waitlistEntryId, name: input.customerName, phone: input.phone, serviceId: input.requestedServiceId || null, barberId: input.requestedBarberId || null, preferredAt: input.preferredAt || null, key }, ['/dashboard/platform/barbershop']);
}

export async function reconcilePaymentAction(paymentSessionId: string, key: string) {
  return command('reconcilePaymentSession', `mutation Reconcile($id: ID!, $key: String!) { reconcilePaymentSession(paymentSessionId: $id, idempotencyKey: $key) { success error data } }`, { id: paymentSessionId, key }, ['/dashboard/platform/barbershop', '/dashboard/platform/pos']);
}

/** "Check all with Stripe": reads every open card page past its lifetime back from Stripe now. */
export async function checkAllPaymentsAction(): Promise<{ success: boolean; error: string | null; expired: number; reconciled: number; checked: number }> {
  const response = await keystoneClient<{ expireStalePaymentSessions: { success: boolean; error?: string | null; data?: { expired?: number; reconciled?: number; checked?: number } | null } }>('mutation { expireStalePaymentSessions(force: true) { success error data } }', {});
  const result = response.data?.expireStalePaymentSessions;
  if (!response.success || !result?.success) return { success: false, error: result?.error || response.error || 'Unable to check payments.', expired: 0, reconciled: 0, checked: 0 };
  ['/dashboard/platform/payments', '/dashboard/platform/barbershop', '/dashboard/platform/pos'].forEach((path) => revalidatePath(path));
  return { success: true, error: null, expired: Number(result.data?.expired || 0), reconciled: Number(result.data?.reconciled || 0), checked: Number(result.data?.checked || 0) };
}
