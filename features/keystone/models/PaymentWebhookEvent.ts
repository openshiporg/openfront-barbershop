import { list } from '@keystone-6/core';
import { text, timestamp } from '@keystone-6/core/fields';

import { permissions } from '../access';
import { trackingFields } from './trackingFields';

export const PaymentWebhookEvent = list({
  access: {
    operation: {
      query: permissions.canReadPayments,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    // Inbox rows carry no shop ownership, so no shop operator may list them.
    // They are written and read only by the server-side webhook handler.
    filter: { query: () => false },
  },
  ui: {
    isHidden: true,
    listView: { initialColumns: ['providerCode', 'providerEventId', 'eventType', 'processedAt'] },
  },
  fields: {
    replayKey: text({
      isIndexed: 'unique',
      validation: { isRequired: true },
      access: { read: () => false },
      ui: { itemView: { fieldMode: 'hidden' }, createView: { fieldMode: 'hidden' }, listView: { fieldMode: 'hidden' } },
    }),
    providerCode: text({ validation: { isRequired: true } }),
    providerEventId: text({ validation: { isRequired: true } }),
    eventType: text({ validation: { isRequired: true } }),
    payloadHash: text({
      validation: { isRequired: true },
      access: { read: () => false },
      ui: { itemView: { fieldMode: 'hidden' }, createView: { fieldMode: 'hidden' }, listView: { fieldMode: 'hidden' } },
    }),
    processedAt: timestamp({ validation: { isRequired: true } }),
    ...trackingFields,
  },
});
