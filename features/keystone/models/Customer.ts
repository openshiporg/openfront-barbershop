import { list, graphql } from "@keystone-6/core";
import { checkbox, relationship, select, text, timestamp, virtual } from "@keystone-6/core/fields";

import { type Session } from "../access";
import { currentShopForPermission } from '../utils/currentAuthorization';
import { trackingFields } from "./trackingFields";
import { validateShopRelationships } from "../utils/shopRelationshipHooks";
import { createCrudLifecycleAfterOperation } from "../utils/crudLifecycleHooks";

const currentCustomerAccess = async ({ session }: { session?: Session }) =>
  Boolean(await currentShopForPermission(session, 'canManageCustomers'));

const currentCustomerFilter = async (session?: Session) => {
  const shopId = await currentShopForPermission(session, 'canManageCustomers');
  return shopId ? { shop: { id: { equals: shopId } } } : false;
};

export const Customer = list({
  hooks: {
    validate: {
      create: (args) => validateShopRelationships(args, [{ field: "preferredBarber", delegate: "barber" }]),
      update: (args) => validateShopRelationships(args, [{ field: "preferredBarber", delegate: "barber" }]),
    },
    afterOperation: createCrudLifecycleAfterOperation("customer"),
  },
  access: {
    operation: {
      query: currentCustomerAccess,
      create: currentCustomerAccess,
      update: currentCustomerAccess,
      delete: currentCustomerAccess,
    },
    filter: {
      query: ({ session }) => currentCustomerFilter(session),
      update: ({ session }) => currentCustomerFilter(session),
      delete: ({ session }) => currentCustomerFilter(session),
    },
  },
  ui: {
    listView: {
      initialColumns: ["fullName", "phone", "email", "status", "appointments"],
    },
  },
  fields: {
    shop: relationship({ ref: 'Shop.customers', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') }, access: { update: () => false } }),
    firstName: text({ validation: { isRequired: true } }),
    lastName: text(),
    phone: text({ validation: { isRequired: true } }),
    email: text(),
    status: select({
      access: { update: () => false },
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "VIP", value: "vip" },
        { label: "Needs Attention", value: "needs_attention" },
        { label: "Blocked", value: "blocked" },
      ],
      defaultValue: "active",
    }),
    preferredContactMethod: select({
      access: { update: () => false },
      type: "enum",
      options: [
        { label: "SMS", value: "sms" },
        { label: "Email", value: "email" },
        { label: "Phone", value: "phone" },
      ],
      defaultValue: "sms",
    }),
    // Only the marketing-preference command writes this, with recorded provenance.
    acceptsMarketing: checkbox({ defaultValue: false, access: { create: () => false, update: () => false } }),
    birthday: timestamp(),
    lastVisitAt: timestamp(),
    user: relationship({ ref: "User.customerProfile", access: { create: () => false, update: () => false } }),
    preferredBarber: relationship({ ref: "Barber" }),
    appointments: relationship({ ref: "Appointment.customer", many: true, access: { create: () => false, update: () => false } }),
    notes: relationship({ ref: "CustomerNote.customer", many: true }),
    packageBalances: relationship({ ref: "CustomerPackage.customer", many: true, access: { create: () => false, update: () => false } }),
    membershipEvents: relationship({ ref: "MembershipEvent.customer", many: true, access: { create: () => false, update: () => false } }),
    transactions: relationship({ ref: "CheckoutTransaction.customer", many: true, access: { create: () => false, update: () => false } }),
    fullName: virtual({
      field: graphql.field({
        type: graphql.String,
        resolve(item) {
          return [item.firstName, item.lastName].filter(Boolean).join(" ");
        },
      }),
    }),
    ...trackingFields,
  },
});
