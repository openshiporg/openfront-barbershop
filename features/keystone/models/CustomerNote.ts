import { list } from "@keystone-6/core";
import { relationship, select, text } from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { validateShopRelationships } from "../utils/shopRelationshipHooks";
import { trackingFields } from "./trackingFields";

export const CustomerNote = list({
  hooks: {
    validate: {
      create: (args) => validateShopRelationships(args, [
        { field: "customer", delegate: "customer" },
        { field: "appointment", delegate: "appointment" },
      ]),
      update: (args) => validateShopRelationships(args, [
        { field: "customer", delegate: "customer" },
        { field: "appointment", delegate: "appointment" },
      ]),
    },
  },
  access: {
    operation: {
      query: permissions.canReadCustomerNotes,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: { query: rules.canReadCustomerNotes },
  },
  ui: {
    listView: {
      initialColumns: ["customer", "noteType", "visibility", "createdAt"],
    },
  },
  fields: {
    shop: relationship({ ref: "Shop.customerNotes", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") } }),
    customer: relationship({ ref: "Customer.notes" }),
    noteType: select({
      type: "enum",
      options: [
        { label: "Preference", value: "preference" },
        { label: "Formula / Cut Detail", value: "formula" },
        { label: "Service Issue", value: "service_issue" },
        { label: "General", value: "general" },
      ],
      defaultValue: "general",
    }),
    body: text({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    visibility: select({
      type: "enum",
      options: [
        { label: "Staff", value: "staff" },
        { label: "Owner Only", value: "owner" },
      ],
      defaultValue: "staff",
    }),
    appointment: relationship({ ref: "Appointment" }),
    createdBy: relationship({ ref: "User" }),
    ...trackingFields,
  },
});
