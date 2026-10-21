import type { Prisma } from '@prisma/client';

import { activeShopIds, managedShopIds, membershipRoleAllows, membershipShopIds, requireSingleActiveShop, type Session } from '../access';

export { MEMBERSHIP_ROLE_CAPABILITIES, membershipRoleAllows } from '../access';
import { domainPrisma } from './domainPrisma';

const PERMISSION_FIELDS = [
  'canAccessDashboard', 'canManageOnboarding', 'canManageServices', 'canManageStaff',
  'canManageSchedules', 'canManageAppointments', 'canManageQueue', 'canManageCustomers',
  'canManageCustomerNotes', 'canManageMemberships', 'canManagePayments', 'canViewReports',
  'canManagePeople', 'canManageRoles', 'canSeeOtherPeople', 'canEditOtherPeople',
] as const;

type PermissionField = typeof PERMISSION_FIELDS[number];
const ROLE_PERMISSION_SELECT = Object.fromEntries(PERMISSION_FIELDS.map((field) => [field, true])) as Record<PermissionField, true>;
type DatabaseClient = Prisma.TransactionClient | typeof domainPrisma;

type LockingClient = { $queryRawUnsafe?<T = unknown>(query: string, ...values: unknown[]): Promise<T> };

/**
 * Re-checks durable membership and role state instead of trusting a potentially
 * stale stateless-session snapshot. Inside a command transaction the user,
 * role and membership rows are share-locked, so a concurrent revoke/role change
 * either waits for the command to commit or makes the command retry and fail.
 * When `permission` is given, the tenant membership role must also allow it.
 */
export async function assertCurrentShopAccess(session: Session | undefined, shopId: string, client: DatabaseClient = domainPrisma, permission?: PermissionField) {
  if (!session?.itemId) throw new Error('A signed-in dashboard user is required.');
  const locking = client as unknown as LockingClient;
  if (typeof locking.$queryRawUnsafe === 'function') {
    await locking.$queryRawUnsafe(
      `SELECT 1 FROM "User" u JOIN "Role" r ON r.id = u."role" JOIN "ShopMembership" m ON m."user" = u.id
       WHERE u.id = $1 AND m."shop" = $2 FOR SHARE OF u, r, m`,
      session.itemId, shopId,
    );
  }
  const current = await client.user.findUnique({
    where: { id: session.itemId },
    select: {
      role: { select: ROLE_PERMISSION_SELECT },
      shopMemberships: { where: { shopId, status: 'active', shop: { status: 'active' } }, take: 1, select: { id: true, membershipRole: true } },
    },
  });
  if (!current?.shopMemberships.length || !current.role) throw new Error('This shop session has been revoked. Sign in again.');
  const staleRole = session.data.role;
  for (const field of PERMISSION_FIELDS) {
    if (staleRole?.[field] && !(current.role as Record<string, boolean>)[field]) {
      throw new Error('Your role permissions changed. Sign in again.');
    }
  }
  if (permission) {
    if (!(current.role as Record<string, boolean>)[permission]) throw new Error('Your role no longer authorizes this operation. Sign in again.');
    if (!membershipRoleAllows(current.shopMemberships[0].membershipRole, permission)) throw new Error('Your role in this shop does not allow this operation.');
  }
}

export async function assertCurrentRolePermission(session: Session | undefined, permission: PermissionField, client: DatabaseClient = domainPrisma) {
  if (!session?.itemId) throw new Error('A signed-in dashboard user is required.');
  const user = await client.user.findUnique({ where: { id: session.itemId }, select: { role: { select: ROLE_PERMISSION_SELECT } } });
  if (!(user?.role as unknown as Record<string, boolean> | null)?.[permission]) throw new Error('Your role no longer authorizes this operation. Sign in again.');
}

export async function hasCurrentRolePermission(session: Session | undefined, permission: PermissionField, client: DatabaseClient = domainPrisma) {
  try {
    await assertCurrentRolePermission(session, permission, client);
    return true;
  } catch {
    return false;
  }
}

export async function currentMembershipShopIds(session: Session | undefined, client: DatabaseClient = domainPrisma) {
  if (!session?.itemId) return [];
  const sessionShopIds = membershipShopIds(session);
  if (!sessionShopIds.length) return [];
  const memberships = await client.shopMembership.findMany({
    where: { userId: session.itemId, shopId: { in: sessionShopIds }, status: 'active', shop: { status: 'active' } },
    select: { shopId: true },
  });
  return Array.from(new Set(memberships.map(({ shopId }) => shopId))).sort();
}

export async function currentManagedShopIds(session: Session | undefined, client: DatabaseClient = domainPrisma) {
  if (!session?.itemId) return [];
  const sessionShopIds = managedShopIds(session);
  if (!sessionShopIds.length) return [];
  const memberships = await client.shopMembership.findMany({
    where: {
      userId: session.itemId,
      shopId: { in: sessionShopIds },
      status: 'active',
      membershipRole: { in: ['owner', 'manager'] },
      shop: { status: 'active' },
    },
    select: { shopId: true },
  });
  return Array.from(new Set(memberships.map(({ shopId }) => shopId))).sort();
}

export async function currentActiveShopIds(session: Session | undefined, client: DatabaseClient = domainPrisma) {
  if (!session?.itemId) return [];
  const selectedShopIds = activeShopIds(session);
  if (!selectedShopIds.length) return [];
  const memberships = await client.shopMembership.findMany({
    where: { userId: session.itemId, shopId: { in: selectedShopIds }, status: 'active', shop: { status: 'active' } },
    select: { shopId: true },
  });
  return Array.from(new Set(memberships.map(({ shopId }) => shopId))).sort();
}

export async function hasCurrentOwnerMembership(session: Session | undefined, shopId: string, client: DatabaseClient = domainPrisma) {
  if (!session?.itemId || !activeShopIds(session).includes(shopId)) return false;
  const membership = await client.shopMembership.findFirst({
    where: { userId: session.itemId, shopId, status: 'active', membershipRole: 'owner', shop: { status: 'active' } },
    select: { id: true },
  });
  return Boolean(membership);
}

export async function currentManagedActiveShopIds(session: Session | undefined, client: DatabaseClient = domainPrisma) {
  const activeIds = await currentActiveShopIds(session, client);
  if (!session?.itemId || !activeIds.length) return [];
  const memberships = await client.shopMembership.findMany({
    where: {
      userId: session.itemId,
      shopId: { in: activeIds },
      status: 'active',
      membershipRole: { in: ['owner', 'manager'] },
      shop: { status: 'active' },
    },
    select: { shopId: true },
  });
  return Array.from(new Set(memberships.map(({ shopId }) => shopId))).sort();
}

export async function requireCurrentShopPermission(session: Session | undefined, permission: PermissionField, client: DatabaseClient = domainPrisma) {
  const shopId = requireSingleActiveShop(session);
  await assertCurrentShopAccess(session, shopId, client, permission);
  return shopId;
}

export async function currentShopForPermission(session: Session | undefined, permission: PermissionField, client: DatabaseClient = domainPrisma) {
  if (!session?.itemId || !session.data.role?.[permission]) return null;
  try {
    return await requireCurrentShopPermission(session, permission, client);
  } catch {
    return null;
  }
}
