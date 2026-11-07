/**
 * Shop, Service, ServiceCategory, Barber, BarberChair, Customer, ServicePackage, MembershipPlan,
 * Product, Supplier and PaymentProvider are archive-only: enforceRelationshipBoundaries denies their
 * delete operation outright. The lists below can still be deleted, and their history is ON DELETE
 * SET NULL, so a delete would quietly detach it: charged no-shows would lose the policy they were
 * charged under, and people would lose their role. Those deletes are refused while history exists;
 * a record nothing points at can still be deleted. `tests/invariants.test.ts` checks every entry
 * against the Prisma schema.
 */
type Ref = { model: string; field: string; one: string; many: string };
const ref = (model: string, field: string, one: string, many = `${one}s`): Ref => ({ model, field, one, many });

export const DELETE_HISTORY: Record<string, { references: Ref[]; instead: string }> = {
  NoShowPolicy: {
    instead: 'Archive the policy instead; charged no-shows keep the policy they were charged under.',
    references: [ref('noShowEvent', 'policyId', 'no-show charge')],
  },
  Role: {
    instead: 'Give them another role first.',
    references: [ref('user', 'roleId', 'person still has', 'people still have')],
  },
  User: {
    instead: 'Remove their shop access instead of deleting the account.',
    references: [
      ref('barber', 'userId', 'barber profile'),
      ref('customer', 'userId', 'customer profile'),
      ref('appointment', 'accountId', 'booked appointment'),
      ref('shopMembership', 'userId', 'shop membership'),
    ],
  },
};

export async function deleteHistoryProblem(prisma: any, listKey: string, id: string) {
  const rule = DELETE_HISTORY[listKey];
  if (!rule) return null;
  const counts = await Promise.all(rule.references.map(r => prisma[r.model].count({ where: { [r.field]: id } })));
  const found = rule.references.map((r, i) => counts[i] ? `${counts[i]} ${counts[i] === 1 ? r.one : r.many}` : '').filter(Boolean);
  if (!found.length) return null;
  return listKey === 'Role' ? `${found.join(', ')} this role. ${rule.instead}` : `This has ${found.join(', ')}. ${rule.instead}`;
}

/** For `hooks.validate.delete` (or `validateDelete`). */
export function historyDeleteGuard(listKey: string) {
  return async ({ item, context, addValidationError }: any) => {
    if (listKey === 'User' && String(item.id) === String(context.session?.itemId || '')) {
      addValidationError('You can’t delete your own account.');
      return;
    }
    const problem = await deleteHistoryProblem(context.prisma, listKey, String(item.id));
    if (problem) addValidationError(problem);
  };
}
