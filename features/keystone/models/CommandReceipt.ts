import { list } from '@keystone-6/core';
import { integer, json, relationship, text, timestamp } from '@keystone-6/core/fields';

import { activeShopIds, managedShopIds, permissions, rules } from '../access';
import { trackingFields } from './trackingFields';

const immutable = { update: () => false };

// Idempotency receipts for commands: a replay returns the stored result. Nothing
// is delivered from here. Raw payloads can hold customer contact details and notes. Report-only
// roles see the event metadata; only an owner/manager of the event's selected
// shop can read the payload itself.
function canReadPayload({ session, item }: { session?: unknown; item: Record<string, unknown> }) {
  const shopId = typeof item.shopId === 'string' ? item.shopId : '';
  if (!shopId) return false;
  const current = session as Parameters<typeof managedShopIds>[0];
  return managedShopIds(current).includes(shopId) && activeShopIds(current).includes(shopId);
}

export const CommandReceipt = list({
  access: {
    operation: {
      query: permissions.canViewReports,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: { query: rules.canAccessShopRecords },
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ['eventKey', 'eventType', 'aggregateType', 'occurredAt'] },
  },
  fields: {
    eventKey: text({ validation: { isRequired: true }, isIndexed: 'unique', access: immutable }),
    eventType: text({ validation: { isRequired: true }, access: immutable }),
    schemaVersion: integer({ validation: { isRequired: true }, defaultValue: 1, access: immutable }),
    aggregateType: text({ validation: { isRequired: true }, access: immutable }),
    aggregateId: text({ validation: { isRequired: true }, access: immutable }),
    shop: relationship({ ref: 'Shop.commandReceipts', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') }, access: immutable }),
    payload: json({ access: { ...immutable, read: canReadPayload } }),
    actorId: text({ access: immutable, ui: { description: 'User who performed the change, when recorded.' } }),
    payloadHash: text({ validation: { isRequired: true }, access: immutable }),
    occurredAt: timestamp({ validation: { isRequired: true }, access: immutable }),
    ...trackingFields,
  },
});
