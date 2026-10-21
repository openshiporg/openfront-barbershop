import { list } from "@keystone-6/core";
import { checkbox, integer, relationship, select, timestamp } from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { trackingFields } from "./trackingFields";
import { validateShopRelationships } from "../utils/shopRelationshipHooks";

export const CustomerPackage = list({
  hooks: {
    validate: {
      create: (args) => validateShopRelationships(args, [
        { field: "customer", delegate: "customer" },
        { field: "servicePackage", delegate: "servicePackage" },
        { field: "membershipPlan", delegate: "membershipPlan" },
      ]),
      update: (args) => validateShopRelationships(args, [
        { field: "customer", delegate: "customer" },
        { field: "servicePackage", delegate: "servicePackage" },
        { field: "membershipPlan", delegate: "membershipPlan" },
      ]),
    },
  },
  access: {
    operation: {
      query: permissions.canReadMemberships,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: { query: rules.canAccessShopRecords },
  },
  ui: {
    listView: {
      initialColumns: ["customer", "servicePackage", "membershipPlan", "remainingVisits", "status"],
    },
  },
  fields: {
    shop: relationship({ ref: "Shop.customerPackages", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
    customer: relationship({ ref: "Customer.packageBalances" }),
    servicePackage: relationship({ ref: "ServicePackage.customerBalances" }),
    membershipPlan: relationship({ ref: "MembershipPlan.members" }),
    remainingVisits: integer({ defaultValue: 0, access: { update: () => false } }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Paused", value: "paused" },
        { label: "Used Up", value: "used_up" },
        { label: "Expired", value: "expired" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "active",
    }),
    startsAt: timestamp({ defaultValue: { kind: "now" } }),
    expiresAt: timestamp(),
    nextBillingAt: timestamp(),
    pausedAt: timestamp(),
    cancelledAt: timestamp(),
    autoRenew: checkbox({ defaultValue: false }),
    lastUsedAt: timestamp(),
    transactions: relationship({ ref: "CheckoutTransaction.packageBalance", many: true }),
    membershipEvents: relationship({ ref: "MembershipEvent.customerPackage", many: true }),
    usageLedger: relationship({ ref: "PackageUsage.customerPackage", many: true }),
    ...trackingFields,
  },
});
