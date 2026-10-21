import { list } from '@keystone-6/core';
import { integer, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { trackingFields } from './trackingFields';
import { validateShopRelationships } from '../utils/shopRelationshipHooks';

export const InventoryMovement = list({
  hooks: {
    validate: {
      create: (args) => validateShopRelationships(args, [
        { field: 'product', delegate: 'product' },
        { field: 'inventoryLot', delegate: 'inventoryLot' },
      ]),
    },
  },
  access: {
    operation: {
      query: permissions.canAccessDashboard,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: { query: rules.canAccessShopRecords },
  },
  ui: {
    isHidden: true,
    listView: { initialColumns: ['product', 'inventoryLot', 'movementType', 'quantityDelta', 'quantityAfter', 'occurredAt'] },
  },
  fields: {
    shop: relationship({ ref: 'Shop.inventoryMovements', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') }, access: { update: () => false } }),
    product: relationship({ ref: 'Product.inventoryMovements' }),
    inventoryLot: relationship({ ref: 'InventoryLot.movements' }),
    productSaleLine: relationship({ ref: 'ProductSaleLine.inventoryMovement' }),
    movementType: select({
      type: 'enum',
      options: [
        { label: 'Receive', value: 'receive' },
        { label: 'Sale', value: 'sale' },
        { label: 'Return', value: 'return' },
        { label: 'Waste', value: 'waste' },
        { label: 'Adjustment', value: 'adjustment' },
      ],
      validation: { isRequired: true },
    }),
    quantityDelta: integer({ validation: { isRequired: true } }),
    quantityAfter: integer({ validation: { isRequired: true, min: 0 } }),
    reason: text({ validation: { isRequired: true } }),
    referenceKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    occurredAt: timestamp({ validation: { isRequired: true } }),
    ...trackingFields,
  },
});
