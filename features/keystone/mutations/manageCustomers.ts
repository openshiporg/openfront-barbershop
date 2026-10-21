import type { Prisma, PrismaClient } from '@prisma/client';

import { permissions } from '../access';
import { hasCurrentOwnerMembership, requireCurrentShopPermission } from '../utils/currentAuthorization';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { hashPublicAccessToken } from '../utils/publicAccessToken';
import { runSerializableTransaction } from '../utils/serializableTransaction';

type Context = { session?: Parameters<typeof permissions.canManageCustomers>[0]['session']; prisma: PrismaClient };

export async function addCustomerNote(_root: unknown, args: { customerId: string; body: string; noteType?: string | null; visibility?: string | null; appointmentId?: string | null; idempotencyKey: string }, context: Context) {
  if (!permissions.canManageCustomerNotes({ session: context.session })) return { success: false, error: 'Not authorized to add customer notes.', note: null };
  const body = args.body?.trim();
  if (!args.customerId || !body || body.length > 4000 || !args.idempotencyKey?.trim()) return { success: false, error: 'Customer, note body, and idempotency key are required.', note: null };
  try {
    const hash = hashPublicAccessToken(args.idempotencyKey.trim());
    const note = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client as Prisma.TransactionClient;
      // Authorize first; owner-only notes additionally require a current owner
      // membership for create, replay and the returned body.
      const shopId = await requireCurrentShopPermission(context.session, 'canManageCustomerNotes', transaction);
      const visibility = args.visibility || 'staff';
      const isOwner = await hasCurrentOwnerMembership(context.session, shopId, transaction);
      if (visibility === 'owner' && !isOwner) throw new Error('Only a shop owner can add owner-only notes.');
      const eventKey = `customer-note:${hash}:v1`;
      const replay = await transaction.lifecycleOutboxEvent.findUnique({ where: { eventKey } });
      if (replay) {
        const payload = replay.payload as { data?: { note?: { id?: string; customerId?: string; createdById?: string } } } | null;
        if (replay.shopId !== shopId || payload?.data?.note?.customerId !== args.customerId || payload.data.note.createdById !== context.session?.itemId) throw new Error('Customer note idempotency key was reused.');
        const existing = await transaction.customerNote.findFirst({ where: { id: String(payload.data.note.id), shopId } });
        if (!existing || (String(existing.visibility) === 'owner' && !isOwner)) throw new Error('Customer note idempotency key was reused.');
        if (
          existing.body !== body
          || String(existing.noteType) !== (args.noteType || 'general')
          || String(existing.visibility) !== visibility
          || (existing.appointmentId || null) !== (args.appointmentId || null)
        ) throw new Error('Customer note idempotency key was reused with different input.');
        return existing;
      }
      const customer = await transaction.customer.findFirst({ where: { id: args.customerId, shopId } });
      if (!customer) throw new Error('Customer not found.');
      const actorId = context.session?.itemId;
      if (!actorId) throw new Error('A signed-in dashboard user is required.');
      if (args.appointmentId) {
        const appointment = await transaction.appointment.findFirst({ where: { id: args.appointmentId, shopId: customer.shopId, customerId: customer.id } });
        if (!appointment) throw new Error('Appointment does not belong to this customer and shop.');
      }
      const created = await transaction.customerNote.create({ data: {
        shopId: customer.shopId, customerId: customer.id, appointmentId: args.appointmentId || null, createdById: actorId,
        noteType: (args.noteType || 'general') as Prisma.CustomerNoteCreateInput['noteType'],
        visibility: visibility as Prisma.CustomerNoteCreateInput['visibility'], body,
      } });
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId,
        eventKey, eventType: 'customer_note.created', aggregateType: 'customer_note', aggregateId: created.id,
        shopId: customer.shopId, occurredAt: created.createdAt,
        data: { note: { id: created.id, customerId: customer.id, appointmentId: args.appointmentId || null, createdById: actorId, noteType: created.noteType, visibility: created.visibility } },
      }));
      return created;
    });
    return { success: true, error: null, note: { id: note.id, noteType: note.noteType, visibility: note.visibility, body: note.body, createdAt: note.createdAt.toISOString() } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to add customer note.', note: null };
  }
}

