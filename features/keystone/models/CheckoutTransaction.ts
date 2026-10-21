import { list, graphql } from "@keystone-6/core";
import { integer, json, relationship, select, text, timestamp, virtual } from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { trackingFields } from "./trackingFields";
import { validateShopRelationships } from "../utils/shopRelationshipHooks";

const formatCurrency = (cents?: number | null) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);

export const CheckoutTransaction = list({
  hooks: {
    validate: {
      create: (args) => validateShopRelationships(args, [
        { field: "customer", delegate: "customer" },
        { field: "barber", delegate: "barber" },
        { field: "paymentSession", delegate: "paymentSession" },
        { field: "packageBalance", delegate: "customerPackage" },
      ]),
      update: (args) => validateShopRelationships(args, [
        { field: "customer", delegate: "customer" },
        { field: "barber", delegate: "barber" },
        { field: "paymentSession", delegate: "paymentSession" },
        { field: "packageBalance", delegate: "customerPackage" },
      ]),
    },
  },
  access: {
    operation: {
      query: permissions.canReadPayments,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: { query: rules.canAccessShopRecords },
  },
  ui: {
    listView: {
      initialColumns: ["customer", "status", "total", "paymentMethod", "completedAt"],
    },
  },
  fields: {
    shop: relationship({ ref: "Shop.transactions", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
    customer: relationship({ ref: "Customer.transactions" }),
    barber: relationship({ ref: "Barber" }),
    appointments: relationship({ ref: "Appointment.transaction", many: true }),
    lineItems: relationship({ ref: "AppointmentLineItem.transaction", many: true }),
    productLines: relationship({ ref: "ProductSaleLine.transaction", many: true }),
    paymentSession: relationship({ ref: "PaymentSession.transaction" }),
    cashRefund: relationship({ ref: 'CashRefund.transaction', access: { create: () => false, update: () => false } }),
    packageUsages: relationship({ ref: "PackageUsage.transaction", many: true }),
    membershipEvents: relationship({ ref: "MembershipEvent.transaction", many: true }),
    packageBalance: relationship({ ref: "CustomerPackage.transactions" }),
    status: select({
      type: "enum",
      options: [
        { label: "Open", value: "open" },
        { label: "Paid", value: "paid" },
        { label: "Partially Refunded", value: "partially_refunded" },
        { label: "Refunded", value: "refunded" },
        { label: "Voided", value: "voided" },
      ],
      defaultValue: "open",
    }),
    subtotal: integer({ defaultValue: 0 }),
    tipAmount: integer({ defaultValue: 0 }),
    taxAmount: integer({ defaultValue: 0 }),
    discountAmount: integer({ defaultValue: 0 }),
    total: integer({ defaultValue: 0 }),
    paymentMethod: select({
      type: "enum",
      options: [
        { label: "Cash", value: "cash" },
        { label: "Card", value: "card" },
        { label: "Package", value: "package" },
        { label: "Gift Card", value: "gift_card" },
        { label: "Other", value: "other" },
      ],
      defaultValue: "card",
    }),
    currencyCode: text({ defaultValue: 'USD', access: { create: () => false, update: () => false } }),
    merchantSnapshot: json({ access: { create: () => false, update: () => false } }),
    taxRuleSnapshot: json({ access: { create: () => false, update: () => false } }),
    providerPaymentId: text(),
    completedAt: timestamp(),
    notes: text({ ui: { displayMode: "textarea" } }),
    formattedTotal: virtual({
      field: graphql.field({
        type: graphql.String,
        resolve(item) {
          return formatCurrency(item.total as number);
        },
      }),
    }),
    ...trackingFields,
  },
});
