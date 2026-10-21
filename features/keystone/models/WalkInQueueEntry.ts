import { list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { trackingFields } from "./trackingFields";
import { validateShopRelationships } from "../utils/shopRelationshipHooks";

export const WalkInQueueEntry = list({
  hooks: {
    validate: {
      create: (args) => validateShopRelationships(args, [
        { field: "requestedService", delegate: "service" },
        { field: "requestedBarber", delegate: "barber" },
        { field: "customer", delegate: "customer" },
      ]),
      update: (args) => validateShopRelationships(args, [
        { field: "requestedService", delegate: "service" },
        { field: "requestedBarber", delegate: "barber" },
        { field: "customer", delegate: "customer" },
      ]),
    },
  },
  access: {
    operation: {
      query: permissions.canReadQueue,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: { query: rules.canAccessShopRecords },
  },
  ui: {
    listView: {
      initialColumns: ["customerName", "status", "requestedBarber", "quotedWaitMinutes", "checkedInAt"],
    },
  },
  fields: {
    shop: relationship({ ref: "Shop.queueEntries", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
    customerName: text({ validation: { isRequired: true } }),
    phone: text(),
    partySize: integer({ defaultValue: 1 }),
    status: select({
      type: "enum",
      options: [
        { label: "Waiting", value: "waiting" },
        { label: "Texted", value: "texted" },
        { label: "In Chair", value: "in_chair" },
        { label: "Served", value: "served" },
        { label: "Left", value: "left" },
      ],
      defaultValue: "waiting",
    }),
    requestedService: relationship({ ref: "Service" }),
    requestedBarber: relationship({ ref: "Barber.queueEntries" }),
    // No invented estimate: empty until staff actually quote a wait.
    quotedWaitMinutes: integer({ validation: { min: 0 } }),
    checkedInAt: timestamp({ defaultValue: { kind: "now" } }),
    seatedAt: timestamp(),
    notes: text({ ui: { displayMode: "textarea" } }),
    publicAccessTokenHash: text({
      access: { read: () => false, create: permissions.canManageQueue, update: permissions.canManageQueue },
      ui: { itemView: { fieldMode: "hidden" }, createView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } },
    }),
    appointment: relationship({ ref: "Appointment.queueEntry" }),
    customer: relationship({ ref: "Customer" }),
    ...trackingFields,
  },
});
