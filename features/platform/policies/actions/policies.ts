'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { activeShop } from '@/features/platform/lib/activeShop';
import { dollarsToCents, platformRequest, trimmed } from '@/features/platform/lib/platformRequest';

export type BookingPolicyRow = {
  id: string; name: string; version: string; status: string; jurisdictionCode: string; effectiveFrom: string; effectiveUntil: string | null;
  cancellationWindowMinutes: number; rescheduleWindowMinutes: number; lateCancellationFeeAmount: number; rescheduleFeeAmount: number;
  depositCancellationRule: string; publicServiceEligibility: string; maxCustomerReschedules: number | null;
};
export type NoShowPolicyRow = { id: string; name: string; status: string; feeAmount: number; graceMinutes: number; appliesToMemberships: boolean; description: string | null; eventsCount: number };
export type PoliciesData = { shopName: string; timezone: string; jurisdictionCode: string; booking: BookingPolicyRow[]; noShow: NoShowPolicyRow[]; now: number };

const BOOKING_FIELDS = 'id name version status jurisdictionCode effectiveFrom effectiveUntil cancellationWindowMinutes rescheduleWindowMinutes lateCancellationFeeAmount rescheduleFeeAmount depositCancellationRule publicServiceEligibility maxCustomerReschedules';

export async function getPoliciesAction(): Promise<PoliciesData | null> {
  const shop = await activeShop();
  if (!shop) return null;
  const result = await platformRequest<{ shop: { timezone: string | null; jurisdictionCode: string | null } | null; bookingPolicies: BookingPolicyRow[]; noShowPolicies: NoShowPolicyRow[] }>(`
    query($shop: ID!) {
      shop(where: { id: $shop }) { timezone jurisdictionCode }
      bookingPolicies(where: { shop: { id: { equals: $shop } } }, orderBy: [{ effectiveFrom: desc }], take: 50) { ${BOOKING_FIELDS} }
      noShowPolicies(where: { shop: { id: { equals: $shop } } }, orderBy: [{ name: asc }]) { id name status feeAmount graceMinutes appliesToMemberships description eventsCount }
    }`, { shop: shop.id });
  const now = Date.now();
  if (!result.ok) return { shopName: shop.name, timezone: 'UTC', jurisdictionCode: '', booking: [], noShow: [], now };
  return { shopName: shop.name, timezone: result.data.shop?.timezone || 'UTC', jurisdictionCode: result.data.shop?.jurisdictionCode || '', booking: result.data.bookingPolicies, noShow: result.data.noShowPolicies, now };
}

const refresh = () => { revalidatePath('/dashboard/platform/policies'); revalidatePath('/dashboard/platform/services'); revalidatePath('/book'); };

/**
 * Publishes the next booking policy version. Versions are immutable, so the
 * current one is given an end a minute from now and the new one starts then:
 * bookings always have exactly one policy in force.
 */
