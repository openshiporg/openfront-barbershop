import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

import { permissions, type Session } from '../access';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';
import { buildLifecycleEnvelope, canonicalJson, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { runSerializableTransaction } from '../utils/serializableTransaction';

// Private front-desk queue intake and assignment. Authorized by the operator's
// current shop membership/role (canManageQueue), independent of whether the
// public storefront queue is published.

type Context = { session?: Session; prisma: PrismaClient };
type Result = { success: boolean; error: string | null; data: Record<string, unknown> | null };

function digest(value: string) { return createHash('sha256').update(value).digest('hex'); }
function fail(error: string): Result { return { success: false, error, data: null }; }
function clean(value?: string | null) { return value?.trim() || ''; }
function safeError(error: unknown, fallback: string) {
  return error instanceof Error && !error.message.includes('Invalid `') ? error.message : fallback;
}

async function assertQueueChoices(transaction: Prisma.TransactionClient, shopId: string, serviceId: string, barberId: string) {
  const [service, barber] = await Promise.all([
    serviceId ? transaction.service.findUnique({ where: { id: serviceId }, select: { id: true, status: true, shopId: true, specialists: { select: { id: true } } } }) : null,
    barberId ? transaction.barber.findUnique({ where: { id: barberId }, select: { id: true, status: true, bookingEnabled: true, shopId: true } }) : null,
  ]);
  if (serviceId && (!service || service.shopId !== shopId || service.status !== 'active')) throw new Error('Selected service is not active in this shop.');
  if (barberId && (!barber || barber.shopId !== shopId || barber.status !== 'active' || !barber.bookingEnabled)) throw new Error('Selected barber is not bookable in this shop.');
  if (service?.specialists.length && barberId && !service.specialists.some((item) => item.id === barberId)) throw new Error('Selected barber does not provide this service.');
}

async function readReplay(transaction: Prisma.TransactionClient, eventKey: string, shopId: string, request: string) {
  const replay = await transaction.lifecycleOutboxEvent.findUnique({ where: { eventKey } });
  if (!replay) return null;
  const saved = (replay.payload as { data?: { command?: { request?: string; queueEntryId?: string } } } | null)?.data?.command;
  if (replay.shopId !== shopId || !saved?.queueEntryId || saved.request !== request) throw new Error('This request key was already used for a different queue command.');
  return saved.queueEntryId;
}

type CreateArgs = { customerName: string; phone?: string | null; partySize?: number | null; requestedServiceId?: string | null; requestedBarberId?: string | null; notes?: string | null; quotedWaitMinutes?: number | null; idempotencyKey: string };

export async function createStaffQueueEntry(_root: unknown, args: CreateArgs, context: Context): Promise<Result> {
  if (!permissions.canManageQueue({ session: context.session })) return fail('Not authorized to add walk-ins.');
  const customerName = clean(args.customerName);
  const phone = clean(args.phone);
  const serviceId = clean(args.requestedServiceId);
  const barberId = clean(args.requestedBarberId);
  const notes = clean(args.notes).slice(0, 1000);
  const key = clean(args.idempotencyKey);
  const partySize = Number(args.partySize ?? 1);
  // No quote given means no estimate (null), never an invented default.
  const quotedWaitMinutes = args.quotedWaitMinutes == null ? null : Number(args.quotedWaitMinutes);
  if (customerName.length < 2 || customerName.length > 120) return fail('Enter the guest’s name.');
  if (phone && (phone.replace(/\D/g, '').length < 7 || phone.length > 40)) return fail('Enter a valid phone number or leave it blank.');
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 8) return fail('Party size must be a whole number from 1 to 8.');
  if (quotedWaitMinutes !== null && (!Number.isInteger(quotedWaitMinutes) || quotedWaitMinutes < 0 || quotedWaitMinutes > 480)) return fail('Quoted wait must be a whole number of minutes from 0 to 480.');
  if (key.length < 8 || key.length > 200) return fail('A valid request key is required.');

  let shopId: string;
  try { shopId = await requireCurrentShopPermission(context.session, 'canManageQueue', context.prisma); }
  catch (error) { return fail(safeError(error, 'Not authorized to manage this shop’s queue.')); }
  const request = canonicalJson({ customerName, phone, partySize, serviceId: serviceId || null, barberId: barberId || null, notes, quotedWaitMinutes });
  const eventKey = `staff-queue-create:${digest(`${shopId}:${key}`)}:v1`;
  try {
    const data = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client as Prisma.TransactionClient;
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-staff-queue', eventKey);
      await requireCurrentShopPermission(context.session, 'canManageQueue', transaction);
      const replayedId = await readReplay(transaction, eventKey, shopId, request);
      if (replayedId) return { queueEntryId: replayedId, replayed: true };
      await assertQueueChoices(transaction, shopId, serviceId, barberId);
      if (phone) {
        await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-public-queue', `${shopId}:${phone.replace(/\D/g, '')}`);
        const existing = await transaction.walkInQueueEntry.findFirst({ where: { shopId, phone, status: { in: ['waiting', 'texted', 'in_chair'] } }, select: { id: true } });
        if (existing) throw new Error('This phone number already has an active queue entry.');
      }
      const created = await transaction.walkInQueueEntry.create({
        data: { shopId, customerName, phone, partySize, status: 'waiting', quotedWaitMinutes, notes, requestedServiceId: serviceId || null, requestedBarberId: barberId || null },
        select: { id: true, status: true, createdAt: true },
      });
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({
        eventKey, eventType: 'queue.checked_in', aggregateType: 'walk_in_queue_entry', aggregateId: created.id, shopId, occurredAt: created.createdAt,
        data: { command: { request, queueEntryId: created.id }, queueEntry: { id: created.id, status: created.status, requestedServiceId: serviceId || null, requestedBarberId: barberId || null, partySize, source: 'operator' } },
      }));
      return { queueEntryId: created.id, status: created.status, replayed: false };
    });
    return { success: true, error: null, data };
  } catch (error) {
    return fail(safeError(error, 'Unable to add this walk-in. Refresh the queue before retrying.'));
  }
}

