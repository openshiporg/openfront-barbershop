import { createHash } from 'node:crypto';

export type LifecycleEnvelope = {
  eventKey: string;
  eventType: string;
  schemaVersion: 1;
  aggregateType: string;
  aggregateId: string;
  shopId: string;
  occurredAt: string;
  /** Signed-in user who performed the change, when the caller knows it. */
  actorId?: string;
  data: Record<string, unknown>;
};

type LifecycleTransaction = {
  $executeRawUnsafe(query: string, namespace: string, resource: string): Promise<unknown>;
  lifecycleOutboxEvent: {
    findUnique(args: { where: { eventKey: string } }): Promise<{
      id: string;
      eventKey: string;
      eventType: string;
      shopId: string | null;
      payloadHash: string;
    } | null>;
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)])
    );
  }
  return value;
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function buildLifecycleEnvelope(input: Omit<LifecycleEnvelope, 'schemaVersion' | 'occurredAt'> & { occurredAt: Date }) {
  return {
    ...input,
    schemaVersion: 1 as const,
    occurredAt: input.occurredAt.toISOString(),
  };
}

export function lifecyclePayloadHash(envelope: LifecycleEnvelope) {
  return createHash('sha256').update(JSON.stringify(canonicalize(envelope))).digest('hex');
}

export async function enqueueLifecycleEvent(transaction: LifecycleTransaction, envelope: LifecycleEnvelope) {
  const serialized = JSON.stringify(canonicalize(envelope));
  if (Buffer.byteLength(serialized) > 1_000_000) {
    throw new Error('Lifecycle event snapshot exceeds the supported size.');
  }

  await transaction.$executeRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
    'barbershop-outbox',
    envelope.eventKey
  );
  const payloadHash = lifecyclePayloadHash(envelope);
  const existing = await transaction.lifecycleOutboxEvent.findUnique({ where: { eventKey: envelope.eventKey } });
  if (existing) {
    if (
      existing.eventType !== envelope.eventType
      || existing.shopId !== envelope.shopId
      || existing.payloadHash !== payloadHash
    ) {
      throw new Error('Lifecycle event idempotency key was reused with a different snapshot.');
    }
    return { id: existing.id, created: false };
  }

  const event = await transaction.lifecycleOutboxEvent.create({
    data: {
      eventKey: envelope.eventKey,
      eventType: envelope.eventType,
      schemaVersion: envelope.schemaVersion,
      aggregateType: envelope.aggregateType,
      aggregateId: envelope.aggregateId,
      shopId: envelope.shopId,
      ...(envelope.actorId ? { actorId: envelope.actorId } : {}),
      payload: envelope,
      payloadHash,
      occurredAt: new Date(envelope.occurredAt),
      status: 'pending',
      attempts: 0,
      maxAttempts: 8,
      availableAt: new Date(envelope.occurredAt),
    },
  });
  return { id: event.id, created: true };
}
