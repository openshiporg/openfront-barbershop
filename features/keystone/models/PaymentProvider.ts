import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { checkbox, json, relationship, text } from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { trackingFields } from "./trackingFields";
import { validateShopRelationships } from "../utils/shopRelationshipHooks";

const adapterDescription = "Name of the payment adapter module to use for this operation";

const ADAPTER_IDENTITY_FIELDS = [
  "code",
  "createPaymentFunction",
  "capturePaymentFunction",
  "refundPaymentFunction",
  "getPaymentStatusFunction",
  "generatePaymentLinkFunction",
  "handleWebhookFunction",
];

type ProviderSessionPrisma = {
  paymentSession: { count(args: { where: Record<string, unknown> }): Promise<number> };
};

// Open payment sessions were started against this provider's adapter. Changing its
// code or adapter selectors would silently change how those sessions are handled.
async function rejectAdapterChangeWithOpenSessions(args: {
  item?: Record<string, unknown>;
  resolvedData: Record<string, unknown>;
  context: { prisma: unknown };
  addValidationError(message: string): void;
}) {
  const changesAdapter = ADAPTER_IDENTITY_FIELDS.some(
    (field) => field in args.resolvedData && args.resolvedData[field] !== args.item?.[field]
  );
  if (!changesAdapter || typeof args.item?.id !== "string") return;
  const openSessions = await (args.context.prisma as ProviderSessionPrisma).paymentSession.count({
    where: { paymentProviderId: args.item.id, status: { in: ["pending", "authorized", "captured", "partially_refunded"] } },
  });
  if (openSessions > 0) {
    args.addValidationError("This provider has open payment sessions. Close or reconcile them before changing its code or adapters.");
  }
}

export const PaymentProvider = list({
  hooks: {
    validate: {
      create: (args) => validateShopRelationships(args, []),
      update: async (args) => {
        await validateShopRelationships(args, []);
        await rejectAdapterChangeWithOpenSessions(args);
      },
    },
  },
  access: {
    operation: {
      query: ({ session }) =>
        permissions.canReadPayments({ session }) ||
        permissions.canManagePayments({ session }),
      create: permissions.canManagePayments,
      update: permissions.canManagePayments,
      delete: permissions.canManagePayments,
    },
    filter: { query: rules.canAccessShopRecords, update: rules.canAccessShopRecords, delete: rules.canAccessShopRecords },
  },
  ui: {
    listView: {
      initialColumns: ["name", "code", "isInstalled"],
    },
  },
  fields: {
    shop: relationship({ ref: "Shop.paymentProviders", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
    name: text({
      validation: { isRequired: true },
    }),
    code: text({
      isIndexed: true,
      validation: {
        isRequired: true,
        match: {
          regex: /^pp_[a-zA-Z0-9-_]+$/,
          explanation:
            'Payment provider code must start with "pp_" followed by alphanumeric characters, hyphens or underscores',
        },
      },
    }),
    isInstalled: checkbox({
      defaultValue: true,
    }),
    credentials: json({
      defaultValue: {},
      access: {
        read: denyAll,
        create: denyAll,
        update: denyAll,
      },
      ui: {
        itemView: { fieldMode: "hidden" },
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" },
        description: "Provider-specific credentials or references. Values are write-only and never exposed through GraphQL.",
      },
    }),
    metadata: json({
      defaultValue: {},
    }),
    createPaymentFunction: text({
      validation: { isRequired: true },
      defaultValue: "manual",
      ui: { description: adapterDescription },
    }),
    capturePaymentFunction: text({
      validation: { isRequired: true },
      defaultValue: "manual",
      ui: { description: adapterDescription },
    }),
    refundPaymentFunction: text({
      validation: { isRequired: true },
      defaultValue: "manual",
      ui: { description: adapterDescription },
    }),
    getPaymentStatusFunction: text({
      validation: { isRequired: true },
      defaultValue: "manual",
      ui: { description: adapterDescription },
    }),
    generatePaymentLinkFunction: text({
      validation: { isRequired: true },
      defaultValue: "manual",
      ui: { description: adapterDescription },
    }),
    paymentSessions: relationship({ ref: "PaymentSession.paymentProvider", many: true, access: { create: () => false, update: () => false } }),
    handleWebhookFunction: text({
      validation: { isRequired: true },
      defaultValue: "manual",
      ui: { description: adapterDescription },
    }),
    ...trackingFields,
  },
});
