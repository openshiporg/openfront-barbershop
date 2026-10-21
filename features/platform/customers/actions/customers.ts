'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export type CustomerStatus = 'active' | 'vip' | 'needs_attention' | 'blocked';

export type CustomerAppointmentSummary = {
  id: string;
  startsAt?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
  price?: number | null;
  durationMinutes?: number | null;
  // Accepted snapshots captured at booking; never replaced by live catalog names.
  serviceTitleSnapshot?: string | null;
  barberNameSnapshot?: string | null;
  transaction?: { id: string; total?: number | null; formattedTotal?: string | null; paymentMethod?: string | null; completedAt?: string | null } | null;
};

export type CustomerNoteSummary = {
  id: string;
  noteType?: string | null;
  body?: string | null;
  visibility?: string | null;
  createdAt?: string | null;
  appointment?: { id: string; startsAt?: string | null; serviceTitleSnapshot?: string | null } | null;
};

export type CustomerPackageSummary = {
  id: string;
  remainingVisits?: number | null;
  status?: string | null;
  expiresAt?: string | null;
  nextBillingAt?: string | null;
  autoRenew?: boolean | null;
  servicePackage?: { id: string; name?: string | null } | null;
  membershipPlan?: { id: string; name?: string | null; billingInterval?: string | null; price?: number | null; includedVisits?: number | null } | null;
};

export type CustomerTransactionSummary = {
  id: string;
  status?: string | null;
  total?: number | null;
  formattedTotal?: string | null;
  paymentMethod?: string | null;
  completedAt?: string | null;
};

export type CustomerHistoryItem = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: CustomerStatus | null;
  preferredContactMethod?: string | null;
  acceptsMarketing?: boolean | null;
  lastVisitAt?: string | null;
  preferredBarber?: { id: string; displayName?: string | null; chairNumber?: string | null } | null;
  appointments?: CustomerAppointmentSummary[] | null;
  notes?: CustomerNoteSummary[] | null;
  packageBalances?: CustomerPackageSummary[] | null;
  transactions?: CustomerTransactionSummary[] | null;
  waivers?: Array<{ id: string; title: string; waiverType: string; status: string; signedAt?: string | null; createdAt?: string | null }> | null;
};

export type MembershipPlanSummary = { id: string; name: string; price: number; includedVisits: number; billingInterval: string };

export type ServicePackageSummary = { id: string; name: string; price: number; visits: number };

export type RelationAccess = 'granted' | 'restricted';

// Relations governed by other Lists are null (never fabricated zeros/empties) when
// the operator lacks current same-shop authority for them.
export type CustomersProjectionData = {
  timeZone: string;
  page: number;
  pageSize: number;
  total: number;
  requestedCustomerId: string | null;
  historyPreviewLimit: number;
  customers: CustomerHistoryItem[];
  membershipPlans: MembershipPlanSummary[] | null;
  membershipPlansTruncated: boolean;
  // Active packages for sale; null without membership authority.
  servicePackages?: ServicePackageSummary[] | null;
  servicePackagesTruncated?: boolean;
  counts: Record<string, number>;
  packageHolders: number | null;
  notesCount: number | null;
  notesAccess: RelationAccess;
  appointmentsAccess: RelationAccess;
  paymentsAccess: RelationAccess;
  membershipsAccess: RelationAccess;
  // Preferred barber is staff-read governed; null when restricted.
  staffAccess: RelationAccess;
};

export type CustomersLoadResult =
  | { success: true; data: CustomersProjectionData }
  | { success: false; kind: 'forbidden' | 'unavailable'; error: string };

function isForbidden(message?: string | null) {
  return /not authorized|permission|revoked|active shop|select exactly one/i.test(message || '');
}

export async function getCustomerHistoryData(input: { search?: string; page?: number; customerId?: string; planSearch?: string } = {}): Promise<CustomersLoadResult> {
  const response = await keystoneClient<{ platformCustomers: { success: boolean; error?: string | null; data?: CustomersProjectionData | null } }>(`
    query CustomersProjection($search: String, $page: Int, $customerId: ID, $planSearch: String) {
      platformCustomers(search: $search, page: $page, customerId: $customerId, planSearch: $planSearch) { success error data }
    }
  `, { search: input.search?.trim() || '', page: input.page || 1, customerId: input.customerId || null, planSearch: input.planSearch?.trim() || null }, { cache: 'no-store' });
  const result = response.data?.platformCustomers;
  if (!response.success || !result?.success || !result.data) {
    const error = result?.error || response.error || 'Customer records are unavailable.';
    return { success: false, kind: isForbidden(error) ? 'forbidden' : 'unavailable', error };
  }
  return { success: true, data: result.data };
}

