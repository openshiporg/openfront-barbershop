/**
 * Everything that points at a Customer. A merge re-points each of these from the
 * duplicate to the kept record before the duplicate is removed, so no history,
 * money or consent is lost. Payment sessions hang off appointments and follow them.
 * Keep in step with schema.prisma (tests/customer-merge.test.cjs checks this).
 */
export const CUSTOMER_RELATIONS = [
  'appointment',
  'customerNote',
  'checkoutTransaction',
  'customerPackage',
  'membershipEvent',
  'noShowEvent',
  'walkInQueueEntry',
  'waiverForm',
  'groomingNote',
  'waitlistEntry',
  'tip',
] as const;

export type CustomerRelation = (typeof CUSTOMER_RELATIONS)[number];

type Row = { id: string; shopId: string; userId: string | null; lastVisitAt: Date | null; email: string; phone: string; acceptsMarketing: boolean; birthday: Date | null; preferredBarberId: string | null };

/** Fields the kept record takes from the duplicate: only blanks are filled, nothing is overwritten. */
export function mergedCustomerFields(kept: Row, duplicate: Row) {
  const data: Record<string, unknown> = {};
  if (!kept.email && duplicate.email) data.email = duplicate.email;
  if (!kept.phone && duplicate.phone) data.phone = duplicate.phone;
  if (!kept.birthday && duplicate.birthday) data.birthday = duplicate.birthday;
  if (!kept.preferredBarberId && duplicate.preferredBarberId) data.preferredBarberId = duplicate.preferredBarberId;
  if (duplicate.lastVisitAt && (!kept.lastVisitAt || duplicate.lastVisitAt > kept.lastVisitAt)) data.lastVisitAt = duplicate.lastVisitAt;
  // Marketing consent is never widened by a merge.
  if (kept.acceptsMarketing && !duplicate.acceptsMarketing) data.acceptsMarketing = false;
  if (!kept.userId && duplicate.userId) data.userId = duplicate.userId;
  return data;
}

/** Why two records can't be merged, or null. Two different signed-in accounts never merge. */
export function mergeRefusal(kept: Pick<Row, 'id' | 'shopId' | 'userId'> | null, duplicate: Pick<Row, 'id' | 'shopId' | 'userId'> | null, shopId: string) {
  if (!kept || !duplicate || kept.shopId !== shopId || duplicate.shopId !== shopId) return 'Customer not found.';
  if (kept.id === duplicate.id) return 'Choose a different customer to merge into.';
  if (kept.userId && duplicate.userId && kept.userId !== duplicate.userId) return 'These customers belong to two different online accounts and can’t be merged.';
  return null;
}
