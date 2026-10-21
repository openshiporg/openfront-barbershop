import { list, graphql } from '@keystone-6/core';
import { integer, json, relationship, text, virtual } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { trackingFields } from './trackingFields';

const immutableAfterCreate = {
  create: () => false,
  update: () => false,
};

export const AppointmentLineItem = list({
  hooks: {
    validate: {
      update: ({ addValidationError }) => {
        addValidationError('Appointment line item snapshots are immutable after checkout.');
      },
      delete: ({ addValidationError }) => {
        addValidationError('Appointment line item snapshots cannot be deleted.');
      },
    },
  },
  access: {
    operation: {
      query: permissions.canReadPayments,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: { query: rules.canAccessTransactionShopRecords },
  },
  ui: {
    isHidden: true,
    listView: {
      initialColumns: ['title', 'price', 'durationMinutes', 'appointment', 'transaction'],
    },
  },
  fields: {
    appointment: relationship({
      ref: 'Appointment.lineItems',
      access: immutableAfterCreate,
    }),
    transaction: relationship({
      ref: 'CheckoutTransaction.lineItems',
      access: immutableAfterCreate,
    }),
    service: relationship({
      ref: 'Service.appointmentLineItems',
      access: immutableAfterCreate,
      ui: { description: 'Optional source reference. Receipt fields below are immutable snapshots.' },
    }),
    title: text({
      validation: { isRequired: true },
      access: immutableAfterCreate,
      ui: { description: 'Service title captured at checkout.' },
    }),
    price: integer({
      validation: { isRequired: true, min: 0 },
      access: immutableAfterCreate,
      ui: { description: 'Service price in cents captured at checkout.' },
    }),
    durationMinutes: integer({
      validation: { isRequired: true, min: 0 },
      access: immutableAfterCreate,
      ui: { description: 'Service duration captured at checkout.' },
    }),
    imagePath: text({
      access: immutableAfterCreate,
      ui: { description: 'Relative /images/... service image path captured at checkout.' },
    }),
    modifiers: json({
      defaultValue: [],
      access: immutableAfterCreate,
      ui: { description: 'Immutable selected service modifiers/options captured at checkout.' },
    }),
    barberName: text({
      access: immutableAfterCreate,
      ui: { description: 'Barber display name captured at checkout.' },
    }),
    barberChairNumber: text({
      access: immutableAfterCreate,
      ui: { description: 'Chair number captured at checkout.' },
    }),
    packageBalanceId: text({
      access: immutableAfterCreate,
      ui: { description: 'Consumed package or membership balance ID captured at checkout.' },
    }),
    packageName: text({
      access: immutableAfterCreate,
      ui: { description: 'Consumed package or membership name captured at checkout.' },
    }),
    packageVisitsConsumed: integer({
      defaultValue: 0,
      validation: { min: 0 },
      access: immutableAfterCreate,
    }),
    formattedPrice: virtual({
      field: graphql.field({
        type: graphql.String,
        resolve(item) {
          return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
            Number(item.price || 0) / 100
          );
        },
      }),
    }),
    ...trackingFields,
  },
});