type AssignArgs = { queueEntryId: string; requestedServiceId: string; requestedBarberId?: string | null; idempotencyKey: string };

export async function assignWalkInQueueEntry(_root: unknown, args: AssignArgs, context: Context): Promise<Result> {
  if (!permissions.canManageQueue({ session: context.session })) return fail('Not authorized to update walk-ins.');
  const queueEntryId = clean(args.queueEntryId);
  const serviceId = clean(args.requestedServiceId);
  const barberId = clean(args.requestedBarberId);
  const key = clean(args.idempotencyKey);
  if (!queueEntryId || !serviceId) return fail('Choose a service for this guest.');
  if (key.length < 8 || key.length > 200) return fail('A valid request key is required.');
  let shopId: string;
  try { shopId = await requireCurrentShopPermission(context.session, 'canManageQueue', context.prisma); }
  catch (error) { return fail(safeError(error, 'Not authorized to manage this shop’s queue.')); }
  const request = canonicalJson({ queueEntryId, serviceId, barberId: barberId || null });
  const eventKey = `staff-queue-assign:${digest(`${shopId}:${key}`)}:v1`;
  try {
    const data = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client as Prisma.TransactionClient;
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-walk-in', `queue:${queueEntryId}`);
      await requireCurrentShopPermission(context.session, 'canManageQueue', transaction);
      const replayedId = await readReplay(transaction, eventKey, shopId, request);
      if (replayedId) return { queueEntryId: replayedId, requestedServiceId: serviceId, requestedBarberId: barberId || null, replayed: true };
      const entry = await transaction.walkInQueueEntry.findFirst({ where: { id: queueEntryId, shopId }, select: { id: true, status: true, appointment: { select: { id: true } } } });
      if (!entry) throw new Error('Queue entry was not found in the active shop.');
      if (!['waiting', 'texted'].includes(String(entry.status)) || entry.appointment) throw new Error('Only waiting guests can be reassigned.');
      await assertQueueChoices(transaction, shopId, serviceId, barberId);
      const updated = await transaction.walkInQueueEntry.update({ where: { id: entry.id }, data: { requestedServiceId: serviceId, requestedBarberId: barberId || null }, select: { id: true, updatedAt: true } });
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({
        eventKey, eventType: 'queue.assigned', aggregateType: 'walk_in_queue_entry', aggregateId: updated.id, shopId, occurredAt: updated.updatedAt,
        data: { command: { request, queueEntryId: updated.id }, queueEntry: { id: updated.id, requestedServiceId: serviceId, requestedBarberId: barberId || null } },
      }));
      return { queueEntryId: updated.id, requestedServiceId: serviceId, requestedBarberId: barberId || null, replayed: false };
    });
    return { success: true, error: null, data };
  } catch (error) {
    return fail(safeError(error, 'Unable to update this walk-in. Refresh the queue before retrying.'));
  }
}
