import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';

import { permissions, type Session } from '../access';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { runSerializableTransaction } from '../utils/serializableTransaction';

const ACTIONS = new Set(['create', 'notify', 'expire']);
type Context = { session?: Session; prisma: PrismaClient };
type Args = { action: string; waitlistEntryId?: string | null; customerName?: string | null; phone?: string | null; customerId?: string | null; requestedServiceId?: string | null; requestedBarberId?: string | null; preferredAt?: string | null; notes?: string | null; idempotencyKey: string };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export default async function manageWaitlist(_root: unknown, args: Args, context: Context) {
  if (!permissions.canManageQueue({ session: context.session })) return { success: false, error: 'Not authorized to manage the waitlist.', entry: null };
  const action = args.action?.trim(); const key = args.idempotencyKey?.trim();
  if (!ACTIONS.has(action) || !key || key.length > 200) return { success: false, error: 'A valid waitlist action and idempotency key are required.', entry: null };
  try {
    const shopId = await requireCurrentShopPermission(context.session, 'canManageQueue');
    const entry = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client as Prisma.TransactionClient; const commandHash = hash(key); const eventKey = `waitlist-command:${commandHash}:v1`;
      await requireCurrentShopPermission(context.session, 'canManageQueue', transaction);
      // The outbox carries IDs only; contact details stay in the waitlist row.
      // The full request is bound by a fingerprint so a reused key cannot differ.
      const inputHash = hash(JSON.stringify([action, args.waitlistEntryId || null, args.customerName?.trim() || null, args.phone?.trim() || null, args.customerId || null, args.requestedServiceId || null, args.requestedBarberId || null, args.preferredAt || null, args.notes?.trim() || null, context.session?.itemId || null]));
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-waitlist', args.waitlistEntryId || `${shopId}:${args.phone || commandHash}`);
      const replay = await transaction.lifecycleOutboxEvent.findUnique({ where: { eventKey } });
      if (replay) {
        if (replay.shopId !== shopId) throw new Error('Waitlist idempotency key belongs to another shop.');
        const payload = replay.payload as { data?: { waitlist?: Record<string, unknown> } } | null; const saved = payload?.data?.waitlist;
        if (!saved?.id || saved.action !== action || saved.inputHash !== inputHash) throw new Error('Waitlist idempotency key was reused with different input.');
        return transaction.waitlistEntry.findFirstOrThrow({ where: { id: String(saved.id), shopId } });
      }
      if (action === 'create') {
        const customerName = args.customerName?.trim() || ''; const phone = args.phone?.trim() || ''; const preferredAt = args.preferredAt ? new Date(args.preferredAt) : null;
        if (customerName.length < 2 || phone.replace(/\D/g, '').length < 7 || (preferredAt && Number.isNaN(preferredAt.getTime()))) throw new Error('Customer name, phone, and a valid preferred time are required.');
        const [customer, service, barber] = await Promise.all([args.customerId ? transaction.customer.findFirst({ where: { id: args.customerId, shopId } }) : null, args.requestedServiceId ? transaction.service.findFirst({ where: { id: args.requestedServiceId, shopId }, include: { specialists: { select: { id: true } } } }) : null, args.requestedBarberId ? transaction.barber.findFirst({ where: { id: args.requestedBarberId, shopId } }) : null]);
        if ((args.customerId && !customer) || (args.requestedServiceId && !service) || (args.requestedBarberId && !barber) || (customer && customer.shopId !== shopId) || (service && (service.shopId !== shopId || service.status !== 'active')) || (barber && (barber.shopId !== shopId || barber.status !== 'active'))) throw new Error('Waitlist relationships must belong to the active shop.');
        if (service?.specialists.length && barber && !service.specialists.some((item) => item.id === barber.id)) throw new Error('Requested barber does not provide this service.');
        const duplicate = await transaction.waitlistEntry.findFirst({ where: { shopId, phone, status: { in: ['waiting', 'notified'] }, requestedServiceId: service?.id || null } });
        if (duplicate) throw new Error('This customer already has an active waitlist request for that service.');
        const created = await transaction.waitlistEntry.create({ data: { shopId, customerName, phone, customerId: customer?.id || null, requestedServiceId: service?.id || null, requestedBarberId: barber?.id || null, status: 'waiting', preferredAt, notes: args.notes?.trim() || '', metadata: { source: 'operator' } } });
        await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId, eventKey, eventType: 'waitlist.created', aggregateType: 'waitlist_entry', aggregateId: created.id, shopId, occurredAt: created.createdAt, data: { waitlist: { id: created.id, action, inputHash, customerId: customer?.id || null, requestedServiceId: service?.id || null, requestedBarberId: barber?.id || null, preferredAt: args.preferredAt || null, actorId: context.session?.itemId ?? null } } }));
        return created;
      }
      if (!args.waitlistEntryId) throw new Error('Waitlist entry is required.');
      const current = await transaction.waitlistEntry.findFirst({ where: { id: args.waitlistEntryId, shopId } });
      if (!current) throw new Error('Waitlist entry was not found in the active shop.');
      if (action === 'notify' ? current.status !== 'waiting' : !['waiting', 'notified'].includes(String(current.status))) throw new Error(`Waitlist entry in ${current.status} state cannot ${action}.`);
      const updated = await transaction.waitlistEntry.update({ where: { id: current.id }, data: action === 'notify' ? { status: 'notified', notifiedAt: new Date() } : { status: 'expired' } });
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId, eventKey, eventType: `waitlist.${updated.status}`, aggregateType: 'waitlist_entry', aggregateId: updated.id, shopId, occurredAt: updated.updatedAt, data: { waitlist: { id: updated.id, action, inputHash, fromStatus: current.status, toStatus: updated.status, actorId: context.session?.itemId ?? null } } }));
      return updated;
    });
    return { success: true, error: null, entry: { id: entry.id, status: entry.status, customerName: entry.customerName, preferredAt: entry.preferredAt?.toISOString() || null, notifiedAt: entry.notifiedAt?.toISOString() || null } };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to manage waitlist.', entry: null }; }
}
