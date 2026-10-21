import { list } from '@keystone-6/core';
import { integer, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { trackingFields } from './trackingFields';

export const PackageUsage = list({
  access: {
    operation: {
      query: permissions.canReadMemberships,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: { query: rules.canAccessCustomerPackageShopRecords },
  },
  ui: {
    isHidden: true,
    listView: { initialColumns: ['customerPackage', 'usageType', 'visitsDelta', 'balanceAfter', 'occurredAt'] },
  },
  fields: {
    customerPackage: relationship({ ref: 'CustomerPackage.usageLedger' }),
    appointment: relationship({ ref: 'Appointment.packageUsages' }),
    transaction: relationship({ ref: 'CheckoutTransaction.packageUsages' }),
    usageType: select({
      type: 'enum',
      options: [
        { label: 'Grant', value: 'grant' },
        { label: 'Consume', value: 'consume' },
        { label: 'Restore', value: 'restore' },
        { label: 'Expire', value: 'expire' },
        { label: 'Adjustment', value: 'adjustment' },
      ],
      validation: { isRequired: true },
    }),
    visitsDelta: integer({ validation: { isRequired: true } }),
    balanceAfter: integer({ validation: { isRequired: true, min: 0 } }),
    reason: text({ validation: { isRequired: true } }),
    referenceKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    occurredAt: timestamp({ validation: { isRequired: true } }),
    ...trackingFields,
  },
});
