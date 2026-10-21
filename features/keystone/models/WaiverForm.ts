import { list } from '@keystone-6/core';
import { checkbox, json, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { validateShopRelationships } from '../utils/shopRelationshipHooks';
import { trackingFields } from './trackingFields';

export const WaiverForm = list({
  hooks: { validate: {
    create: (args) => validateShopRelationships(args, [
      { field: 'customer', delegate: 'customer' }, { field: 'appointment', delegate: 'appointment' }, { field: 'service', delegate: 'service' },
    ]),
    update: (args) => validateShopRelationships(args, [
      { field: 'customer', delegate: 'customer' }, { field: 'appointment', delegate: 'appointment' }, { field: 'service', delegate: 'service' },
    ]),
  } },
  access: {
    operation: { query: permissions.canReadCustomers, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessShopRecords },
  },
  ui: { listView: { initialColumns: ['title', 'customer', 'waiverType', 'status'] } },
  fields: {
    shop: relationship({ ref: 'Shop.waiverForms', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') } }),
    title: text({ validation: { isRequired: true } }),
    customer: relationship({ ref: 'Customer' }),
    appointment: relationship({ ref: 'Appointment' }),
    service: relationship({ ref: 'Service' }),
    waiverType: select({ type: 'enum', options: [{ label: 'Service-specific', value: 'service' }, { label: 'Chemical Service', value: 'chemical_service' }, { label: 'Minor Consent', value: 'minor_consent' }, { label: 'Photo Release', value: 'photo_release' }, { label: 'General', value: 'general' }], defaultValue: 'general' }),
    status: select({ type: 'enum', options: [{ label: 'Draft', value: 'draft' }, { label: 'Sent', value: 'sent' }, { label: 'Signed', value: 'signed' }, { label: 'Expired', value: 'expired' }], defaultValue: 'draft' }),
    templateKey: text({ access: { update: () => false } }),
    templateVersion: text({ access: { update: () => false } }),
    templateHash: text({ access: { update: () => false } }),
    signatureKeyHash: text({ isIndexed: 'unique', access: { read: () => false, update: () => false } }),
    signedByName: text({ access: { update: () => false } }),
    signerRole: select({ type: 'enum', options: [{ label: 'Customer', value: 'customer' }, { label: 'Guardian', value: 'guardian' }], access: { update: () => false } }),
    guardianName: text({ access: { update: () => false } }),
    affirmation: checkbox({ defaultValue: false, access: { update: () => false } }),
    affirmationHash: text({ access: { read: () => false, update: () => false } }),
    signedAt: timestamp({ access: { update: () => false } }),
    documentUrl: text(),
    metadata: json(),
    ...trackingFields,
  },
});
