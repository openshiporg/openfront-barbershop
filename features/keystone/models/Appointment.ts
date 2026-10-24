import { list, graphql } from "@keystone-6/core";
import { integer, json, relationship, select, text, timestamp, virtual } from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { trackingFields } from "./trackingFields";
import { settledAppointmentMutationError } from "../utils/settledEvidence";
import { validateShopRelationships } from "../utils/shopRelationshipHooks";

export const Appointment = list({
  hooks: {
    validate: {
      create: (args) => validateShopRelationships(args, [
        { field: "chair", delegate: "barberChair" },
        { field: "customer", delegate: "customer" },
        { field: "barber", delegate: "barber" },
        { field: "service", delegate: "service" },
        { field: "queueEntry", delegate: "walkInQueueEntry" },
      ]),
      update: async (args) => {
        const error = settledAppointmentMutationError(args.item as { paymentStatus?: unknown }, args.resolvedData, "update");
        if (error) args.addValidationError(error);
        await validateShopRelationships(args, [
          { field: "chair", delegate: "barberChair" },
          { field: "customer", delegate: "customer" },
          { field: "barber", delegate: "barber" },
          { field: "service", delegate: "service" },
          { field: "queueEntry", delegate: "walkInQueueEntry" },
        ]);
      },
      delete: ({ item, addValidationError }) => {
        const error = settledAppointmentMutationError(item as { paymentStatus?: unknown }, {}, "delete");
        if (error) addValidationError(error);
      },
    },
  },
  access: {
    operation: {
      query: permissions.canReadAppointments,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: { query: rules.canAccessShopRecords },
  },
  ui: {
    listView: {
      initialColumns: ["customer", "service", "barber", "startsAt", "status", "paymentStatus"],
    },
  },
  fields: {
    shop: relationship({ ref: "Shop.appointments", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
    account: relationship({ ref: "User.bookings", access: { create: () => false, update: () => false }, db: { foreignKey: true } }),
    chair: relationship({ ref: "BarberChair.appointments", access: { update: () => false } }),
    customer: relationship({ ref: "Customer.appointments" }),
    barber: relationship({ ref: "Barber.appointments" }),
    service: relationship({ ref: "Service.appointments" }),
    startsAt: timestamp({ validation: { isRequired: true } }),
    endsAt: timestamp(),
    durationMinutes: integer({ defaultValue: 30 }),
    serviceTitleSnapshot: text({
      access: { update: () => false },
      ui: { description: "Immutable service title captured when the booking is created." },
    }),
    serviceImagePathSnapshot: text({
      access: { update: () => false },
      ui: { description: "Immutable relative service imagePath captured when the booking is created." },
    }),
    serviceModifiersSnapshot: json({
      defaultValue: [],
      access: { update: () => false },
      ui: { description: "Immutable service options captured when the booking is created." },
    }),
    barberNameSnapshot: text({
      access: { update: () => false },
      ui: { description: "Immutable barber display name captured when the booking is created." },
    }),
    barberChairNumberSnapshot: text({
      access: { update: () => false },
      ui: { description: "Immutable barber chair captured when the booking is created." },
    }),
    bookingAuthoritySnapshot: json({ access: { update: () => false }, ui: { description: "Credential, jurisdiction, service scope, and evidence captured at booking/assignment." } }),
    executionAuthoritySnapshot: json({ access: { update: () => false }, ui: { description: "Credential authority revalidated when service enters the chair." } }),
    bookingPolicySnapshot: json({ access: { update: () => false }, ui: { description: "Effective cancellation/reschedule terms captured at booking." } }),
    waiverRequirementSnapshot: json({ access: { update: () => false }, ui: { description: "Exact waiver template key/version/hash required for this occurrence." } }),
    serviceStartedAt: timestamp({ access: { update: () => false } }),
    serviceCompletedAt: timestamp({ access: { update: () => false } }),
    customerRescheduleCount: integer({ defaultValue: 0, access: { update: () => false } }),
    status: select({
      type: "enum",
      options: [
        { label: "Requested", value: "requested" },
        { label: "Confirmed", value: "confirmed" },
        { label: "Checked In", value: "checked_in" },
        { label: "In Chair", value: "in_chair" },
        { label: "Completed", value: "completed" },
        { label: "Cancelled", value: "cancelled" },
        { label: "No-show", value: "no_show" },
      ],
      defaultValue: "requested",
    }),
    source: select({
      type: "enum",
      options: [
        { label: "Online", value: "online" },
        { label: "Phone", value: "phone" },
        { label: "Walk-in", value: "walk_in" },
        { label: "Staff", value: "staff" },
      ],
      defaultValue: "online",
    }),
    paymentStatus: select({
      access: { update: () => false },
      type: "enum",
      options: [
        { label: "Not Required", value: "not_required" },
        { label: "Deposit Due", value: "deposit_due" },
        { label: "Deposit Paid", value: "deposit_paid" },
        { label: "Paid", value: "paid" },
        { label: "Refunded", value: "refunded" },
      ],
      defaultValue: "not_required",
    }),
    price: integer({ ui: { description: "Final service price in cents." } }),
    depositAmount: integer({ defaultValue: 0 }),
    cancellationReason: text({ ui: { displayMode: "textarea" } }),
    reminderSentAt: timestamp({ access: { create: () => false, update: () => false }, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } } }),
    customerNotes: text({ ui: { displayMode: "textarea" } }),
    guestNameSnapshot: text({ access: { create: () => false, update: () => false }, ui: { description: 'Unverified contact name supplied for this occurrence, not proof of customer identity.' } }),
    internalNotes: text({ ui: { displayMode: "textarea" } }),
    publicAccessTokenHash: text({
      access: { read: () => false, create: permissions.canManageAppointments, update: permissions.canManageAppointments },
      ui: { itemView: { fieldMode: "hidden" }, createView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } },
    }),
    queueEntry: relationship({ ref: "WalkInQueueEntry.appointment" }),
    transaction: relationship({
      ref: "CheckoutTransaction.appointments",
      access: { create: () => false, update: () => false },
    }),
    lineItems: relationship({ ref: "AppointmentLineItem.appointment", many: true }),
    paymentSessions: relationship({ ref: "PaymentSession.appointment", many: true }),
    noShowEvents: relationship({ ref: "NoShowEvent.appointment", many: true }),
    changeEvents: relationship({ ref: "AppointmentChangeEvent.appointment", many: true }),
    packageUsages: relationship({ ref: "PackageUsage.appointment", many: true }),
    displaySummary: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item, args, context) {
          const appointment = await context.query.Appointment.findOne({
            where: { id: String(item.id) },
            query: "customer { firstName lastName } service { name } barber { displayName }",
          });
          const customer = appointment?.customer
            ? [appointment.customer.firstName, appointment.customer.lastName].filter(Boolean).join(" ")
            : "Guest";
          return `${customer} · ${appointment?.service?.name || "Service"} · ${appointment?.barber?.displayName || "Any barber"}`;
        },
      }),
    }),
    ...trackingFields,
  },
});
