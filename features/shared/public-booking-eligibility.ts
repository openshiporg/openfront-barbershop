export type PublicServiceEligibility = 'legacy_active_service' | 'active_catalog';

export type PublicBookingEligibility = {
  policyId: string;
  version: string;
  publicServiceEligibility: PublicServiceEligibility;
  description: string;
};

// Missing values in historical immutable policy rows/snapshots retain the original
// direct-booking contract. Unknown values must never turn into a broader grant.
export function parsePublicServiceEligibility(value: unknown): PublicServiceEligibility {
  if (value == null) return 'legacy_active_service';
  if (value === 'legacy_active_service' || value === 'active_catalog') return value;
  throw new Error('Public service eligibility policy is invalid.');
}

export function bookingEligibilityFromSnapshot(snapshot: unknown): PublicBookingEligibility | null {
  if (!snapshot || typeof snapshot !== 'object' || !('policyId' in snapshot) || !('version' in snapshot)
    || typeof snapshot.policyId !== 'string' || typeof snapshot.version !== 'string') return null;
  try {
    return publicBookingEligibilityView({ policyId: snapshot.policyId, version: snapshot.version,
      publicServiceEligibility: 'publicServiceEligibility' in snapshot ? snapshot.publicServiceEligibility : null });
  } catch { return null; }
}

export function publicBookingEligibilityView(policy: { policyId: string; version: string; publicServiceEligibility?: unknown }): PublicBookingEligibility {
  const publicServiceEligibility = parsePublicServiceEligibility(policy.publicServiceEligibility);
  return {
    policyId: policy.policyId,
    version: policy.version,
    publicServiceEligibility,
    description: publicServiceEligibility === 'active_catalog'
      ? 'Online requests require an active service in an active category belonging to this shop.'
      : 'The menu shows active categories only. Direct online requests may use other active shop services; staff, chair, and authority checks still apply.',
  };
}
