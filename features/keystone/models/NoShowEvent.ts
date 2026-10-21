import { list } from '@keystone-6/core';
import { checkbox, integer, relationship, text, timestamp } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { trackingFields } from './trackingFields';

export const NoShowEvent = list({
  access: {
    operation: { query: permissions.canReadAppointments, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessShopRecords },
  },
  ui: { isHidden: true },
  fields: {
    shop: relationship({ ref: 'Shop.noShowEvents', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') } }),
    eventKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    appointment: relationship({ ref: 'Appointment.noShowEvents' }),
    customer: relationship({ ref: 'Customer' }),
    policy: relationship({ ref: 'NoShowPolicy.events' }),
    policyNameSnapshot: text({ validation: { isRequired: true } }),
    feeAmount: integer({ validation: { isRequired: true, min: 0 } }),
    graceMinutes: integer({ validation: { isRequired: true, min: 0 } }),
    feeWaived: checkbox({ defaultValue: false }),
    reason: text({ validation: { isRequired: true } }),
    markedAt: timestamp({ validation: { isRequired: true } }),
    ...trackingFields,
  },
});
