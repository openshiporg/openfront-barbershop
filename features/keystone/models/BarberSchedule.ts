import { list, graphql } from "@keystone-6/core";
import { checkbox, integer, relationship, select, text, virtual } from "@keystone-6/core/fields";

import { type Session } from "../access";
import { currentShopForPermission } from '../utils/currentAuthorization';
import { validateSchedule } from '../utils/childRecordValidation';
import { trackingFields } from "./trackingFields";

const currentScheduleAccess = async ({ session }: { session?: Session }) =>
  Boolean(await currentShopForPermission(session, 'canManageSchedules'));

const currentScheduleFilter = async (session?: Session) => {
  const shopId = await currentShopForPermission(session, 'canManageSchedules');
  return shopId ? { barber: { shop: { id: { equals: shopId } } } } : false;
};

const minutesToTime = (minutes?: number | null) => {
  const value = minutes ?? 0;
  const hours = Math.floor(value / 60).toString().padStart(2, "0");
  const mins = (value % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
};

export const BarberSchedule = list({
  db: { extendPrismaSchema: (schema) => schema.replace(/\n}$/, '\n  @@unique([barberId, dayOfWeek])\n}') },
  hooks: { validate: { create: validateSchedule, update: validateSchedule, delete: (args) => validateSchedule({ ...args, resolvedData: {}, operation: 'delete' } as never) } },
  access: {
    operation: {
      query: currentScheduleAccess,
      create: currentScheduleAccess,
      update: currentScheduleAccess,
      delete: currentScheduleAccess,
    },
    filter: {
      query: ({ session }) => currentScheduleFilter(session),
      update: ({ session }) => currentScheduleFilter(session),
      delete: ({ session }) => currentScheduleFilter(session),
    },
  },
  ui: {
    listView: {
      initialColumns: ["barber", "dayOfWeek", "startMinute", "endMinute", "isWorking"],
    },
  },
  fields: {
    barber: relationship({ ref: "Barber.schedules", many: false, access: { update: () => false } }),
    dayOfWeek: select({
      type: "enum",
      options: [
        { label: "Monday", value: "monday" },
        { label: "Tuesday", value: "tuesday" },
        { label: "Wednesday", value: "wednesday" },
        { label: "Thursday", value: "thursday" },
        { label: "Friday", value: "friday" },
        { label: "Saturday", value: "saturday" },
        { label: "Sunday", value: "sunday" },
      ],
      validation: { isRequired: true },
    }),
    isWorking: checkbox({ defaultValue: true }),
    startMinute: integer({ defaultValue: 540, validation: { min: 0, max: 1440 }, ui: { description: "Minutes after midnight. 540 = 9:00 AM." } }),
    endMinute: integer({ defaultValue: 1020, validation: { min: 0, max: 1440 }, ui: { description: "Minutes after midnight. 1020 = 5:00 PM." } }),
    breakStartMinute: integer({ ui: { description: "Optional break start in minutes after midnight." } }),
    breakEndMinute: integer({ ui: { description: "Optional break end in minutes after midnight." } }),
    notes: text({ ui: { displayMode: "textarea" } }),
    displayWindow: virtual({
      field: graphql.field({
        type: graphql.String,
        resolve(item) {
          if (!item.isWorking) return "Off";
          return `${minutesToTime(item.startMinute as number)}–${minutesToTime(item.endMinute as number)}`;
        },
      }),
    }),
    ...trackingFields,
  },
});
