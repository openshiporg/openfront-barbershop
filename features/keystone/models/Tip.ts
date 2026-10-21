import { list } from '@keystone-6/core';
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { trackingFields } from './trackingFields';
import { validateShopRelationships } from '../utils/shopRelationshipHooks';

export const Tip = list({
  hooks: {
    validate: {
      create: (args) => validateShopRelationships(args, [
        { field: 'barber', delegate: 'barber' },
        { field: 'customer', delegate: 'customer' },
        { field: 'transaction', delegate: 'checkoutTransaction' },
        { field: 'appointment', delegate: 'appointment' },
      ]),
    },
  },
  access: {
    operation: { query: permissions.canReadPayments, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessShopRecords },
  },
  ui: { listView: { initialColumns: ['tipNumber', 'barber', 'customer', 'amount'] } },
  fields: {
    shop: relationship({ ref: 'Shop.tips', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') }, access: { update: () => false } }),
    tipNumber: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    barber: relationship({ ref: 'Barber' }),
    customer: relationship({ ref: 'Customer' }),
    transaction: relationship({ ref: 'CheckoutTransaction' }),
    appointment: relationship({ ref: 'Appointment' }),
    amount: integer({ defaultValue: 0, validation: { min: 0 } }),
    paymentMethod: select({ type: 'enum', options: [{ label: 'Card', value: 'card' }, { label: 'Cash', value: 'cash' }, { label: 'Wallet', value: 'wallet' }], defaultValue: 'card' }),
    paidAt: timestamp(),
    metadata: json(),
    ...trackingFields,
  },
});
