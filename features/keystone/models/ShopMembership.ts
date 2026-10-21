import { list } from '@keystone-6/core';
import { relationship, select, text } from '@keystone-6/core/fields';

import { isSignedIn, type Session } from '../access';
import { currentManagedActiveShopIds } from '../utils/currentAuthorization';
import { trackingFields } from './trackingFields';

type MembershipPrisma = Parameters<typeof currentManagedActiveShopIds>[1] & {
  shopMembership: {
    findFirst(args: Record<string, unknown>): Promise<{ id: string; membershipRole: string | null } | null>;
    count(args: Record<string, unknown>): Promise<number>;
  };
};
type MembershipContext = { session?: Session; prisma: MembershipPrisma };

const MANAGER_GRANTABLE_ROLES = new Set(['front_desk', 'barber', 'viewer']);
const PRIVILEGED_ROLES = new Set(['owner', 'manager']);

async function actorShopRole(context: MembershipContext, shopId: string) {
  const session = context.session;
  if (!session?.itemId || !(await currentManagedActiveShopIds(session, context.prisma)).includes(shopId)) return null;
  const membership = await context.prisma.shopMembership.findFirst({
    where: { userId: session.itemId, shopId, status: 'active', shop: { status: 'active' } },
    select: { id: true, membershipRole: true },
  });
  return membership?.membershipRole === 'owner' || membership?.membershipRole === 'manager' ? membership.membershipRole : null;
}

async function canCreateMembership({ session, context }: { session?: Session; context: MembershipContext }) {
  return (await currentManagedActiveShopIds(session, context.prisma)).length > 0;
}

async function canReadMemberships({ session, context }: { session?: Session; context: MembershipContext }) {
  if (!session) return false;
  const shopIds = await currentManagedActiveShopIds(session, context.prisma);
  return {
    OR: [
      { user: { id: { equals: session.itemId } } },
      ...(shopIds.length > 0 ? [{ shop: { id: { in: shopIds } } }] : []),
    ],
  };
}

async function canManageMemberships({ session, context }: { session?: Session; context: MembershipContext }) {
  const shopIds = await currentManagedActiveShopIds(session, context.prisma);
  return shopIds.length > 0 ? { shop: { id: { in: shopIds } } } : false;
}

/**
 * Owners may grant or change any role, including transferring ownership.
 * Managers may only grant, change or revoke front desk, barber and viewer
 * memberships. Every shop always keeps at least one active owner.
 */
export const ShopMembership = list({
  hooks: {
    resolveInput: ({ operation, resolvedData }) => {
      if (operation !== 'create') return resolvedData;
      const shopId = (resolvedData.shop as { connect?: { id?: string } } | undefined)?.connect?.id;
      const userId = (resolvedData.user as { connect?: { id?: string } } | undefined)?.connect?.id;
      // The key is server-owned: supported admin creation must not require
      // callers to write the intentionally inaccessible identity field.
      return shopId && userId ? { ...resolvedData, membershipKey: `${shopId}:${userId}` } : resolvedData;
    },
    validate: {
      create: async ({ resolvedData, context, addValidationError }) => {
        const shopId = (resolvedData.shop as { connect?: { id?: string } } | undefined)?.connect?.id;
        const actorRole = shopId ? await actorShopRole(context as unknown as MembershipContext, shopId) : null;
        if (!shopId || !actorRole) {
          addValidationError('Not authorized to create a membership for this active shop.');
          return;
        }
        const role = String(resolvedData.membershipRole || 'viewer');
        if (actorRole !== 'owner' && !MANAGER_GRANTABLE_ROLES.has(role)) {
          addValidationError('Only a shop owner can grant owner or manager access.');
        }
      },
      update: async ({ resolvedData, item, context, addValidationError }) => {
        const membershipContext = context as unknown as MembershipContext;
        const shopId = String(item.shopId || '');
        const actorRole = await actorShopRole(membershipContext, shopId);
        if (!actorRole) {
          addValidationError('Not authorized to change memberships for this shop.');
          return;
        }
        const currentRole = String(item.membershipRole || 'viewer');
        const nextRole = String(resolvedData.membershipRole ?? currentRole);
        const nextStatus = String(resolvedData.status ?? item.status ?? '');
        if (actorRole !== 'owner' && (PRIVILEGED_ROLES.has(currentRole) || PRIVILEGED_ROLES.has(nextRole))) {
          addValidationError('Only a shop owner can change owner or manager access.');
          return;
        }
        if (item.status === 'revoked' && nextStatus !== 'revoked' && actorRole !== 'owner') {
          addValidationError('Only a shop owner can restore a revoked membership.');
          return;
        }
        const losesOwner = currentRole === 'owner' && item.status === 'active' && (nextRole !== 'owner' || nextStatus !== 'active');
        if (losesOwner) {
          const otherOwners = await membershipContext.prisma.shopMembership.count({
            where: { shopId, id: { not: String(item.id) }, membershipRole: 'owner', status: 'active' },
          });
          if (otherOwners < 1) addValidationError('A shop must keep at least one active owner. Grant another owner first.');
        }
      },
    },
  },
  access: {
    operation: {
      query: isSignedIn,
      create: canCreateMembership,
      update: isSignedIn,
      // Revoke instead of deleting so membership history is preserved.
      delete: () => false,
    },
    filter: {
      query: canReadMemberships,
      update: canManageMemberships,
      delete: canManageMemberships,
    },
  },
  ui: {
    listView: { initialColumns: ['shop', 'user', 'membershipRole', 'status'] },
  },
  fields: {
    membershipKey: text({
      isIndexed: 'unique',
      validation: { isRequired: true },
      access: { read: () => false, create: () => false, update: () => false },
      ui: { itemView: { fieldMode: 'hidden' }, createView: { fieldMode: 'hidden' }, listView: { fieldMode: 'hidden' } },
    }),
    shop: relationship({ ref: 'Shop.memberships', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') }, access: { update: () => false } }),
    user: relationship({ ref: 'User.shopMemberships', access: { update: () => false } }),
    membershipRole: select({
      type: 'enum',
      options: [
        { label: 'Owner', value: 'owner' },
        { label: 'Manager', value: 'manager' },
        { label: 'Front Desk', value: 'front_desk' },
        { label: 'Barber', value: 'barber' },
        { label: 'Viewer', value: 'viewer' },
      ],
      defaultValue: 'viewer',
    }),
    status: select({
      type: 'enum',
      options: [
        { label: 'Invited', value: 'invited' },
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Revoked', value: 'revoked' },
      ],
      defaultValue: 'invited',
    }),
    ...trackingFields,
  },
});
