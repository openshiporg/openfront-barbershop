import type { Prisma, PrismaClient } from '@prisma/client';

import { permissions } from '../access';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { assertQueueTransition } from '../utils/lifecycleState';
import { hashPublicAccessToken } from '../utils/publicAccessToken';
import { runSerializableTransaction } from '../utils/serializableTransaction';

type Args = { queueEntryId: string; toStatus: string; idempotencyKey: string };
type Context = { session?: Parameters<typeof permissions.canManageQueue>[0]['session']; prisma: PrismaClient };
const STATUSES = new Set(['waiting', 'texted', 'in_chair', 'served', 'left']);

export default async function transitionQueueEntry(_root: unknown, args: Args, context: Context) {
  if (!permissions.canManageQueue({ session: context.session })) {
    return { success: false, error: 'Not authorized to transition queue entries.', queueEntry: null };
  }
  const queueEntryId = args.queueEntryId?.trim();
  const toStatus = args.toStatus?.trim();
  const idempotencyKey = args.idempotencyKey?.trim();
  if (!queueEntryId || !STATUSES.has(toStatus) || !idempotencyKey || idempotencyKey.length > 200) {
    return { success: false, error: 'Queue entry, target status, and idempotency key are required.', queueEntry: null };
  }

  try {
    const queueEntry = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client as Prisma.TransactionClient;
      const shopId = await requireCurrentShopPermission(context.session, 'canManageQueue', transaction);
      await transaction.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
        'barbershop-queue-transition',
        queueEntryId
      );
      const current = await transaction.walkInQueueEntry.findFirst({ where: { id: queueEntryId, shopId } });
      if (!current || !current.shopId) throw new Error('Queue entry not found.');

      const commandHash = hashPublicAccessToken(idempotencyKey);
      const eventKey = `queue-command:${commandHash}:v1`;
      const replay = await transaction.lifecycleOutboxEvent.findUnique({ where: { eventKey } });
      if (replay) {
        const payload = replay.payload as { aggregateId?: string; data?: { transition?: { toStatus?: string } } } | null;
        if (payload?.aggregateId !== queueEntryId || payload.data?.transition?.toStatus !== toStatus) {
          throw new Error('Queue idempotency key was reused for a different command.');
        }
        return current;
      }
      if (current.status === toStatus) return current;

      if (current.status === 'in_chair' && ['served', 'left'].includes(toStatus)) {
        throw new Error('This guest has an active appointment. Complete it through POS; queue completion follows settlement.');
      }
      assertQueueTransition(String(current.status), toStatus);
      const updated = await transaction.walkInQueueEntry.update({
        where: { id: current.id },
        data: { status: toStatus as Prisma.WalkInQueueEntryUpdateInput['status'] },
      });
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId,
        eventKey,
        eventType: `queue.${toStatus}`,
        aggregateType: 'walk_in_queue_entry',
        aggregateId: current.id,
        shopId: current.shopId,
        occurredAt: updated.updatedAt,
        data: { transition: { fromStatus: current.status, toStatus, actorId: context.session?.itemId ?? null }, queueEntry: { id: current.id } },
      }));
      return updated;
    });

    return {
      success: true,
      error: null,
      queueEntry: {
        id: queueEntry.id,
        status: queueEntry.status,
        updatedAt: queueEntry.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to transition queue entry.', queueEntry: null };
  }
}
