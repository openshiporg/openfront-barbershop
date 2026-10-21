import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';

import { buildLifecycleEnvelope, enqueueLifecycleEvent } from './lifecycleOutbox';
import { runSerializableTransaction } from './serializableTransaction';

type CrudLifecycleArgs = {
  operation: 'create' | 'update' | 'delete';
  item?: Record<string, unknown> | null;
  originalItem?: Record<string, unknown> | null;
  resolvedData?: Record<string, unknown>;
  // Trusted Keystone hook context; its Prisma client is the canonical one.
  context: { prisma: Parameters<typeof runSerializableTransaction>[0]; session?: { itemId?: string } | null };
};

function dateValue(value: unknown) {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export function createCrudLifecycleAfterOperation(aggregateType: string) {
  return async ({ operation, item, originalItem, resolvedData, context }: CrudLifecycleArgs) => {
    const record = (operation === 'delete' ? originalItem : item) || item || originalItem;
    const id = typeof record?.id === 'string' ? record.id : '';
    const shopId = typeof record?.shopId === 'string' ? record.shopId : '';
    if (!id || !shopId) throw new Error(`${aggregateType} lifecycle hook requires shop ownership.`);

    const occurredAt = dateValue(record?.updatedAt || record?.createdAt);
    const changedFields = Object.keys(resolvedData || {})
      .filter((field) => !['credentials', 'metadata', 'password'].includes(field))
      .sort();
    // Keystone commits the row before afterOperation runs, so this record is written
    // separately. Its key is derived from the committed row version (updatedAt) and
    // the changed fields, so re-running the hook for the same write never creates a
    // second event.
    const version = `${occurredAt.getTime()}:${createHash('sha256').update(changedFields.join(',')).digest('hex').slice(0, 16)}`;
    try {
      await runSerializableTransaction(context.prisma, async (client) => {
        const transaction = client as Prisma.TransactionClient;
        await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({
          actorId: context.session?.itemId || undefined,
          eventKey: `crud:${aggregateType}:${id}:${operation}:${version}:v2`,
          eventType: `${aggregateType}.${operation}d`,
          aggregateType,
          aggregateId: id,
          shopId,
          occurredAt,
          data: {
            lifecycle: { operation, changedFields },
            record: { id, shopId },
          },
        }));
      });
    } catch {
      throw new Error(`The ${aggregateType} change was saved, but its activity record could not be written. Refresh before retrying.`);
    }
  };
}
