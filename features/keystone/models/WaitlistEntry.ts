import { list } from '@keystone-6/core';
import { json, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { validateShopRelationships } from '../utils/shopRelationshipHooks';
import { trackingFields } from './trackingFields';

export const WaitlistEntry = list({
  hooks: { validate: {
    create: (args) => validateShopRelationships(args, [{ field: 'customer', delegate: 'customer' }, { field: 'requestedService', delegate: 'service' }, { field: 'requestedBarber', delegate: 'barber' }]),
    update: (args) => validateShopRelationships(args, [{ field: 'customer', delegate: 'customer' }, { field: 'requestedService', delegate: 'service' }, { field: 'requestedBarber', delegate: 'barber' }]),
  } },
  access: { operation: { query: permissions.canReadQueue, create: () => false, update: () => false, delete: () => false }, filter: { query: rules.canAccessShopRecords } },
  ui: { listView: { initialColumns: ['customerName', 'requestedService', 'requestedBarber', 'status'] } },
  fields: {
    shop: relationship({ ref: 'Shop.waitlistEntries', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') } }),
    customerName: text({ validation: { isRequired: true } }),
    phone: text(),
    customer: relationship({ ref: 'Customer' }),
    requestedService: relationship({ ref: 'Service' }),
    requestedBarber: relationship({ ref: 'Barber' }),
    status: select({ type: 'enum', options: [{ label: 'Waiting', value: 'waiting' }, { label: 'Notified', value: 'notified' }, { label: 'Booked', value: 'booked' }, { label: 'Expired', value: 'expired' }], defaultValue: 'waiting' }),
    preferredAt: timestamp(),
    notifiedAt: timestamp(),
    notes: text({ ui: { displayMode: 'textarea' } }),
    metadata: json(),
    ...trackingFields,
  },
});
