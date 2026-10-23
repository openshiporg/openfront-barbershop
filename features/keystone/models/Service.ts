import { list, graphql } from "@keystone-6/core";
import { checkbox, integer, relationship, select, text, virtual } from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { trackingFields } from "./trackingFields";
import { validateShopRelationships } from "../utils/shopRelationshipHooks";
import { createCrudLifecycleAfterOperation } from "../utils/crudLifecycleHooks";
import { hashWaiverText } from "../utils/waiverEvidence";

function validateWaiverTemplate(args: { item?: Record<string, unknown>; resolvedData: Record<string, unknown>; addValidationError(message: string): void }) {
  const required = args.resolvedData.waiverRequired ?? args.item?.waiverRequired;
  if (!required) return;
  const key = String(args.resolvedData.waiverTemplateKey ?? args.item?.waiverTemplateKey ?? '').trim();
  const version = String(args.resolvedData.waiverTemplateVersion ?? args.item?.waiverTemplateVersion ?? '').trim();
  const text = String(args.resolvedData.waiverTemplateText ?? args.item?.waiverTemplateText ?? '');
  const digest = String(args.resolvedData.waiverTemplateHash ?? args.item?.waiverTemplateHash ?? '').trim();
  if (!key || !version || !text || !digest || hashWaiverText(text) !== digest) {
    args.addValidationError('Waiver-required services need a key, version, exact text, and matching SHA-256 hash.');
  }
  const previousText = String(args.item?.waiverTemplateText ?? '');
  const previousHash = String(args.item?.waiverTemplateHash ?? '');
  const previousVersion = String(args.item?.waiverTemplateVersion ?? '');
  if (args.item && (text !== previousText || digest !== previousHash) && version === previousVersion) {
    args.addValidationError('Changing waiver text or hash requires a new template version.');
  }
}

function validateDeposit(args: { resolvedData: Record<string, unknown>; item?: Record<string, unknown>; addValidationError(message: string): void }) {
  const data = { ...args.item, ...args.resolvedData };
  const price = Number(data.price ?? 0);
  const deposit = Number(data.depositAmount ?? 0);
  if (deposit > price) args.addValidationError("The deposit cannot be more than the service price.");
  if (data.depositRequired === true && !(deposit > 0)) args.addValidationError("Set a deposit amount above zero, or turn off the deposit requirement.");
}

const formatCurrency = (cents?: number | null) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);

export const Service = list({
  hooks: {
    validate: {
      create: async (args) => {
        validateWaiverTemplate(args as never);
        validateDeposit(args as never);
        await validateShopRelationships(args, [
          { field: "category", delegate: "serviceCategory" },
          { field: "specialists", delegate: "barber", many: true },
        ]);
      },
      update: async (args) => {
        validateWaiverTemplate(args as never);
        validateDeposit(args as never);
        await validateShopRelationships(args, [
          { field: "category", delegate: "serviceCategory" },
          { field: "specialists", delegate: "barber", many: true },
        ]);
      },
    },
    afterOperation: createCrudLifecycleAfterOperation("service"),
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
      initialColumns: ["name", "category", "price", "durationMinutes", "status"],
    },
  },
  fields: {
    shop: relationship({ ref: 'Shop.services', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') }, access: { update: () => false } }),
    name: text({ validation: { isRequired: true } }),
    description: text({ ui: { displayMode: "textarea" } }),
    imagePath: text({ ui: { description: "Relative public image path, e.g. /images/barbershop/service-classic-cut.svg." } }),
    durationMinutes: integer({ validation: { isRequired: true, min: 5 }, defaultValue: 30 }),
    price: integer({ validation: { isRequired: true, min: 0 }, ui: { description: "Base price in cents." } }),
    depositRequired: checkbox({ defaultValue: false }),
    depositAmount: integer({ defaultValue: 0, validation: { min: 0 }, ui: { description: "Deposit amount in cents." } }),
    credentialRequired: checkbox({ defaultValue: false, ui: { description: "Only book, seat and complete this service with a barber who holds an active practitioner credential for it." } }),
    waiverRequired: checkbox({ defaultValue: false, ui: { description: "Fail-closed: public booking/start requires a complete immutable waiver template and signer evidence." } }),
    waiverTemplateKey: text({ ui: { description: "Stable merchant-controlled waiver template key." } }),
    waiverTemplateVersion: text({ ui: { description: "Immutable displayed template version." } }),
    waiverTemplateText: text({ ui: { displayMode: "textarea", description: "Exact text presented to the signer." } }),
    waiverTemplateHash: text({ ui: { description: "SHA-256 digest of the exact waiver text." } }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Hidden", value: "hidden" },
        { label: "Archived", value: "archived" },
      ],
      defaultValue: "active",
    }),
    bookingBufferMinutes: integer({ defaultValue: 10, validation: { min: 0, max: 240 } }),
    color: text({ defaultValue: "#111827", ui: { description: "Calendar color for this service." } }),
    category: relationship({ ref: "ServiceCategory.services" }),
    specialists: relationship({ ref: "Barber.specialties", many: true }),
    practitionerCredentials: relationship({ ref: "PractitionerCredential.service", many: true }),
    appointments: relationship({
      ref: "Appointment.service",
      many: true,
      access: { create: () => false, update: () => false },
    }),
    appointmentLineItems: relationship({
      ref: "AppointmentLineItem.service",
      many: true,
      access: { create: () => false, update: () => false },
    }),
    packageItems: relationship({ ref: "ServicePackageItem.service", many: true }),
    formattedPrice: virtual({
      field: graphql.field({
        type: graphql.String,
        resolve(item) {
          return formatCurrency(item.price as number);
        },
      }),
    }),
    displayLabel: virtual({
      field: graphql.field({
        type: graphql.String,
        resolve(item) {
          return `${item.name} · ${item.durationMinutes} min · ${formatCurrency(item.price as number)}`;
        },
      }),
    }),
    ...trackingFields,
  },
});
