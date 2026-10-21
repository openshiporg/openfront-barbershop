import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { runSerializableTransaction } from '../utils/serializableTransaction';

type Args = { shopId: string };
type Context = { session?: { itemId?: string }; prisma: PrismaClient };

export default async function selectActiveShop(_root: unknown, args: Args, context: Context) {
  const userId = context.session?.itemId;
  const shopId = args.shopId?.trim();
  if (!userId || !shopId) return { success: false, error: 'A signed-in user and shop are required.', shop: null };

  try {
    const shop = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client as Prisma.TransactionClient;
      const membership = await transaction.shopMembership.findFirst({
        where: { userId, shopId, status: 'active', shop: { status: 'active' } },
        include: { shop: true },
      });
      if (!membership) throw new Error('Not authorized to select this shop.');
      const user = await transaction.user.findUnique({ where: { id: userId }, select: { activeShopId: true } });
      if (user?.activeShopId === shopId) return membership.shop;

      const selectedAt = new Date();
      await transaction.user.update({ where: { id: userId }, data: { activeShopId: shopId } });
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId,
        eventKey: `user:${userId}:active-shop:${shopId}:${randomUUID()}:v1`,
        eventType: 'user.active_shop_selected',
        aggregateType: 'user',
        aggregateId: userId,
        shopId,
        occurredAt: selectedAt,
        data: { selection: { userId, shopId, membershipId: membership.id } },
      }));
      return membership.shop;
    });
    return { success: true, error: null, shop: { id: shop.id, name: shop.name, slug: shop.slug } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to select active shop.',
      shop: null,
    };
  }
}