export async function publishBookingPolicyAction(form: FormData) {
  const shop = await activeShop();
  const data = await getPoliciesAction();
  if (!shop || !data) return { success: false, error: 'Select an active shop first.' };
  const hours = (key: string) => Math.round(Number(form.get(key) || 0) * 60);
  const cancellationWindowMinutes = hours('cancellationHours');
  const rescheduleWindowMinutes = hours('rescheduleHours');
  const lateCancellationFeeAmount = dollarsToCents(form.get('lateCancellationFee'));
  const rescheduleFeeAmount = dollarsToCents(form.get('rescheduleFee'));
  const maxCustomerReschedules = Math.floor(Number(form.get('maxCustomerReschedules') || 0));
  const depositCancellationRule = String(form.get('depositCancellationRule') || 'manual_review');
  const publicServiceEligibility = String(form.get('publicServiceEligibility') || 'active_catalog');
  const jurisdictionCode = trimmed(form.get('jurisdictionCode'), 20).toUpperCase() || data.jurisdictionCode;
  if ([cancellationWindowMinutes, rescheduleWindowMinutes].some((value) => !(value >= 0 && value <= 60 * 24 * 30))) return { success: false, error: 'Windows must be 0 to 720 hours.' };
  if ([lateCancellationFeeAmount, rescheduleFeeAmount].some((value) => !(value >= 0 && value <= 100000))) return { success: false, error: 'Enter valid fees.' };
  if (!(maxCustomerReschedules >= 0 && maxCustomerReschedules <= 20)) return { success: false, error: 'Reschedules must be 0 to 20.' };
  if (!['refund', 'forfeit', 'manual_review'].includes(depositCancellationRule) || !['legacy_active_service', 'active_catalog'].includes(publicServiceEligibility)) return { success: false, error: 'Choose valid options.' };
  if (!jurisdictionCode) return { success: false, error: 'Enter the jurisdiction, for example US-NY.' };

  const switchAt = new Date(Date.now() + 60_000);
  const current = data.booking.filter((policy) => policy.status === 'active' && (!policy.effectiveUntil || new Date(policy.effectiveUntil) > switchAt));
  for (const policy of current) {
    if (policy.effectiveUntil) continue;
    const closed = await platformRequest(`mutation($id: ID!, $until: DateTime!) { updateBookingPolicy(where: { id: $id }, data: { effectiveUntil: $until }) { id } }`, { id: policy.id, until: switchAt.toISOString() });
    if (!closed.ok) return { success: false, error: closed.error };
  }
  const version = `${switchAt.toISOString().slice(0, 10)}.${data.booking.length + 1}`;
  const terms = { cancellationWindowMinutes, rescheduleWindowMinutes, lateCancellationFeeAmount, rescheduleFeeAmount, depositCancellationRule, publicServiceEligibility, maxCustomerReschedules };
  const created = await platformRequest(`mutation($data: BookingPolicyCreateInput!) { createBookingPolicy(data: $data) { id } }`, { data: {
    ...terms, shop: { connect: { id: shop.id } }, name: trimmed(form.get('name'), 120) || 'Booking policy', version, jurisdictionCode, status: 'active',
    effectiveFrom: (current.length ? switchAt : new Date()).toISOString(),
    policyTextHash: createHash('sha256').update(JSON.stringify({ version, jurisdictionCode, ...terms })).digest('hex'),
  } });
  if (!created.ok) return { success: false, error: created.error };
  refresh();
  return { success: true };
}

export async function retireBookingPolicyAction(id: string) {
  const result = await platformRequest(`mutation($id: ID!) { updateBookingPolicy(where: { id: $id }, data: { status: retired }) { id } }`, { id });
  if (!result.ok) return { success: false, error: result.error };
  refresh();
  return { success: true };
}

export async function saveNoShowPolicyAction(id: string | null, form: FormData) {
  const shop = await activeShop();
  if (!shop) return { success: false, error: 'Select an active shop first.' };
  const name = trimmed(form.get('name'), 120);
  const graceMinutes = Math.floor(Number(form.get('graceMinutes') || 0));
  const feeAmount = dollarsToCents(form.get('fee'));
  if (!name) return { success: false, error: 'Enter a policy name.' };
  if (!(graceMinutes >= 0 && graceMinutes <= 240)) return { success: false, error: 'Grace period must be 0 to 240 minutes.' };
  if (!(feeAmount >= 0 && feeAmount <= 100000)) return { success: false, error: 'Enter a valid fee.' };
  const data = { name, graceMinutes, feeAmount, appliesToMemberships: form.get('appliesToMemberships') === 'on', description: trimmed(form.get('description'), 1000) };
  const result = id
    ? await platformRequest(`mutation($id: ID!, $data: NoShowPolicyUpdateInput!) { updateNoShowPolicy(where: { id: $id }, data: $data) { id } }`, { id, data })
    : await platformRequest(`mutation($data: NoShowPolicyCreateInput!) { createNoShowPolicy(data: $data) { id } }`, { data: { ...data, status: 'active', shop: { connect: { id: shop.id } } } });
  if (!result.ok) return { success: false, error: result.error };
  refresh();
  return { success: true };
}

export async function setNoShowPolicyStatusAction(id: string, status: string) {
  if (!['active', 'paused', 'archived'].includes(status)) return { success: false, error: 'Choose a status.' };
  const result = await platformRequest(`mutation($id: ID!, $status: NoShowPolicyStatusType) { updateNoShowPolicy(where: { id: $id }, data: { status: $status }) { id } }`, { id, status });
  if (!result.ok) return { success: false, error: result.error };
  refresh();
  return { success: true };
}
