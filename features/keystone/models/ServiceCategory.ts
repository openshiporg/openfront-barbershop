import { list } from "@keystone-6/core";
import { integer, relationship, select, text } from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { trackingFields } from "./trackingFields";
import { validateShopRelationships } from "../utils/shopRelationshipHooks";

export const ServiceCategory = list({
  hooks: {
    validate: {
      create: (args) => validateShopRelationships(args, []),
      update: (args) => validateShopRelationships(args, []),
    },
  },
  access: {
    operation: {
      query: permissions.canReadServices,
      create: permissions.canManageServices,
      update: permissions.canManageServices,
      delete: permissions.canManageServices,
    },
    filter: {
      query: rules.canAccessShopRecords,
      update: rules.canAccessShopRecords,
      delete: rules.canAccessShopRecords,
    },
  },
  ui: {
    listView: {
      initialColumns: ["name", "status", "displayOrder", "services"],
    },
  },
  fields: {
    shop: relationship({ ref: "Shop.serviceCategories", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
    name: text({ validation: { isRequired: true } }),
    description: text({ ui: { displayMode: "textarea" } }),
    displayOrder: integer({ defaultValue: 0 }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Hidden", value: "hidden" },
      ],
      defaultValue: "active",
    }),
    services: relationship({ ref: "Service.category", many: true }),
    ...trackingFields,
  },
});
