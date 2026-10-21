import { list } from '@keystone-6/core';
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { trackingFields } from './trackingFields';
import { validateShopRelationships } from '../utils/shopRelationshipHooks';

export const InventoryLot = list({
  db: {
    extendPrismaSchema: (schema) => schema.replace(
      /\n}$/,
      '\n  @@unique([shopId, lotNumber], map: "InventoryLot_shop_lotNumber_key")\n}'
    ),
  },
  hooks: {
    validate: {
      create: (args) => validateShopRelationships(args, [
        { field: 'product', delegate: 'product' },
        { field: 'supplier', delegate: 'supplier' },
      ]),
      update: (args) => validateShopRelationships(args, [
        { field: 'product', delegate: 'product' },
        { field: 'supplier', delegate: 'supplier' },
      ]),
    },
  },
  access: {
    operation: { query: permissions.canAccessDashboard, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessShopRecords, update: rules.canAccessShopRecords },
  },
  ui: { listView: { initialColumns: ['lotNumber', 'product', 'supplier', 'status'] } },
  fields: {
    shop: relationship({ ref: 'Shop.inventoryLots', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') }, access: { update: () => false } }),
    lotNumber: text({ isIndexed: true, validation: { isRequired: true } }),
    product: relationship({ ref: 'Product.inventoryLots' }),
    supplier: relationship({ ref: 'Supplier' }),
    quantityReceived: integer({ defaultValue: 0, validation: { min: 0 }, access: { update: () => false } }),
    quantityRemaining: integer({ defaultValue: 0, validation: { min: 0 }, access: { update: () => false } }),
    unitCost: integer({ defaultValue: 0, validation: { min: 0 } }),
    receivedAt: timestamp(),
    expiresAt: timestamp(),
    status: select({ type: 'enum', options: [{ label: 'Active', value: 'active' }, { label: 'Consumed', value: 'consumed' }, { label: 'Expired', value: 'expired' }], defaultValue: 'active' }),
    metadata: json(),
    movements: relationship({ ref: 'InventoryMovement.inventoryLot', many: true }),
    ...trackingFields,
  },
});
