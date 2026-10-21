import { list } from '@keystone-6/core';
import { integer, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { trackingFields } from './trackingFields';

export const ProductSaleLine = list({
  access: {
    operation: { query: permissions.canReadPayments, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessShopRecords },
  },
  ui: { isHidden: true },
  fields: {
    shop: relationship({ ref: 'Shop.productSaleLines', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') } }),
    lineNumber: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    transaction: relationship({ ref: 'CheckoutTransaction.productLines' }),
    product: relationship({ ref: 'Product.saleLines' }),
    inventoryMovement: relationship({ ref: 'InventoryMovement.productSaleLine' }),
    originalLine: relationship({ ref: 'ProductSaleLine.returnLines' }),
    returnLines: relationship({ ref: 'ProductSaleLine.originalLine', many: true }),
    lineType: select({ type: 'enum', options: [{ label: 'Sale', value: 'sale' }, { label: 'Return', value: 'return' }], defaultValue: 'sale' }),
    productNameSnapshot: text({ validation: { isRequired: true } }),
    skuSnapshot: text({ validation: { isRequired: true } }),
    quantity: integer({ validation: { isRequired: true, min: 1 } }),
    unitPrice: integer({ validation: { isRequired: true, min: 0 } }),
    subtotal: integer({ validation: { isRequired: true } }),
    taxAmount: integer({ validation: { isRequired: true } }),
    total: integer({ validation: { isRequired: true } }),
    returnedQuantity: integer({ defaultValue: 0, validation: { min: 0 } }),
    occurredAt: timestamp({ validation: { isRequired: true } }),
    ...trackingFields,
  },
});
