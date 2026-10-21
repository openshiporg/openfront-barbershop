import { createHash, randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

import { runSerializableBookingTransaction } from '../utils/bookingCapacity';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { assertAppointmentAccess, assertWaiverSigner, getAppointmentWaiverRequirement } from '../utils/waiverEvidence';

type Args = { appointmentId: string; accessToken?: string | null; signerName: string; signerRole: string; guardianName?: string | null; affirmation: boolean; idempotencyKey: string };
type Result = { success: boolean; error: string | null; data: unknown | null };
// Trusted Keystone resolver context; never taken from GraphQL arguments.
type Context = { prisma: PrismaClient; session?: { itemId?: string } | null };
function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
function fail(error: string): Result { return { success: false, error, data: null }; }

export default async function signPublicWaiver(_root: unknown, args: Args, context: Context): Promise<Result> {
  const appointmentId = args.appointmentId.trim();
  const idempotencyKey = args.idempotencyKey.trim();
  const accessToken = args.accessToken?.trim() || '';
  const sessionItemId = context.session?.itemId || null;
  if (!appointmentId || (!accessToken && !sessionItemId) || idempotencyKey.length < 8 || idempotencyKey.length > 200) return fail('This appointment link is invalid. Open it again from your confirmation.');
  let signer: ReturnType<typeof assertWaiverSigner>;
  try { signer = assertWaiverSigner(args); } catch (error) { return fail(error instanceof Error ? error.message : 'Invalid signer evidence.'); }
  const signatureKeyHash = hash(`${appointmentId}:${idempotencyKey}`);
  try {
    const data = await runSerializableBookingTransaction(context.prisma, async (rawTransaction) => {
      const transaction = rawTransaction as Prisma.TransactionClient;
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-public-waiver', appointmentId);
      const appointment = await transaction.appointment.findUnique({ where: { id: appointmentId } });
      if (!appointment) throw new Error('Appointment not found.');
      assertAppointmentAccess({ token: accessToken, storedHash: appointment.publicAccessTokenHash, accountId: appointment.accountId, sessionItemId });
      const existing = (await transaction.$queryRawUnsafe<Array<{ id: string; signedByName: string; signerRole: string; guardianName: string | null }>>('SELECT id, "signedByName", "signerRole", "guardianName" FROM "WaiverForm" WHERE "signatureKeyHash" = $1 LIMIT 1', signatureKeyHash))[0];
      if (existing) {
        if (existing.signedByName !== signer.signerName || existing.signerRole !== signer.signerRole || (existing.guardianName || '') !== signer.guardianName) throw new Error('This waiver was already signed with different details. Reload the page.');
        return { waiverId: existing.id, replayed: true };
      }
      if (!['requested', 'confirmed', 'checked_in'].includes(appointment.status || '')) throw new Error('This appointment can no longer accept a waiver.');
      if (!appointment.shopId || !appointment.customerId || !appointment.serviceId) throw new Error('Appointment waiver linkage is incomplete.');
      const requirement = await getAppointmentWaiverRequirement(transaction, appointment.id);
      if (!requirement.required) throw new Error('This service does not require a waiver.');
      const occurredAt = new Date();
      const waiverId = randomUUID();
      const affirmationHash = hash(JSON.stringify({ appointmentId, serviceId: appointment.serviceId, customerId: appointment.customerId, templateKey: requirement.templateKey, templateVersion: requirement.templateVersion, templateHash: requirement.templateHash, signerName: signer.signerName, signerRole: signer.signerRole, guardianName: signer.guardianName, affirmation: true, signedAt: occurredAt.toISOString() }));
      await transaction.$executeRawUnsafe(`INSERT INTO "WaiverForm" (id, title, "waiverType", status, "templateKey", "templateVersion", "templateHash", "signatureKeyHash", "signedByName", "signerRole", "guardianName", affirmation, "affirmationHash", "signedAt", metadata, "shop", "customer", "appointment", "service", "createdAt", "updatedAt") VALUES ($1,$2,'service','signed',$3,$4,$5,$6,$7,$8,$9,true,$10,$11,$12::jsonb,$13,$14,$15,$16,$11,$11)`, waiverId, `${requirement.templateKey} ${requirement.templateVersion}`, requirement.templateKey, requirement.templateVersion, requirement.templateHash, signatureKeyHash, signer.signerName, signer.signerRole, signer.guardianName || null, affirmationHash, occurredAt, JSON.stringify({ source: 'public_appointment', signerControlled: true }), appointment.shopId, appointment.customerId, appointment.id, appointment.serviceId);
      await enqueueLifecycleEvent(transaction as never, buildLifecycleEnvelope({ eventKey: `waiver:${waiverId}:signed:v1`, eventType: 'waiver.signed', aggregateType: 'waiver', aggregateId: waiverId, shopId: appointment.shopId, occurredAt, data: { waiverId, appointmentId, serviceId: appointment.serviceId, customerId: appointment.customerId, templateKey: requirement.templateKey, templateVersion: requirement.templateVersion, templateHash: requirement.templateHash, signerRole: signer.signerRole, guardianAuthorityRecorded: signer.signerRole === 'guardian', signedAt: occurredAt.toISOString(), affirmationHash } }));
      return { waiverId, templateKey: requirement.templateKey, templateVersion: requirement.templateVersion, signedAt: occurredAt.toISOString(), replayed: false };
    });
    return { success: true, error: null, data };
  } catch (error) { return fail(error instanceof Error ? error.message : 'Unable to record waiver evidence.'); }
}
