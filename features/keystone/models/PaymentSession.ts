import { list } from '@keystone-6/core';
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { trackingFields } from './trackingFields';
import { validateShopRelationships } from '../utils/shopRelationshipHooks';

export const PaymentSession = list({
  hooks: {
    validate: {
      create: (args) => validateShopRelationships(args, [
        { field: 'appointment', delegate: 'appointment' },
        { field: 'transaction', delegate: 'checkoutTransaction' },
        { field: 'paymentProvider', delegate: 'paymentProvider' },
      ]),
      update: (args) => validateShopRelationships(args, [
        { field: 'appointment', delegate: 'appointment' },
        { field: 'transaction', delegate: 'checkoutTransaction' },
        { field: 'paymentProvider', delegate: 'paymentProvider' },
      ]),
    },
  },
  access: {
    operation: {
      query: permissions.canReadPayments,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: { query: rules.canAccessShopRecords },
  },
  ui: {
    listView: {
      initialColumns: ['appointment', 'status', 'amount', 'currencyCode', 'expiresAt'],
    },
  },
  fields: {
    shop: relationship({ ref: 'Shop.paymentSessions', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') }, access: { update: () => false } }),
    appointment: relationship({ ref: 'Appointment.paymentSessions' }),
    transaction: relationship({ ref: 'CheckoutTransaction.paymentSession' }),
    paymentProvider: relationship({ ref: 'PaymentProvider.paymentSessions' }),
    reconciliations: relationship({ ref: 'PaymentReconciliation.paymentSession', many: true }),
    idempotencyKeyHash: text({
      isIndexed: 'unique',
      validation: { isRequired: true },
      access: { read: () => false, create: permissions.canManagePayments, update: () => false },
      ui: { itemView: { fieldMode: 'hidden' }, createView: { fieldMode: 'hidden' }, listView: { fieldMode: 'hidden' } },
    }),
    status: select({
      type: 'enum',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Authorized', value: 'authorized' },
        { label: 'Captured', value: 'captured' },
        { label: 'Failed', value: 'failed' },
        { label: 'Expired', value: 'expired' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Partially Refunded', value: 'partially_refunded' },
        { label: 'Refunded', value: 'refunded' },
      ],
      defaultValue: 'pending',
    }),
    amount: integer({ validation: { isRequired: true, min: 0 } }),
    currencyCode: text({ defaultValue: 'USD', validation: { isRequired: true } }),
    providerPaymentId: text(),
    expiresAt: timestamp(),
    capturedAt: timestamp(),
    cancelledAt: timestamp(),
    refundedAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    metadata: json({ defaultValue: {} }),
    ...trackingFields,
  },
});
