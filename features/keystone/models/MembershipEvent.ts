import { list } from '@keystone-6/core';
import { integer, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { trackingFields } from './trackingFields';

export const MembershipEvent = list({
  access: {
    operation: { query: permissions.canReadMemberships, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessShopRecords },
  },
  ui: { isHidden: true },
  fields: {
    shop: relationship({ ref: 'Shop.membershipEvents', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') } }),
    customer: relationship({ ref: 'Customer.membershipEvents' }),
    membershipPlan: relationship({ ref: 'MembershipPlan.events' }),
    customerPackage: relationship({ ref: 'CustomerPackage.membershipEvents' }),
    transaction: relationship({ ref: 'CheckoutTransaction.membershipEvents' }),
    idempotencyKeyHash: text({ isIndexed: 'unique', validation: { isRequired: true }, access: { read: () => false } }),
    eventType: select({
      type: 'enum',
      options: [
        { label: 'Purchased', value: 'purchased' },
        { label: 'Renewed', value: 'renewed' },
        { label: 'Paused', value: 'paused' },
        { label: 'Resumed', value: 'resumed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      validation: { isRequired: true },
    }),
    planNameSnapshot: text({ validation: { isRequired: true } }),
    amount: integer({ defaultValue: 0, validation: { min: 0 } }),
    visitsDelta: integer({ defaultValue: 0 }),
    resultingVisits: integer({ defaultValue: 0, validation: { min: 0 } }),
    occurredAt: timestamp({ validation: { isRequired: true } }),
    reason: text(),
    ...trackingFields,
  },
});
