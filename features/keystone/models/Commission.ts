import { list } from '@keystone-6/core';
import { decimal, integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { trackingFields } from './trackingFields';
import { settledCommissionMutationError } from '../utils/settledEvidence';
import { validateShopRelationships } from '../utils/shopRelationshipHooks';

export const Commission = list({
  hooks: {
    validate: {
      create: (args) => validateShopRelationships(args, [
        { field: 'barber', delegate: 'barber' },
        { field: 'transaction', delegate: 'checkoutTransaction' },
        { field: 'appointment', delegate: 'appointment' },
      ]),
      update: async (args) => {
        const error = settledCommissionMutationError(args.item as { status?: unknown }, 'update');
        if (error) args.addValidationError(error);
        await validateShopRelationships(args, [
          { field: 'barber', delegate: 'barber' },
          { field: 'transaction', delegate: 'checkoutTransaction' },
          { field: 'appointment', delegate: 'appointment' },
        ]);
      },
      delete: ({ item, addValidationError }) => {
        const error = settledCommissionMutationError(item as { status?: unknown }, 'delete');
        if (error) addValidationError(error);
      },
    },
  },
  access: {
    operation: { query: permissions.canReadPayments, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessShopRecords },
  },
  ui: { listView: { initialColumns: ['commissionNumber', 'barber', 'status', 'commissionAmount'] } },
  fields: {
    shop: relationship({ ref: 'Shop.commissions', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') }, access: { update: () => false } }),
    commissionNumber: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    barber: relationship({ ref: 'Barber.commissions' }),
    transaction: relationship({ ref: 'CheckoutTransaction' }),
    appointment: relationship({ ref: 'Appointment' }),
    payout: relationship({ ref: 'CommissionPayout.commissions' }),
    status: select({ type: 'enum', options: [{ label: 'Projected', value: 'projected' }, { label: 'Approved', value: 'approved' }, { label: 'Paid', value: 'paid' }, { label: 'Voided', value: 'voided' }], defaultValue: 'projected' }),
    serviceAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    productAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    commissionRate: decimal({ defaultValue: '0' }),
    commissionAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    paidAt: timestamp(),
    metadata: json(),
    ...trackingFields,
  },
});
