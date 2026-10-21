import { list } from '@keystone-6/core';
import { json, relationship, select, text } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { trackingFields } from './trackingFields';
import { validateShopRelationships } from '../utils/shopRelationshipHooks';

export const BarberChair = list({
  db: {
    extendPrismaSchema: (schema) => schema.replace(
      /\n}$/,
      '\n  @@unique([shopId, chairNumber], map: "BarberChair_shop_chairNumber_key")\n}'
    ),
  },
  hooks: {
    validate: {
      create: (args) => validateShopRelationships(args, []),
      update: (args) => validateShopRelationships(args, []),
    },
  },
  access: {
    operation: { query: permissions.canReadStaff, create: permissions.canManageStaff, update: permissions.canManageStaff, delete: permissions.canManageStaff },
    filter: { query: rules.canAccessShopRecords, update: rules.canAccessShopRecords, delete: rules.canAccessShopRecords },
  },
  ui: { listView: { initialColumns: ['chairNumber', 'stationName', 'status', 'assignedBarbers'] } },
  fields: {
    shop: relationship({ ref: 'Shop.chairs', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') }, access: { update: () => false } }),
    chairNumber: text({ isIndexed: true, validation: { isRequired: true } }),
    stationName: text(),
    status: select({ type: 'enum', options: [{ label: 'Active', value: 'active' }, { label: 'Maintenance', value: 'maintenance' }, { label: 'Reserved', value: 'reserved' }], defaultValue: 'active' }),
    assignedBarbers: relationship({ ref: 'Barber.chair', many: true }),
    scheduleExceptions: relationship({ ref: 'ScheduleException.chair', many: true, access: { create: () => false, update: () => false } }),
    shifts: relationship({ ref: 'StaffShift.chair', many: true, access: { create: () => false, update: () => false } }),
    // Appointment chair assignment is owned by the booking/seating commands
    // (capacity locks and history). The inverse is read-only here as well as in
    // the registry-wide relationship boundary wrapper.
    appointments: relationship({ ref: 'Appointment.chair', many: true, access: { create: () => false, update: () => false }, ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } } }),
    locationNote: text(),
    metadata: json(),
    ...trackingFields,
  },
});
