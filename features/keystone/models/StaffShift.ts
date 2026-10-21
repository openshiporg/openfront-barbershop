import { list } from '@keystone-6/core';
import { relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { trackingFields } from './trackingFields';

export const StaffShift = list({
  access: {
    operation: { query: permissions.canReadSchedules, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessShopRecords },
  },
  ui: { isHidden: true },
  fields: {
    shop: relationship({ ref: 'Shop.staffShifts', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') } }),
    barber: relationship({ ref: 'Barber.shifts' }),
    chair: relationship({ ref: 'BarberChair.shifts' }),
    idempotencyKeyHash: text({ isIndexed: 'unique', validation: { isRequired: true }, access: { read: () => false } }),
    status: select({
      type: 'enum',
      options: [
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Clocked in', value: 'clocked_in' },
        { label: 'Completed', value: 'completed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      defaultValue: 'scheduled',
    }),
    scheduledStart: timestamp({ validation: { isRequired: true } }),
    scheduledEnd: timestamp({ validation: { isRequired: true } }),
    clockedInAt: timestamp(),
    clockedOutAt: timestamp(),
    notes: text({ ui: { displayMode: 'textarea' } }),
    ...trackingFields,
  },
});
