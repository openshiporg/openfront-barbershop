import { list } from '@keystone-6/core';
import { relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { trackingFields } from './trackingFields';
import { validateShopRelationships } from '../utils/shopRelationshipHooks';

export const ScheduleException = list({
  hooks: {
    validate: {
      create: (args) => validateShopRelationships(args, [
        { field: 'barber', delegate: 'barber' },
        { field: 'chair', delegate: 'barberChair' },
      ]),
      update: (args) => validateShopRelationships(args, [
        { field: 'barber', delegate: 'barber' },
        { field: 'chair', delegate: 'barberChair' },
      ]),
    },
  },
  access: {
    operation: {
      query: permissions.canReadSchedules,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: { query: rules.canAccessShopRecords },
  },
  ui: { listView: { initialColumns: ['barber', 'chair', 'exceptionType', 'startsAt', 'endsAt', 'status'] } },
  fields: {
    shop: relationship({ ref: 'Shop.scheduleExceptions', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') }, access: { update: () => false } }),
    barber: relationship({ ref: 'Barber.scheduleExceptions' }),
    chair: relationship({ ref: 'BarberChair.scheduleExceptions' }),
    idempotencyKeyHash: text({ isIndexed: 'unique', validation: { isRequired: true }, access: { read: () => false } }),
    exceptionType: select({
      type: 'enum',
      options: [
        { label: 'Time off', value: 'time_off' },
        { label: 'Shop closure', value: 'shop_closure' },
        { label: 'Chair unavailable', value: 'chair_unavailable' },
        { label: 'Working override', value: 'working_override' },
      ],
      defaultValue: 'time_off',
    }),
    status: select({ type: 'enum', options: [{ label: 'Active', value: 'active' }, { label: 'Cancelled', value: 'cancelled' }], defaultValue: 'active' }),
    startsAt: timestamp({ validation: { isRequired: true } }),
    endsAt: timestamp({ validation: { isRequired: true } }),
    reason: text({ validation: { isRequired: true }, ui: { displayMode: 'textarea' } }),
    ...trackingFields,
  },
});
