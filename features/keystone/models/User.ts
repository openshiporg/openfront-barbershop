import { list } from '@keystone-6/core'
import { allOperations, denyAll } from '@keystone-6/core/access'
import { password, relationship, select, text } from '@keystone-6/core/fields'

import { trackingFields } from './trackingFields'
import { isSignedIn, permissions } from '../access'
import { currentActiveShopIds, hasCurrentRolePermission } from '../utils/currentAuthorization'
import { canReadPeople, canUpdatePeople } from '../utils/peopleAccess'

// role is listed because createAuth merges initFirstItem itemData into the
// input; public callers still cannot set it (role field create access).
const PUBLIC_USER_CREATE_FIELDS = new Set(['name', 'email', 'password', 'role'])

export const User = list({
  access: {
    operation: {
      ...allOperations(isSignedIn),
      // Like E-commerce: public self-registration is always allowed, but a
      // non-administrator creator can only supply identity fields (see
      // resolveInput); role, memberships, shop and profile links stay locked.
      create: () => true,
      delete: ({ session, context }) => hasCurrentRolePermission(session, 'canManageRoles', context.prisma),
    },
    filter: {
      query: canReadPeople,
      update: canUpdatePeople,
    },
  },
  hooks: {
    resolveInput: async ({ operation, inputData, resolvedData, context }) => {
      if (operation !== 'create') return resolvedData;
      if (await hasCurrentRolePermission(context.session, 'canManageRoles', context.prisma)) return resolvedData;
      const restricted = { ...resolvedData } as Record<string, unknown>;
      // inputData is the caller-controlled boundary; resolvedData also carries
      // trusted defaults and createAuth initFirstItem data (the first admin role).
      for (const key of Object.keys(inputData ?? {})) {
        if (!PUBLIC_USER_CREATE_FIELDS.has(key)) delete restricted[key];
      }
      return restricted as typeof resolvedData;
    },
  },
  ui: {
    hideCreate: args => !permissions.canManageRoles(args),
    hideDelete: args => !permissions.canManageRoles(args),
    listView: {
      initialColumns: ['name', 'email', 'role', 'barberProfile', 'customerProfile'],
    },
    itemView: {
      defaultFieldMode: ({ session, item }) => {
        // Global User identity fields are editable only by the user or platform role administrator.
        if (session?.itemId === item?.id || permissions.canManageRoles({ session })) return 'edit'

        // else, default all fields to read mode
        return 'read'
      },
    },
  },
  fields: {
    name: text({
      validation: {
        isRequired: true,
      },
    }),
    email: text({
      isFilterable: false,
      isOrderable: false,
      isIndexed: 'unique',
      validation: {
        isRequired: true,
      },
    }),
    password: password({
      access: {
        read: denyAll,
        update: async ({ session, item, context }) =>
          (await hasCurrentRolePermission(session, 'canManageRoles', context.prisma)) || session?.itemId === item.id,
      },
      validation: { isRequired: true },
    }),
    role: relationship({
      ref: 'Role.assignedTo',
      access: {
        // Self may read its own role (dashboard gate/onboarding); other users' roles
        // stay limited to the current role administrator. Role list access still
        // filters what the relationship resolves to.
        read: async ({ session, item, context }) =>
          Boolean(session?.itemId && session.itemId === item.id)
          || hasCurrentRolePermission(session, 'canManageRoles', context.prisma),
        create: ({ session, context }) => hasCurrentRolePermission(session, 'canManageRoles', context.prisma),
        update: ({ session, context }) => hasCurrentRolePermission(session, 'canManageRoles', context.prisma),
      },
      ui: {
        itemView: {
          fieldMode: args => (permissions.canManageRoles(args) ? 'edit' : 'read'),
        },
      },
    }),
    barberProfile: relationship({
      ref: 'Barber.user',
      access: { create: () => false, update: () => false },
      ui: {
        itemView: { fieldMode: args => (permissions.canManageStaff(args) ? 'edit' : 'read') },
      },
    }),
    shopMemberships: relationship({
      ref: 'ShopMembership.user',
      many: true,
      access: { create: () => false, update: () => false },
      ui: { itemView: { fieldMode: 'read' } },
    }),
    activeShop: relationship({
      ref: 'Shop.activeUsers',
      access: {
        read: async ({ session, item, context }) => {
          if (!session?.itemId) return false;
          if (session.itemId === item.id) return true;
          if (await hasCurrentRolePermission(session, 'canManageRoles', context.prisma)) return true;
          const activeShopId = typeof item.activeShopId === 'string' ? item.activeShopId : undefined;
          return Boolean(activeShopId && (await currentActiveShopIds(session, context.prisma)).includes(activeShopId));
        },
        create: () => false,
        update: () => false,
      },
      ui: { itemView: { fieldMode: 'read' } },
    }),
    customerProfile: relationship({
      ref: 'Customer.user',
      access: { create: () => false, update: () => false },
      ui: {
        itemView: { fieldMode: args => (permissions.canManageCustomers(args) ? 'edit' : 'read') },
      },
    }),
    bookings: relationship({ ref: 'Appointment.account', many: true, access: { create: () => false, update: () => false } }),
    onboardingStatus: select({
      type: 'enum',
      options: [
        { label: 'Not Started', value: 'not_started' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Completed', value: 'completed' },
        { label: 'Dismissed', value: 'dismissed' },
      ],
      defaultValue: 'not_started',
    }),
    ...trackingFields,
  },
});