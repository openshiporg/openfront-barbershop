/**
 * Most relations here are ON DELETE SET NULL, so deleting a record that history points at would
 * quietly detach that history: appointments and commissions lose their barber, sales and packages
 * their customer, sold packages their plan. Such records are retired (inactive) instead, and a
 * record nothing points at can still be deleted. Customer merges delete through Prisma directly and
 * repoint everything first, so this list-level guard does not affect them.
 * `tests/invariants.test.ts` checks every entry against the Prisma schema.
 */
type Ref = { model: string; field: string; one: string; many: string };
const ref = (model: string, field: string, one: string, many = `${one}s`): Ref => ({ model, field, one, many });

export const DELETE_HISTORY: Record<string, { references: Ref[]; instead: string }> = {
  Barber: {
    instead: 'Set the barber to Inactive instead of deleting them.',
    references: [
      ref('appointment', 'barberId', 'appointment'),
      ref('checkoutTransaction', 'barberId', 'sale'),
      ref('commission', 'barberId', 'commission'),
      ref('commissionPayout', 'barberId', 'commission payout'),
      ref('tip', 'barberId', 'tip'),
      ref('staffShift', 'barberId', 'shift'),
      ref('groomingNote', 'barberId', 'grooming note'),
    ],
  },
  Customer: {
    instead: 'Customers with history are kept; merge duplicates instead of deleting.',
    references: [
      ref('appointment', 'customerId', 'appointment'),
      ref('checkoutTransaction', 'customerId', 'sale'),
      ref('customerPackage', 'customerId', 'package or membership', 'packages or memberships'),
      ref('tip', 'customerId', 'tip'),
      ref('noShowEvent', 'customerId', 'no-show'),
      ref('waiverForm', 'customerId', 'signed waiver'),
      ref('membershipEvent', 'customerId', 'membership event'),
    ],
  },
  Service: {
    instead: 'Archive the service instead of deleting it.',
    references: [
      ref('appointment', 'serviceId', 'appointment'),
      ref('appointmentLineItem', 'serviceId', 'appointment line', 'appointment lines'),
      ref('servicePackageItem', 'serviceId', 'package item'),
      ref('waiverForm', 'serviceId', 'signed waiver'),
    ],
  },
  ServiceCategory: {
    instead: 'Move those services to another category first.',
    references: [ref('service', 'categoryId', 'service')],
  },
  MembershipPlan: {
    instead: 'Pause or archive the plan instead so nobody new can join.',
    references: [ref('customerPackage', 'membershipPlanId', 'customer membership'), ref('membershipEvent', 'membershipPlanId', 'membership event')],
  },
  ServicePackage: {
    instead: 'Archive the package instead so it is no longer sold.',
    references: [ref('customerPackage', 'servicePackageId', 'sold package')],
  },
  BarberChair: {
    instead: 'Put the chair in Maintenance instead of deleting it.',
    references: [ref('appointment', 'chairId', 'appointment'), ref('barber', 'chairId', 'assigned barber'), ref('staffShift', 'chairId', 'shift')],
  },
  Product: {
    instead: 'Archive the product instead of deleting it.',
    references: [ref('productSaleLine', 'productId', 'sale line'), ref('inventoryLot', 'productId', 'inventory lot'), ref('inventoryMovement', 'productId', 'stock movement')],
  },
  Supplier: {
    instead: 'Keep the supplier on file for its received stock.',
    references: [ref('inventoryLot', 'supplierId', 'inventory lot')],
  },
  NoShowPolicy: {
    instead: 'Archive the policy instead; charged no-shows keep the policy they were charged under.',
    references: [ref('noShowEvent', 'policyId', 'no-show charge')],
  },
  PaymentProvider: {
    instead: 'Turn off Installed instead of deleting the provider.',
    references: [ref('paymentSession', 'paymentProviderId', 'payment')],
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