export async function setCustomerStatus(_root: unknown, args: { customerId: string; status: string; reason?: string | null; idempotencyKey: string }, context: Context) {
  if (!permissions.canManageCustomers({ session: context.session })) return { success: false, error: 'Not authorized to update customers.', customer: null };
  if (!['active', 'vip', 'needs_attention', 'blocked'].includes(args.status) || !args.idempotencyKey?.trim()) return { success: false, error: 'Customer, valid status, and idempotency key are required.', customer: null };
  try {
    const hash = hashPublicAccessToken(args.idempotencyKey.trim());
    const customer = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client as Prisma.TransactionClient;
      const shopId = await requireCurrentShopPermission(context.session, 'canManageCustomers', transaction);
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-customer', args.customerId);
      const current = await transaction.customer.findFirst({ where: { id: args.customerId, shopId } });
      if (!current) throw new Error('Customer not found.');
      const eventKey = `customer-status:${hash}:v1`;
      const replay = await transaction.lifecycleOutboxEvent.findUnique({ where: { eventKey } });
      if (replay) {
        const payload = replay.payload as { aggregateId?: string; data?: { transition?: { toStatus?: string; reason?: string } } } | null;
        if (replay.shopId !== shopId || payload?.aggregateId !== current.id || payload?.data?.transition?.toStatus !== args.status || String(payload.data.transition.reason || '') !== (args.reason?.trim() || '')) {
          throw new Error('Customer status idempotency key was reused with different input.');
        }
        return current;
      }
      const updated = await transaction.customer.update({ where: { id: current.id }, data: { status: args.status as Prisma.CustomerUpdateInput['status'] } });
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId,
        eventKey, eventType: 'customer.status_changed', aggregateType: 'customer', aggregateId: current.id,
        shopId: current.shopId, occurredAt: updated.updatedAt,
        data: { transition: { fromStatus: current.status, toStatus: args.status, reason: args.reason?.trim() || '', actorId: context.session?.itemId ?? null } },
      }));
      return updated;
    });
    return { success: true, error: null, customer: { id: customer.id, status: customer.status } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to update customer.', customer: null };
  }
}

export async function setCustomerConsent(_root: unknown, args: { customerId: string; acceptsMarketing: boolean; preferredContactMethod?: string | null; idempotencyKey: string }, context: Context) {
  if (!permissions.canManageCustomers({ session: context.session })) return { success: false, error: 'Not authorized to update marketing preferences.', customer: null };
  const contact = args.preferredContactMethod || 'sms';
  if (!args.customerId || !['sms', 'email', 'phone'].includes(contact) || !args.idempotencyKey?.trim()) return { success: false, error: 'Customer, consent choice, contact method, and idempotency key are required.', customer: null };
  try {
    const commandHash = hashPublicAccessToken(args.idempotencyKey.trim());
    const customer = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client as Prisma.TransactionClient; const eventKey = `customer-consent:${commandHash}:v1`;
      const shopId = await requireCurrentShopPermission(context.session, 'canManageCustomers', transaction);
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-customer', args.customerId);
      const current = await transaction.customer.findFirst({ where: { id: args.customerId, shopId } });
      if (!current) throw new Error('Customer not found.');
      const replay = await transaction.lifecycleOutboxEvent.findUnique({ where: { eventKey } });
      if (replay) {
        const payload = replay.payload as { data?: { preference?: { customerId?: string; acceptsMarketing?: boolean; preferredContactMethod?: string } } } | null;
        if (replay.shopId !== shopId || payload?.data?.preference?.customerId !== current.id || payload.data.preference.acceptsMarketing !== args.acceptsMarketing || payload.data.preference.preferredContactMethod !== contact) throw new Error('Customer-consent idempotency key was reused with different input.');
        return current;
      }
      const updated = await transaction.customer.update({ where: { id: current.id }, data: { acceptsMarketing: args.acceptsMarketing, preferredContactMethod: contact as Prisma.CustomerUpdateInput['preferredContactMethod'] } });
      // This is a staff-entered preference, not the customer's own recorded
      // assent: the event carries who recorded it and how, never "consent".
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId, eventKey, eventType: 'customer.marketing_preference_recorded', aggregateType: 'customer', aggregateId: current.id, shopId: current.shopId, occurredAt: updated.updatedAt, data: { preference: { customerId: current.id, acceptsMarketing: args.acceptsMarketing, preferredContactMethod: contact, previousAcceptsMarketing: current.acceptsMarketing, source: 'staff_attestation', recordedById: context.session?.itemId ?? null, customerAssentEvidence: null } } }));
      return updated;
    });
    return { success: true, error: null, customer: { id: customer.id, acceptsMarketing: customer.acceptsMarketing, preferredContactMethod: customer.preferredContactMethod } };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to update customer consent.', customer: null }; }
}

