import { list } from '@keystone-6/core';
import { checkbox, integer, json, relationship, select, text } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { validateShopRelationships } from '../utils/shopRelationshipHooks';
import { trackingFields } from './trackingFields';

export const NoShowPolicy = list({
  hooks: { validate: {
    create: (args) => validateShopRelationships(args, []),
    update: (args) => validateShopRelationships(args, []),
  } },
  access: {
    operation: { query: permissions.canReadAppointments, create: permissions.canManageAppointments, update: permissions.canManageAppointments, delete: permissions.canManageAppointments },
    filter: { query: rules.canAccessShopRecords, update: rules.canAccessShopRecords, delete: rules.canAccessShopRecords },
  },
  ui: { listView: { initialColumns: ['name', 'status', 'feeAmount', 'graceMinutes'] } },
  fields: {
    shop: relationship({ ref: 'Shop.noShowPolicies', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') }, access: { update: () => false } }),
    name: text({ validation: { isRequired: true } }),
    status: select({ type: 'enum', options: [{ label: 'Active', value: 'active' }, { label: 'Paused', value: 'paused' }, { label: 'Archived', value: 'archived' }], defaultValue: 'active' }),
    feeAmount: integer({ defaultValue: 0, validation: { min: 0 } }),
    graceMinutes: integer({ defaultValue: 10, validation: { min: 0 } }),
    appliesToMemberships: checkbox({ defaultValue: false }),
    description: text({ ui: { displayMode: 'textarea' } }),
    events: relationship({ ref: 'NoShowEvent.policy', many: true }),
    metadata: json(),
    ...trackingFields,
  },
});