export type CustomerCommandResult<T = Record<string, unknown>> = { success: boolean; error: string | null; data: T | null };

// The resolver's own success/error is the outcome; transport success alone is not.
async function runCommand<T>(operation: string, query: string, variables: Record<string, unknown>, paths: string[]): Promise<CustomerCommandResult<T>> {
  const response = await keystoneClient<Record<string, { success: boolean; error?: string | null; data?: T | null }>>(query, variables);
  const result = response.data?.[operation];
  if (!response.success || !result) {
    return { success: false, error: response.error || 'Connection interrupted. The change may have completed; retry to confirm with the same request.', data: null };
  }
  if (!result.success) return { success: false, error: result.error || 'The change was not saved.', data: null };
  for (const path of paths) revalidatePath(path);
  return { success: true, error: null, data: result.data ?? null };
}

export async function addCustomerNoteAction(input: {
  customerId: string;
  body: string;
  noteType?: string;
  visibility?: string;
  appointmentId?: string;
  idempotencyKey: string;
}) {
  return runCommand<{ id?: string; body?: string }>('addCustomerNote', `
    mutation AddCustomerNote($customerId: ID!, $body: String!, $noteType: String, $visibility: String, $appointmentId: ID, $key: String!) {
      addCustomerNote(customerId: $customerId, body: $body, noteType: $noteType, visibility: $visibility, appointmentId: $appointmentId, idempotencyKey: $key) { success error data }
    }
  `, { customerId: input.customerId, body: input.body, noteType: input.noteType, visibility: input.visibility, appointmentId: input.appointmentId, key: input.idempotencyKey }, ['/dashboard/platform/customers', '/dashboard/customer-notes']);
}

export async function manageMembershipAction(input: {
  action: 'purchase' | 'purchase_package' | 'renew' | 'pause' | 'resume' | 'cancel';
  customerId: string;
  membershipPlanId?: string;
  servicePackageId?: string;
  customerPackageId?: string;
  paymentMethod?: string;
  idempotencyKey: string;
}) {
  return runCommand<{ id?: string; status?: string }>('manageMembership', `
    mutation ManageMembership($action: String!, $customerId: ID, $planId: ID, $packageId: ID, $balanceId: ID, $paymentMethod: String, $key: String!) {
      manageMembership(action: $action, customerId: $customerId, membershipPlanId: $planId, servicePackageId: $packageId, customerPackageId: $balanceId, paymentMethod: $paymentMethod, idempotencyKey: $key) { success error data }
    }
  `, { action: input.action, customerId: input.customerId, planId: input.membershipPlanId, packageId: input.servicePackageId, balanceId: input.customerPackageId, paymentMethod: input.paymentMethod || 'cash', key: input.idempotencyKey }, ['/dashboard/platform/customers']);
}

export async function setCustomerConsentAction(input: { customerId: string; acceptsMarketing: boolean; preferredContactMethod: string; idempotencyKey: string }) {
  return runCommand<{ id?: string; acceptsMarketing?: boolean; preferredContactMethod?: string }>('setCustomerConsent', `mutation Consent($customerId: ID!, $acceptsMarketing: Boolean!, $method: String, $key: String!) { setCustomerConsent(customerId: $customerId, acceptsMarketing: $acceptsMarketing, preferredContactMethod: $method, idempotencyKey: $key) { success error data } }`, { customerId: input.customerId, acceptsMarketing: input.acceptsMarketing, method: input.preferredContactMethod, key: input.idempotencyKey }, ['/dashboard/platform/customers']);
}

export async function issueCustomerWaiverAction(input: { customerId: string; title: string; waiverType: string; deliveryStatus: 'draft'; idempotencyKey: string }) {
  return runCommand<{ id?: string; status?: string }>('issueCustomerWaiver', `mutation Waiver($customerId: ID!, $title: String!, $type: String, $status: String, $key: String!) { issueCustomerWaiver(customerId: $customerId, title: $title, waiverType: $type, deliveryStatus: $status, idempotencyKey: $key) { success error data } }`, { customerId: input.customerId, title: input.title, type: input.waiverType, status: input.deliveryStatus, key: input.idempotencyKey }, ['/dashboard/platform/customers']);
}

export async function updateCustomerStatusAction(input: { customerId: string; status: string; idempotencyKey: string }) {
  return runCommand<{ id?: string; status?: string }>('setCustomerStatus', `
    mutation SetCustomerStatus($id: ID!, $status: String!, $key: String!) {
      setCustomerStatus(customerId: $id, status: $status, idempotencyKey: $key) { success error data }
    }
  `, { id: input.customerId, status: input.status, key: input.idempotencyKey }, ['/dashboard/platform/customers', '/dashboard/customers']);
}
