import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { GUEST_BOOKING_PURPOSE, type GuestBookingCommand, validateGuestBookingCommand } from '../../shared/guest-booking-command';
import { hashPublicAccessToken, publicAccessTokenMatches } from './publicAccessToken';
import { runSerializableBookingTransaction } from './bookingCapacity';
import { domainPrisma } from './domainPrisma';

export type GuestCommandResult = {
  success: boolean;
  disposition: 'accepted' | 'closed' | 'unresolved' | 'rejected';
  error: string | null;
  appointment: Record<string, unknown> | null;
  accessToken: string | null;
};
export const unresolvedGuestCommand = (): GuestCommandResult => ({ success: false, disposition: 'unresolved', error: 'We couldn’t confirm whether your booking request went through. Check again before booking another time.', appointment: null, accessToken: null });
type Receipt = { version: 1; disposition: 'accepted' | 'closed'; appointment: Record<string, unknown> | null };
type Row = { shopId: string; appointmentId: string | null; purpose: string; actor: string; payloadHash: string; proofHash: string; receipt: Receipt; expiresAt: Date | null; revokedAt: Date | null };
const hash = (bytes: string) => createHash('sha256').update(bytes, 'utf8').digest('hex');

export async function lockGuestCommand(tx: Prisma.TransactionClient, key: string) {
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-guest-command', key);
}

/** Only command binding is fetched until possession and subject are verified. */
export async function readGuestCommand(tx: Prisma.TransactionClient, command: GuestBookingCommand, actor = 'guest'): Promise<GuestCommandResult | null> {
  const body = validateGuestBookingCommand(command);
  const rows = await tx.$queryRawUnsafe<Row[]>(`SELECT "shop" AS "shopId", "appointment" AS "appointmentId", purpose, actor, "payloadHash", "proofHash", "expiresAt", "revokedAt" FROM "GuestBookingCommand" WHERE "requestKey" = $1 LIMIT 1`, command.requestKey);
  const row = rows[0];
  if (!row) return null;
  if (!publicAccessTokenMatches(command.guestProof, row.proofHash)
    || row.shopId !== body.shopId || row.purpose !== GUEST_BOOKING_PURPOSE || row.actor !== actor
    || row.payloadHash !== hash(command.requestBody) || row.revokedAt
    || (row.expiresAt && (!Number.isFinite(new Date(row.expiresAt).getTime()) || new Date(row.expiresAt).getTime() <= Date.now()))) throw new Error('Unresolved booking.');
  // Check current occurrence revocation and shop lineage using only credential
  // metadata before reading the private original receipt. Closure has no occurrence.
  if (row.appointmentId) {
    const appointment = await tx.appointment.findUnique({ where: { id: row.appointmentId }, select: { id: true, shopId: true, publicAccessTokenHash: true, accountId: true } });
    if (!appointment || appointment.shopId !== row.shopId || (actor !== 'guest' && actor !== `account:${appointment.accountId}`) || !publicAccessTokenMatches(command.guestProof, appointment.publicAccessTokenHash)) throw new Error('Unresolved booking.');
  }
  const receipts = await tx.$queryRawUnsafe<Array<{ receipt: Receipt }>>('SELECT receipt FROM "GuestBookingCommand" WHERE "requestKey" = $1 LIMIT 1', command.requestKey);
  if (!receipts[0]) throw new Error('Unresolved booking.');
  row.receipt = receipts[0].receipt;
  if (row.receipt?.version !== 1) throw new Error('Unresolved booking.');
  if (row.receipt.disposition === 'closed' && !row.appointmentId && !row.receipt.appointment) {
    return { success: false, disposition: 'closed', error: 'That earlier request was not booked.', appointment: null, accessToken: null };
  }
  if (row.receipt.disposition !== 'accepted' || !row.appointmentId || row.receipt.appointment?.id !== row.appointmentId) throw new Error('Unresolved booking.');
  const service = row.receipt.appointment.service as { id?: unknown } | null;
  const barber = row.receipt.appointment.barber as { id?: unknown } | null;
  if (service?.id !== body.serviceId || !barber?.id || (body.barberId && barber.id !== body.barberId)) throw new Error('Unresolved booking.');
  // No current catalog/date/policy check: ACK of immutable accepted evidence.
  return { success: true, disposition: 'accepted', error: null, appointment: row.receipt.appointment, accessToken: command.guestProof };
}

export async function persistGuestCommand(tx: Prisma.TransactionClient, command: GuestBookingCommand, receipt: Receipt, actor = 'guest') {
  const body = validateGuestBookingCommand(command);
  await tx.$executeRawUnsafe(`INSERT INTO "GuestBookingCommand" (id, "requestKey", purpose, actor, "payloadHash", "proofHash", "shop", "appointment", receipt, "createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`, randomUUID(), command.requestKey, body.purpose, actor, hash(command.requestBody), hashPublicAccessToken(command.guestProof), body.shopId, receipt.appointment?.id || null, JSON.stringify(receipt), new Date());
}

/** Unique-key conflicts restart the entire native Serializable unit with fresh snapshot. */
export async function runGuestCommand<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await runSerializableBookingTransaction(domainPrisma as unknown as Parameters<typeof runSerializableBookingTransaction>[0], (tx) => operation(tx as Prisma.TransactionClient));
    } catch (error) {
      const conflict = error as { code?: string; meta?: { target?: unknown } };
      // Raw INSERT constraint collision is P2010/23505; only this named constraint.
      const raw = error as { code?: string; meta?: { code?: string; message?: string } };
      const commandCollision = (conflict.code === 'P2002' && String(conflict.meta?.target).includes('requestKey'))
        || (raw.code === 'P2010' && raw.meta?.code === '23505' && raw.meta.message?.includes('GuestBookingCommand_requestKey_key'));
      const knownTransactionAbort = raw.code === 'P2010' && ['40001', '40P01'].includes(raw.meta?.code || '');
      if ((!commandCollision && !knownTransactionAbort) || attempt >= 2) throw error;
    }
  }
}

export async function recoverGuestBooking(_root: unknown, args: GuestBookingCommand & { closeIfAbsent?: boolean }, context: { session?: unknown }) {
  if (context.session) return unresolvedGuestCommand();
  try {
    validateGuestBookingCommand(args);
    return await runGuestCommand(async (tx) => {
      await lockGuestCommand(tx, args.requestKey);
      const original = await readGuestCommand(tx, args);
      if (original) return original;
      if (!args.closeIfAbsent) return unresolvedGuestCommand();
      // Explicit closure serializes against in-flight admission. Absence alone is
      // never called rollback. Closing seals this key against all later retries.
      await persistGuestCommand(tx, args, { version: 1, disposition: 'closed', appointment: null });
      return { success: false, disposition: 'closed' as const, error: 'That earlier request was not booked.', appointment: null, accessToken: null };
    });
  } catch { return unresolvedGuestCommand(); }
}
