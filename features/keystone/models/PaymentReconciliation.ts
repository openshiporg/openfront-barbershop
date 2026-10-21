import { list } from '@keystone-6/core';
import { checkbox, integer, relationship, text, timestamp } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { trackingFields } from './trackingFields';

export const PaymentReconciliation = list({
  access: {
    operation: { query: permissions.canReadPayments, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessShopRecords },
  },
  ui: { isHidden: true },
  fields: {
    shop: relationship({ ref: 'Shop.paymentReconciliations', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') } }),
    eventKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    paymentSession: relationship({ ref: 'PaymentSession.reconciliations' }),
    localStatusBefore: text({ validation: { isRequired: true } }),
    remoteStatus: text({ validation: { isRequired: true } }),
    localStatusAfter: text({ validation: { isRequired: true } }),
    changed: checkbox({ defaultValue: false }),
    amount: integer({ validation: { isRequired: true, min: 0 } }),
    providerPayloadHash: text({ validation: { isRequired: true }, access: { read: () => false } }),
    observedAt: timestamp({ validation: { isRequired: true } }),
    ...trackingFields,
  },
});
