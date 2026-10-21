import { list } from '@keystone-6/core';
import { integer, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { trackingFields } from './trackingFields';

export const CommissionPayout = list({
  access: {
    operation: { query: permissions.canReadPayments, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessShopRecords },
  },
  ui: { isHidden: true },
  fields: {
    shop: relationship({ ref: 'Shop.commissionPayouts', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') } }),
    payoutNumber: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    idempotencyKeyHash: text({ isIndexed: 'unique', validation: { isRequired: true }, access: { read: () => false } }),
    barber: relationship({ ref: 'Barber' }),
    commissions: relationship({ ref: 'Commission.payout', many: true }),
    status: select({ type: 'enum', options: [{ label: 'Paid', value: 'paid' }, { label: 'Voided', value: 'voided' }], defaultValue: 'paid' }),
    commissionCount: integer({ validation: { isRequired: true, min: 1 } }),
    totalAmount: integer({ validation: { isRequired: true, min: 0 } }),
    paidAt: timestamp({ validation: { isRequired: true } }),
    notes: text(),
    ...trackingFields,
  },
});
