import { list } from "@keystone-6/core";
import { integer, relationship, select, text } from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { trackingFields } from "./trackingFields";
import { validateShopRelationships } from "../utils/shopRelationshipHooks";

export const MembershipPlan = list({
  hooks: {
    validate: {
      create: (args) => validateShopRelationships(args, []),
      update: (args) => validateShopRelationships(args, []),
    },
  },
  access: {
    operation: {
      query: permissions.canReadMemberships,
      create: permissions.canManageMemberships,
      update: permissions.canManageMemberships,
      delete: permissions.canManageMemberships,
    },
    filter: { query: rules.canAccessShopRecords, update: rules.canAccessShopRecords, delete: rules.canAccessShopRecords },
  },
  ui: {
    listView: {
      initialColumns: ["name", "billingInterval", "price", "includedVisits", "status"],
    },
  },
  fields: {
    shop: relationship({ ref: "Shop.membershipPlans", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
    name: text({ validation: { isRequired: true } }),
    description: text({ ui: { displayMode: "textarea" } }),
    price: integer({ validation: { isRequired: true, min: 0 }, ui: { description: "Recurring price in cents." } }),
    billingInterval: select({
      type: "enum",
      options: [
        { label: "Monthly", value: "monthly" },
        { label: "Quarterly", value: "quarterly" },
        { label: "Annual", value: "annual" },
      ],
      defaultValue: "monthly",
    }),
    includedVisits: integer({ defaultValue: 1, validation: { min: 0 } }),
    discountPercent: integer({ defaultValue: 0, validation: { min: 0, max: 100 } }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Paused", value: "paused" },
        { label: "Archived", value: "archived" },
      ],
      defaultValue: "active",
    }),
    members: relationship({ ref: "CustomerPackage.membershipPlan", many: true, access: { create: () => false, update: () => false } }),
    events: relationship({ ref: "MembershipEvent.membershipPlan", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields,
  },
});
