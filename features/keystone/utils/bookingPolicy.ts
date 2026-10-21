import { parsePublicServiceEligibility, publicBookingEligibilityView, type PublicServiceEligibility } from '../../shared/public-booking-eligibility';

export type BookingPolicySnapshot = {
  policyId: string;
  name: string;
  version: string;
  jurisdictionCode: string;
  policyTextHash: string;
  cancellationWindowMinutes: number;
  rescheduleWindowMinutes: number;
  lateCancellationFeeAmount: number;
  rescheduleFeeAmount: number;
  depositCancellationRule: 'refund' | 'forfeit' | 'manual_review';
  maxCustomerReschedules: number;
  publicServiceEligibility?: PublicServiceEligibility;
  effectiveFrom: string;
  effectiveUntil: string | null;
};

type PolicyRow = {
  id: string;
  name: string;
  version: string;
  jurisdictionCode: string;
  policyTextHash: string;
  cancellationWindowMinutes: number;
  rescheduleWindowMinutes: number;
  lateCancellationFeeAmount: number;
  rescheduleFeeAmount: number;
  publicServiceEligibility?: unknown;
  depositCancellationRule: BookingPolicySnapshot['depositCancellationRule'];
  maxCustomerReschedules: number;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
};

type RawQueryClient = { $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T> };

export async function requireEffectiveBookingPolicy(client: RawQueryClient, input: { shopId: string; at: Date }) {
  const rows = await client.$queryRawUnsafe<PolicyRow[]>(`
    SELECT policy.* FROM "BookingPolicy" policy
    JOIN "Shop" shop ON shop.id = policy."shop" AND shop."jurisdictionCode" = policy."jurisdictionCode"
    WHERE policy."shop" = $1 AND policy.status = 'active'
      AND policy."effectiveFrom" <= $2
      AND (policy."effectiveUntil" IS NULL OR policy."effectiveUntil" > $2)
    ORDER BY policy."effectiveFrom" DESC, policy."createdAt" DESC
    LIMIT 2
  `, input.shopId, input.at);
  const policy = rows[0];
  if (rows.length > 1) throw new Error('Multiple booking policies are effective; online requests and customer changes are disabled until the conflict is resolved.');
  if (!policy?.policyTextHash || !policy.jurisdictionCode || !policy.version) {
    throw new Error('An effective jurisdiction-matched booking policy is required.');
  }
  return {
    policyId: policy.id,
    name: policy.name,
    version: policy.version,
    jurisdictionCode: policy.jurisdictionCode,
    policyTextHash: policy.policyTextHash,
    publicServiceEligibility: parsePublicServiceEligibility(policy.publicServiceEligibility),
    cancellationWindowMinutes: Math.max(0, policy.cancellationWindowMinutes),
    rescheduleWindowMinutes: Math.max(0, policy.rescheduleWindowMinutes),
    lateCancellationFeeAmount: Math.max(0, policy.lateCancellationFeeAmount),
    rescheduleFeeAmount: Math.max(0, policy.rescheduleFeeAmount),
    depositCancellationRule: policy.depositCancellationRule,
    maxCustomerReschedules: Math.max(0, policy.maxCustomerReschedules),
    effectiveFrom: policy.effectiveFrom.toISOString(),
    effectiveUntil: policy.effectiveUntil?.toISOString() || null,
  } satisfies BookingPolicySnapshot;
}

export async function getBookingEligibilityProjection(client: RawQueryClient, shopId: string) {
  try {
    const policy = await requireEffectiveBookingPolicy(client, { shopId, at: new Date() });
    return { success: true, error: null, data: publicBookingEligibilityView(policy) };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const diagnostic = message.startsWith('Multiple booking policies are effective')
      ? 'Multiple booking policies overlap. A single effective version is required. Contact the shop.'
      : message === 'Public service eligibility policy is invalid.'
        ? 'The booking eligibility option is invalid. Contact the shop.'
        : message === 'An effective jurisdiction-matched booking policy is required.'
          ? 'No effective jurisdiction-matched booking policy is configured. Contact the shop.'
          : 'Booking policy could not be loaded. Contact the shop.';
    return { success: false, error: diagnostic, data: null };
  }
}

export function appointmentChangeConsequences(input: {
  action: 'cancel' | 'reschedule';
  startsAt: Date;
  now: Date;
  paymentStatus?: string | null;
  depositAmount?: number | null;
  policy: BookingPolicySnapshot;
  priorReschedules?: number;
}) {
  const minutesUntilStart = Math.floor((input.startsAt.getTime() - input.now.getTime()) / 60_000);
  const windowMinutes = input.action === 'cancel' ? input.policy.cancellationWindowMinutes : input.policy.rescheduleWindowMinutes;
  const isLate = minutesUntilStart < windowMinutes;
  if (input.action === 'reschedule' && (input.priorReschedules || 0) >= input.policy.maxCustomerReschedules) {
    throw new Error('This appointment has reached the customer reschedule limit.');
  }
  const feeAmount = isLate
    ? (input.action === 'cancel' ? input.policy.lateCancellationFeeAmount : input.policy.rescheduleFeeAmount)
    : 0;
  const hasDeposit = input.paymentStatus === 'deposit_paid' && Number(input.depositAmount || 0) > 0;
  const depositConsequence = !hasDeposit
    ? 'none'
    : input.policy.depositCancellationRule === 'refund'
      ? 'refund_required'
      : input.policy.depositCancellationRule === 'forfeit'
        ? 'forfeiture_pending'
        : 'manual_review';
  return { isLate, feeAmount, depositConsequence, minutesUntilStart } as const;
}
