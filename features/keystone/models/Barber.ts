import { list, graphql } from "@keystone-6/core";
import { checkbox, integer, relationship, select, text, virtual } from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { trackingFields } from "./trackingFields";
import { validateShopRelationships } from "../utils/shopRelationshipHooks";
import { createCrudLifecycleAfterOperation } from "../utils/crudLifecycleHooks";
import { connectedRelationshipId } from "../utils/shopRelationshipHooks";
import { upcomingBarberAppointments } from "../utils/childRecordValidation";

export const Barber = list({
  hooks: {
    validate: {
      create: (args) => validateShopRelationships(args, [
        { field: "chair", delegate: "barberChair" },
        { field: "specialties", delegate: "service", many: true },
      ]),
      update: async (args) => {
        await validateShopRelationships(args, [
          { field: "chair", delegate: "barberChair" },
          { field: "specialties", delegate: "service", many: true },
        ]);
        // Upcoming bookings carry this barber's chair and availability; a staff
        // change must not silently invalidate them.
        const chairChanged = args.resolvedData.chair !== undefined
          && (connectedRelationshipId(args.resolvedData.chair) ?? null) !== (args.item.chairId ?? null);
        const leavesService = (args.resolvedData.status !== undefined && args.resolvedData.status !== "active")
          || (args.resolvedData.bufferMinutes !== undefined && Number(args.resolvedData.bufferMinutes) > Number(args.item.bufferMinutes ?? 0));
        if (chairChanged || leavesService) {
          const { appointments } = await upcomingBarberAppointments(args.context.prisma, String(args.item.id));
          if (appointments.length) args.addValidationError(`${appointments.length} upcoming appointment(s) are booked with this barber. Reassign, reschedule or cancel them before changing chair, status or buffer.`);
        }
      },
    },
    afterOperation: createCrudLifecycleAfterOperation("barber"),
  },
  access: {
    operation: {
      query: permissions.canReadStaff,
      create: permissions.canManageStaff,
      update: permissions.canManageStaff,
      delete: permissions.canManageStaff,
    },
    filter: {
      query: rules.canAccessShopRecords,
      update: rules.canAccessShopRecords,
      delete: rules.canAccessShopRecords,
    },
  },
  ui: {
    listView: {
      initialColumns: ["displayName", "chairNumber", "status", "bookingEnabled", "appointments"],
    },
  },
  fields: {
    shop: relationship({ ref: 'Shop.barbers', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') }, access: { update: () => false } }),
    chair: relationship({ ref: 'BarberChair.assignedBarbers' }),
    displayName: text({ validation: { isRequired: true } }),
    legalName: text(),
    bio: text({ ui: { displayMode: "textarea" } }),
    imagePath: text({ ui: { description: "Relative public portrait path, e.g. /images/barbershop/barber-maya-brooks.svg." } }),
    phone: text(),
    email: text(),
    chairNumber: text({ ui: { description: "Chair or station shown on the shop floor." } }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Away", value: "away" },
        { label: "Inactive", value: "inactive" },
      ],
      defaultValue: "active",
    }),
    bookingEnabled: checkbox({ defaultValue: true }),
    bufferMinutes: integer({ defaultValue: 10, validation: { min: 0, max: 240 }, ui: { description: "Default cleanup/buffer after appointments." } }),
    serviceCommissionRateBps: integer({
      defaultValue: 0,
      validation: { min: 0, max: 10000 },
      ui: { description: "Service commission in basis points (4500 = 45%)." },
    }),
    user: relationship({ ref: "User.barberProfile" }),
    specialties: relationship({ ref: "Service.specialists", many: true }),
    credentials: relationship({ ref: "PractitionerCredential.barber", many: true, access: { create: () => false, update: () => false } }),
    supervisedCredentials: relationship({ ref: "PractitionerCredential.supervisor", many: true, access: { create: () => false, update: () => false } }),
    schedules: relationship({ ref: "BarberSchedule.barber", many: true, access: { create: () => false, update: () => false } }),
    scheduleExceptions: relationship({ ref: "ScheduleException.barber", many: true, access: { create: () => false, update: () => false } }),
    shifts: relationship({ ref: "StaffShift.barber", many: true, access: { create: () => false, update: () => false } }),
    appointments: relationship({ ref: "Appointment.barber", many: true, access: { create: () => false, update: () => false } }),
    commissions: relationship({ ref: "Commission.barber", many: true, access: { create: () => false, update: () => false } }),
    queueEntries: relationship({ ref: "WalkInQueueEntry.requestedBarber", many: true, access: { create: () => false, update: () => false } }),
    label: virtual({
      field: graphql.field({
        type: graphql.String,
        resolve(item) {
          const displayName = typeof item.displayName === "string" ? item.displayName : "Barber";
          return item.chairNumber ? `${displayName} · Chair ${item.chairNumber}` : displayName;
        },
      }),
    }),
    ...trackingFields,
  },
});
