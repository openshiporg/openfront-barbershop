import { list } from '@keystone-6/core';
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields';
import { permissions, rules } from '../access';
import { trackingFields } from './trackingFields';

/**
 * Stored-value gift card (Square / Booksy). Sold online through Stripe and activated only after Stripe
 * confirms; redeemed at POS checkout. The balance only changes through commands, which append a ledger row
 * to `ledger` so every debit is traceable to a receipt.
 */
export const GiftCard = list({
  access: {
    operation: { query: permissions.canReadPayments, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessShopRecords },
  },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ['code', 'status', 'initialValue', 'balance', 'recipientName', 'expiresAt'] } },
  fields: {
    shop: relationship({ ref: 'Shop', db: { foreignKey: true, extendPrismaSchema: (s) => s.replaceAll('?', '') } }),
    code: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    status: select({
      type: 'enum',
      options: [
        { label: 'Awaiting payment', value: 'pending' },
        { label: 'Active', value: 'active' },
        { label: 'Used up', value: 'redeemed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      defaultValue: 'pending',
    }),
    initialValue: integer({ validation: { isRequired: true, min: 0 } }),
    balance: integer({ validation: { isRequired: true, min: 0 } }),
    purchaserName: text(),
    purchaserEmail: text(),
    recipientName: text(),
    recipientEmail: text(),
    message: text({ ui: { displayMode: 'textarea' } }),
    paymentSession: relationship({ ref: 'PaymentSession' }),
    expiresAt: timestamp(),
    activatedAt: timestamp(),
    emailedAt: timestamp(),
    ledger: json({ defaultValue: [] }),
    ...trackingFields,
  },
});
