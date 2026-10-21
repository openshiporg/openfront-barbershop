import { list } from '@keystone-6/core';
import { json, relationship, select, text } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { trackingFields } from './trackingFields';
import { validateShopRelationships } from '../utils/shopRelationshipHooks';

export const Supplier = list({
  hooks: {
    validate: {
      create: (args) => validateShopRelationships(args, []),
      update: (args) => validateShopRelationships(args, []),
    },
  },
  access: {
    operation: { query: permissions.canAccessDashboard, create: permissions.canManageServices, update: permissions.canManageServices, delete: permissions.canManageServices },
    filter: { query: rules.canAccessShopRecords, update: rules.canAccessShopRecords, delete: rules.canAccessShopRecords },
  },
  ui: { listView: { initialColumns: ['name', 'status', 'contactName'] } },
  fields: {
    shop: relationship({ ref: 'Shop.suppliers', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') }, access: { update: () => false } }),
    name: text({ validation: { isRequired: true } }),
    status: select({ type: 'enum', options: [{ label: 'Active', value: 'active' }, { label: 'Paused', value: 'paused' }, { label: 'Archived', value: 'archived' }], defaultValue: 'active' }),
    contactName: text(),
    email: text(),
    phone: text(),
    website: text(),
    notes: text({ ui: { displayMode: 'textarea' } }),
    metadata: json(),
    ...trackingFields,
  },
});
