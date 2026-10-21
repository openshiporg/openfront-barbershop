import { list } from '@keystone-6/core';
import { checkbox, json, relationship, select, text } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { validateShopRelationships } from '../utils/shopRelationshipHooks';
import { trackingFields } from './trackingFields';

export const GroomingNote = list({
  hooks: { validate: {
    create: (args) => validateShopRelationships(args, [
      { field: 'customer', delegate: 'customer' }, { field: 'barber', delegate: 'barber' }, { field: 'appointment', delegate: 'appointment' },
    ]),
    update: (args) => validateShopRelationships(args, [
      { field: 'customer', delegate: 'customer' }, { field: 'barber', delegate: 'barber' }, { field: 'appointment', delegate: 'appointment' },
    ]),
  } },
  access: {
    operation: { query: permissions.canReadCustomerNotes, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessShopRecords },
  },
  ui: { listView: { initialColumns: ['title', 'customer', 'barber', 'noteType'] } },
  fields: {
    shop: relationship({ ref: 'Shop.groomingNotes', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') } }),
    title: text({ validation: { isRequired: true } }),
    customer: relationship({ ref: 'Customer' }),
    barber: relationship({ ref: 'Barber' }),
    appointment: relationship({ ref: 'Appointment' }),
    noteType: select({ type: 'enum', options: [{ label: 'Cut Formula', value: 'cut_formula' }, { label: 'Beard Detail', value: 'beard_detail' }, { label: 'Product Preference', value: 'product_preference' }, { label: 'Allergy', value: 'allergy' }], defaultValue: 'cut_formula' }),
    body: text({ ui: { displayMode: 'textarea' } }),
    photoUrl: text(),
    privateToStaff: checkbox({ defaultValue: true }),
    metadata: json(),
    ...trackingFields,
  },
});
