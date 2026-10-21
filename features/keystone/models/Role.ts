import { list } from '@keystone-6/core'
import { checkbox, relationship, text } from '@keystone-6/core/fields'

import { trackingFields } from './trackingFields'
import { permissions, type Session } from '../access'
import { hasCurrentRolePermission } from '../utils/currentAuthorization'

type CurrentRolePrisma = {
  user: {
    findUnique(args: {
      where: { id: string }
      select: { roleId: true; role: { select: { canManageRoles: true } } }
    }): Promise<{ roleId: string | null; role: { canManageRoles: boolean } | null } | null>
  }
}

/**
 * Durable role scope for the signed-in user. Stale cookie flags are never
 * authority: deleted, role-less or revoked users get no Role visibility, current
 * role managers see every Role, and everyone else sees only their own Role so the
 * dashboard can read `authenticatedItem.role` for its access gate.
 */
async function currentRoleScope(session: Session | undefined, prisma: CurrentRolePrisma) {
  if (!session?.itemId) return null
  const user = await prisma.user.findUnique({
    where: { id: session.itemId },
    select: { roleId: true, role: { select: { canManageRoles: true } } },
  })
  if (!user?.roleId || !user.role) return null
  return user.role.canManageRoles ? ('all' as const) : { roleId: user.roleId }
}

export const Role = list({
  access: {
    operation: {
      query: async ({ session, context }) => Boolean(await currentRoleScope(session, context.prisma)),
      create: ({ session, context }) => hasCurrentRolePermission(session, 'canManageRoles', context.prisma),
      update: ({ session, context }) => hasCurrentRolePermission(session, 'canManageRoles', context.prisma),
      delete: ({ session, context }) => hasCurrentRolePermission(session, 'canManageRoles', context.prisma),
    },
    filter: {
      query: async ({ session, context }) => {
        const scope = await currentRoleScope(session, context.prisma)
        if (!scope) return false
        if (scope === 'all') return true
        return { id: { equals: scope.roleId } }
      },
    },
  },
  ui: {
    hideCreate: args => !permissions.canManageRoles(args),
    hideDelete: args => !permissions.canManageRoles(args),
    listView: {
      initialColumns: ['name', 'assignedTo'],
    },
    itemView: {
      defaultFieldMode: args => (permissions.canManageRoles(args) ? 'edit' : 'read'),
    },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    canSeeOtherPeople: checkbox({ defaultValue: false }),
    canEditOtherPeople: checkbox({ defaultValue: false }),
    canManagePeople: checkbox({ defaultValue: false }),
    canManageRoles: checkbox({ defaultValue: false }),
    canAccessDashboard: checkbox({ defaultValue: false }),
    canManageOnboarding: checkbox({ defaultValue: false }),
    canManageServices: checkbox({ defaultValue: false }),
    canManageStaff: checkbox({ defaultValue: false }),
    canManageSchedules: checkbox({ defaultValue: false }),
    canManageAppointments: checkbox({ defaultValue: false }),
    canManageQueue: checkbox({ defaultValue: false }),
    canManageCustomers: checkbox({ defaultValue: false }),
    canManageCustomerNotes: checkbox({ defaultValue: false }),
    canManageMemberships: checkbox({ defaultValue: false }),
    canManagePayments: checkbox({ defaultValue: false }),
    canViewReports: checkbox({ defaultValue: false }),
    assignedTo: relationship({
      ref: 'User.role',
      many: true,
      // Own-role visibility must not expose who else holds the role (across shops).
      access: {
        read: ({ session, context }) => hasCurrentRolePermission(session, 'canManageRoles', context.prisma),
      },
      ui: {
        itemView: { fieldMode: 'read' },
      },
    }),
    ...trackingFields,
  },
});