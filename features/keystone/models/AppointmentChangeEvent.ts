import { list } from '@keystone-6/core';
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { trackingFields } from './trackingFields';

export const AppointmentChangeEvent = list({
  access: {
    operation: { query: permissions.canReadAppointments, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessShopRecords },
  },
  ui: { listView: { initialColumns: ['appointment', 'action', 'actorType', 'occurredAt', 'feeAmount', 'depositConsequence'] } },
  fields: {
    shop: relationship({ ref: 'Shop.appointmentChangeEvents', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') } }),
    appointment: relationship({ ref: 'Appointment.changeEvents' }),
    eventKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: { read: () => false } }),
    action: select({ type: 'enum', options: [{ label: 'Cancelled', value: 'cancelled' }, { label: 'Rescheduled', value: 'rescheduled' }], validation: { isRequired: true } }),
    actorType: select({ type: 'enum', options: [{ label: 'Customer', value: 'customer' }, { label: 'Operator', value: 'operator' }], validation: { isRequired: true } }),
    actorReferenceHash: text({ validation: { isRequired: true }, access: { read: () => false } }),
    reason: text({ validation: { isRequired: true }, ui: { displayMode: 'textarea' } }),
    previousStartsAt: timestamp({ validation: { isRequired: true } }),
    previousEndsAt: timestamp(),
    nextStartsAt: timestamp(),
    nextEndsAt: timestamp(),
    policySnapshot: json(),
    authoritySnapshot: json(),
    feeAmount: integer({ validation: { isRequired: true, min: 0 }, defaultValue: 0 }),
    depositConsequence: select({
      type: 'enum',
      options: [
        { label: 'None', value: 'none' },
        { label: 'Refund Required', value: 'refund_required' },
        { label: 'Forfeiture Pending', value: 'forfeiture_pending' },
        { label: 'Manual Review', value: 'manual_review' },
      ],
      defaultValue: 'none',
    }),
    occurredAt: timestamp({ validation: { isRequired: true } }),
    ...trackingFields,
  },
});
