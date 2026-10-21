import type { PrismaClient } from '@prisma/client';

import type { Session } from '../access';
import { currentActiveShopIds, hasCurrentRolePermission } from './currentAuthorization';

type PeopleAccessArgs = {
  session?: Session;
  context: { prisma: PrismaClient };
};

function selfOnly(session: Session) {
  return { id: { equals: session.itemId } };
}

function activeShopPeople(session: Session, shopIds: string[]) {
  return {
    OR: [
      selfOnly(session),
      {
        shopMemberships: {
          some: {
            status: { equals: 'active' as const },
            shop: { id: { in: shopIds }, status: { equals: 'active' as const } },
          },
        },
      },
    ],
  };
}

export async function canReadPeople({ session, context }: PeopleAccessArgs) {
  if (!session?.itemId) return false;
  if (await hasCurrentRolePermission(session, 'canManageRoles', context.prisma)) return true;
  if (!(await hasCurrentRolePermission(session, 'canSeeOtherPeople', context.prisma))) return selfOnly(session);
  const shopIds = await currentActiveShopIds(session, context.prisma);
  return shopIds.length ? activeShopPeople(session, shopIds) : selfOnly(session);
}

export async function canUpdatePeople({ session, context }: PeopleAccessArgs) {
  if (!session?.itemId) return false;
  if (await hasCurrentRolePermission(session, 'canManageRoles', context.prisma)) return true;
  // User is a global identity, not a tenant-owned row. Shop staff may edit
  // membership rows in their active shop, but not another user's global account.
  return selfOnly(session);
}
