import { list } from '@keystone-6/core';
import { checkbox, image, integer, json, relationship, select, text } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { trackingFields } from './trackingFields';
import { validateShopRelationships } from '../utils/shopRelationshipHooks';
import { createCrudLifecycleAfterOperation } from '../utils/crudLifecycleHooks';

export const Product = list({
  db: {
    extendPrismaSchema: (schema) => schema.replace(
      /\n}$/,
      '\n  @@unique([shopId, sku], map: "Product_shop_sku_key")\n}'
    ),
  },
  hooks: {
    validate: {
      create: (args) => validateShopRelationships(args, []),
      update: (args) => validateShopRelationships(args, []),
    },
    afterOperation: createCrudLifecycleAfterOperation('product'),
  },
  access: {
    operation: { query: permissions.canAccessDashboard, create: permissions.canManageServices, update: permissions.canManageServices, delete: permissions.canManageServices },
    filter: { query: rules.canAccessShopRecords, update: rules.canAccessShopRecords, delete: rules.canAccessShopRecords },
  },
  ui: { listView: { initialColumns: ['name', 'sku', 'status', 'price'] } },
  fields: {
    shop: relationship({ ref: 'Shop.products', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') }, access: { update: () => false } }),
    name: text({ validation: { isRequired: true } }),
    sku: text({ isIndexed: true }),
    status: select({ type: 'enum', options: [{ label: 'Active', value: 'active' }, { label: 'Draft', value: 'draft' }, { label: 'Archived', value: 'archived' }], defaultValue: 'active' }),
    productType: select({ type: 'enum', options: [{ label: 'Pomade', value: 'pomade' }, { label: 'Beard Care', value: 'beard_care' }, { label: 'Shampoo', value: 'shampoo' }, { label: 'Tool', value: 'tool' }, { label: 'Other', value: 'other' }], defaultValue: 'other' }),
    price: integer({ defaultValue: 0, validation: { min: 0 } }),
    cost: integer({ defaultValue: 0, validation: { min: 0 } }),
    description: text({ ui: { displayMode: 'textarea' } }),
    imagePath: text({ ui: { description: 'Relative public retail product path, e.g. /images/barbershop/product-matte-clay.svg.' } }),
    image: image({ storage: 'my_images' }),
    inventoryTracked: checkbox({ defaultValue: true }),
    metadata: json(),
    inventoryLots: relationship({ ref: 'InventoryLot.product', many: true }),
    inventoryMovements: relationship({ ref: 'InventoryMovement.product', many: true }),
    saleLines: relationship({ ref: 'ProductSaleLine.product', many: true }),
    ...trackingFields,
  },
});