export async function issueCustomerWaiver(_root: unknown, args: { customerId: string; appointmentId?: string | null; title: string; waiverType?: string | null; deliveryStatus?: string | null; idempotencyKey: string }, context: Context) {
  if (!permissions.canManageCustomers({ session: context.session })) return { success: false, error: 'Not authorized to issue waivers.', waiver: null };
  const title = args.title?.trim(); const type = args.waiverType || 'general'; const requestedDelivery = args.deliveryStatus || 'draft';
  if (!args.customerId || !title || title.length > 200 || !['chemical_service', 'minor_consent', 'photo_release', 'general'].includes(type) || !['draft', 'sent'].includes(requestedDelivery) || !args.idempotencyKey?.trim()) return { success: false, error: 'Customer, title, valid waiver type, draft/sent status, and idempotency key are required.', waiver: null };
  try {
    const commandHash = hashPublicAccessToken(args.idempotencyKey.trim());
    const waiver = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client as Prisma.TransactionClient; const eventKey = `customer-waiver:${commandHash}:v1`;
      const shopId = await requireCurrentShopPermission(context.session, 'canManageCustomers', transaction);
      const replay = await transaction.lifecycleOutboxEvent.findUnique({ where: { eventKey } });
      if (replay) {
        const payload = replay.payload as { data?: { waiver?: { id?: string; customerId?: string; title?: string; type?: string; deliveryRequested?: string; appointmentId?: string | null } } } | null; const saved = payload?.data?.waiver;
        if (replay.shopId !== shopId || !saved?.id || saved.customerId !== args.customerId || saved.title !== title || saved.type !== type || saved.deliveryRequested !== requestedDelivery || (saved.appointmentId || null) !== (args.appointmentId || null)) throw new Error('Waiver idempotency key was reused with different input.');
        return transaction.waiverForm.findFirstOrThrow({ where: { id: saved.id, shopId } });
      }
      const customer = await transaction.customer.findFirst({ where: { id: args.customerId, shopId } });
      if (!customer) throw new Error('Customer not found.');
      if (args.appointmentId && !await transaction.appointment.findFirst({ where: { id: args.appointmentId, shopId: customer.shopId, customerId: customer.id } })) throw new Error('Appointment does not belong to this customer and shop.');
      // Nothing is delivered by this command and there is no signable template
      // here, so the waiver is recorded as a draft awaiting delivery and
      // signature; it is never marked sent.
      const created = await transaction.waiverForm.create({ data: { shopId: customer.shopId, customerId: customer.id, appointmentId: args.appointmentId || null, title, waiverType: type as Prisma.WaiverFormCreateInput['waiverType'], status: 'draft', signatureKeyHash: hashPublicAccessToken(`draft:${eventKey}`), metadata: { source: 'operator_issue', signatureRequired: true, deliveryRequested: requestedDelivery, delivered: false, issuedById: context.session?.itemId ?? null } } });
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId, eventKey, eventType: 'waiver.issued', aggregateType: 'waiver_form', aggregateId: created.id, shopId: customer.shopId, occurredAt: created.createdAt, data: { waiver: { id: created.id, customerId: customer.id, appointmentId: args.appointmentId || null, title, type, status: 'draft', deliveryRequested: requestedDelivery, issuedById: context.session?.itemId ?? null } } }));
      return created;
    });
    return { success: true, error: null, waiver: { id: waiver.id, title: waiver.title, waiverType: waiver.waiverType, status: waiver.status } };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to issue waiver.', waiver: null }; }
}
