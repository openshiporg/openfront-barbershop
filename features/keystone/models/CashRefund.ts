import { list } from '@keystone-6/core';
import { integer, relationship, text, timestamp } from '@keystone-6/core/fields';
import { permissions, rules } from '../access';
import { trackingFields } from './trackingFields';

/** Append-only evidence of an owner-confirmed full cash return. Never a processor claim. */
export const CashRefund = list({
  access: { operation: { query: permissions.canReadPayments, create: () => false, update: () => false, delete: () => false }, filter: { query: rules.canAccessShopRecords } },
  fields: {
    shop: relationship({ ref: 'Shop', db: { foreignKey: true, extendPrismaSchema: (s) => s.replaceAll('?', '') } }),
    transaction: relationship({ ref: 'CheckoutTransaction.cashRefund' }),
    eventKey: text({ isIndexed: 'unique', access: { read: () => false } }),
    actorId: text(),
    reason: text(),
    amount: integer({ validation: { min: 0 } }),
    tipAmount: integer({ defaultValue: 0 }),
    taxAmount: integer({ defaultValue: 0 }),
    refundedAt: timestamp({ defaultValue: { kind: 'now' } }),
    ...trackingFields,
  },
});
