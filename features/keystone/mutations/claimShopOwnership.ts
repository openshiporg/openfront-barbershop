import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

import type { Session } from '../access';
import { hasCurrentRolePermission } from '../utils/currentAuthorization';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { runSerializableTransaction } from '../utils/serializableTransaction';

type Context = { session?: Session; prisma: PrismaClient };

/**
 * Instance administrators (people and roles managers) can already grant any
 * access, so they may take over a shop they hold no membership in. Everyone
 * else still needs a shop owner or manager to add them.
 */
async function isInstanceAdmin(context: Context) {
  const session = context.session;
  if (!session?.itemId) return false;
  const [people, roles] = await Promise.all([
    hasCurrentRolePermission(session, 'canManagePeople', context.prisma),
    hasCurrentRolePermission(session, 'canManageRoles', context.prisma),
  ]);
  return people && roles;
}

export async function claimableShops(_root: unknown, _args: unknown, context: Context) {
  if (!(await isInstanceAdmin(context))) return [];
  const userId = context.session!.itemId;
  return context.prisma.shop.findMany({
    where: { status: 'active', memberships: { none: { userId, status: 'active' } } },
    orderBy: [{ isPublic: 'desc' }, { createdAt: 'asc' }],
    take: 25,
    select: { id: true, name: true, slug: true, isPublic: true },
  });
}

export default async function claimShopOwnership(_root: unknown, args: { shopId: string }, context: Context) {
  const userId = context.session?.itemId;
  const shopId = args.shopId?.trim();
  if (!userId || !shopId) return { success: false, error: 'A signed-in user and shop are required.', shop: null };
  if (!(await isInstanceAdmin(context))) return { success: false, error: 'Only an administrator who manages people and roles can take over a shop.', shop: null };

  try {
    const shop = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client as Prisma.TransactionClient;
      const target = await transaction.shop.findFirst({ where: { id: shopId, status: 'active' }, select: { id: true, name: true, slug: true } });
      if (!target) throw new Error('That shop is not active.');
      const membershipKey = `${shopId}:${userId}`;
      const membership = await transaction.shopMembership.upsert({
        where: { membershipKey },
        create: { membershipKey, shopId, userId, membershipRole: 'owner', status: 'active' },
        update: { membershipRole: 'owner', status: 'active' },
        select: { id: true },
      });
      // Joining a shop that already runs needs no setup, so the welcome card closes.
      const [services, barbers] = await Promise.all([
        transaction.service.count({ where: { shopId } }),
        transaction.barber.count({ where: { shopId } }),
      ]);
      await transaction.user.update({ where: { id: userId }, data: { activeShopId: shopId, ...(services && barbers ? { onboardingStatus: 'completed' } : {}) } });
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: userId,
        eventKey: `shop:${shopId}:owner-claimed:${userId}:${randomUUID()}:v1`,
        eventType: 'shop.owner_claimed',
        aggregateType: 'shop',
        aggregateId: shopId,
        shopId,
        occurredAt: new Date(),
        data: { claim: { userId, shopId, membershipId: membership.id } },
      }));
      return target;
    });
    return { success: true, error: null, shop };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to take over this shop.', shop: null };
  }
}
