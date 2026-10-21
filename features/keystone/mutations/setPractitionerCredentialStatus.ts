import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

import { permissions } from '../access';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { runSerializableTransaction } from '../utils/serializableTransaction';

type Args = { credentialId: string; status: string; reason: string; idempotencyKey: string };
type Context = { session?: Parameters<typeof permissions.canManageStaff>[0]['session']; prisma: PrismaClient };
function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }

export default async function setPractitionerCredentialStatus(_root: unknown, args: Args, context: Context) {
  if (!permissions.canManageStaff({ session: context.session })) return { success: false, error: 'Not authorized to manage practitioner authority.', data: null };
  const credentialId = args.credentialId.trim(); const status = args.status.trim(); const reason = args.reason.trim(); const key = args.idempotencyKey.trim();
  if (!credentialId || !['suspended', 'revoked', 'expired'].includes(status) || reason.length < 2 || reason.length > 1000 || key.length < 8 || key.length > 200) return { success: false, error: 'Credential, terminal status, reason, and idempotency key are required.', data: null };
  try {
    const data = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client as Prisma.TransactionClient;
      const shopId = await requireCurrentShopPermission(context.session, 'canManageStaff', transaction);
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-practitioner-credential', credentialId);
      const rows = await transaction.$queryRawUnsafe<Array<{ id: string; shopId: string; status: string; barberId: string; serviceId: string; evidenceHash: string }>>('SELECT id, "shop" AS "shopId", status, "barber" AS "barberId", "service" AS "serviceId", "evidenceHash" FROM "PractitionerCredential" WHERE id = $1 AND "shop" = $2 FOR UPDATE', credentialId, shopId);
      const credential = rows[0]; if (!credential) throw new Error('Practitioner credential not found.');
      const eventKey = `credential:${credentialId}:status:${hash(key)}`;
      const replay = await transaction.lifecycleOutboxEvent.findUnique({ where: { eventKey } });
      if (replay) { const payload = replay.payload as { data?: { status?: string; reason?: string } } | null; if (payload?.data?.status !== status || payload.data.reason !== reason) throw new Error('Idempotency key was reused with different credential status evidence.'); return { credentialId, status, replayed: true }; }
      if (credential.status !== 'active') throw new Error('Only an active credential can transition to a terminal authority status.');
      const occurredAt = new Date();
      await transaction.$executeRawUnsafe('UPDATE "PractitionerCredential" SET status = $2, "updatedAt" = $3 WHERE id = $1 AND status = \'active\'', credentialId, status, occurredAt);
      await enqueueLifecycleEvent(transaction as never, buildLifecycleEnvelope({ actorId: context.session?.itemId, eventKey, eventType: `practitioner_credential.${status}`, aggregateType: 'practitioner_credential', aggregateId: credentialId, shopId: credential.shopId, occurredAt, data: { status, previousStatus: credential.status, reason, barberId: credential.barberId, serviceId: credential.serviceId, evidenceHash: credential.evidenceHash, actorId: context.session?.itemId ?? null } }));
      return { credentialId, status, replayed: false };
    });
    return { success: true, error: null, data };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to update practitioner authority.', data: null }; }
}
