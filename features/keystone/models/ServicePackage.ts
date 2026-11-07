import { list } from "@keystone-6/core";
import { integer, relationship, select, text } from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { trackingFields } from "./trackingFields";
import { validateShopRelationships } from "../utils/shopRelationshipHooks";

export const ServicePackage = list({
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
      initialColumns: ["name", "price", "status", "items"],
    },
  },
  fields: {
    shop: relationship({ ref: 'Shop.servicePackages', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') }, access: { update: () => false } }),
    name: text({ validation: { isRequired: true } }),
    description: text({ ui: { displayMode: "textarea" } }),
    price: integer({ validation: { isRequired: true, min: 0 }, ui: { description: "Package price in cents." } }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Hidden", value: "hidden" },
        { label: "Archived", value: "archived" },
      ],
      defaultValue: "active",
    }),
    items: relationship({ ref: "ServicePackageItem.package", many: true }),
    customerBalances: relationship({ ref: "CustomerPackage.servicePackage", many: true }),
    ...trackingFields,
  },
});
