import type { Prisma, PrismaClient } from '@prisma/client';
import { createPublicAccessToken, hashPublicAccessToken } from '../utils/publicAccessToken';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { resolvePublishedShop } from '../utils/publicShop';
import { runSerializableTransaction } from '../utils/serializableTransaction';

type Args = {
  customerName: string;
  phone: string;
  partySize?: number | null;
  requestedServiceId?: string | null;
  requestedBarberId?: string | null;
  /** Optional client-generated access token: retrying with it returns the same entry. */
  accessToken?: string | null;
};

// Trusted Keystone resolver context; never taken from GraphQL arguments.
type Context = { prisma: PrismaClient };

const ACTIVE_QUEUE_STATUSES = ['waiting', 'texted', 'in_chair'] as const;
const CLIENT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

class QueueRejected extends Error {}

function clean(value?: string | null) {
  return value?.trim() || '';
}

function rejected(error: string) {
  return { success: false, error, queueEntry: null, accessToken: null };
}

const QUEUE_ENTRY_SELECT = {
  id: true,
  status: true,
  partySize: true,
  quotedWaitMinutes: true,
  checkedInAt: true,
  createdAt: true,
  customerName: true,
  phone: true,
  requestedServiceId: true,
  requestedBarberId: true,
  requestedService: { select: { id: true, name: true, imagePath: true, durationMinutes: true } },
  requestedBarber: { select: { id: true, displayName: true, imagePath: true, chairNumber: true } },
} as const;

export default async function createPublicQueueEntry(_root: unknown, args: Args, context: Context) {
  const customerName = clean(args.customerName);
  const phone = clean(args.phone);
  const phoneKey = phone.replace(/\D/g, '');
  const requestedServiceId = clean(args.requestedServiceId);
  const requestedBarberId = clean(args.requestedBarberId);
  const partySize = args.partySize == null ? 1 : Number(args.partySize);
  const clientToken = clean(args.accessToken);

  if (customerName.length < 2 || customerName.length > 120) return rejected('Enter a valid name.');
  if (phoneKey.length < 7 || phone.length > 40) return rejected('Enter a valid phone number.');
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 8) return rejected('Party size must be between 1 and 8.');
  if (clientToken && !CLIENT_TOKEN_PATTERN.test(clientToken)) return rejected('Unable to join the queue. Reload the page and try again.');

  const prisma = context.prisma;
  const access = clientToken ? { token: clientToken, hash: hashPublicAccessToken(clientToken) } : createPublicAccessToken();
  try {
    const queueEntry = await runSerializableTransaction(prisma, async (client) => {
      const transaction = client as Prisma.TransactionClient;
      const publishedShop = await resolvePublishedShop(transaction, { id: true });
      if (!publishedShop) throw new QueueRejected('The walk-in queue is not open online right now. Contact the shop.');
      const shopId = publishedShop.id;
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-public-queue', `${shopId}:${phoneKey}`);

      // Same token retried after a lost response: return the original entry.
      if (clientToken) {
        const original = await transaction.walkInQueueEntry.findFirst({ where: { shopId, publicAccessTokenHash: access.hash }, select: QUEUE_ENTRY_SELECT });
        if (original) {
          if (original.customerName !== customerName || original.phone !== phone || original.partySize !== partySize
            || (original.requestedServiceId || '') !== requestedServiceId || (original.requestedBarberId || '') !== requestedBarberId) {
            throw new QueueRejected('This request was already sent with different details. Reload the page to start a new request.');
          }
          return original;
        }
      }

      // Eligibility is checked inside the same transaction that creates the entry.
      const [service, barber] = await Promise.all([
        requestedServiceId
          ? transaction.service.findUnique({ where: { id: requestedServiceId }, select: { id: true, status: true, shopId: true, specialists: { select: { id: true } } } })
          : null,
        requestedBarberId
          ? transaction.barber.findUnique({ where: { id: requestedBarberId }, select: { id: true, status: true, bookingEnabled: true, shopId: true } })
          : null,
      ]);
      if (requestedServiceId && (!service || service.status !== 'active' || service.shopId !== shopId)) throw new QueueRejected('Selected service is no longer available.');
      if (requestedBarberId && (!barber || barber.status !== 'active' || !barber.bookingEnabled || barber.shopId !== shopId)) throw new QueueRejected('Selected barber is no longer available.');
      if (service?.specialists.length && requestedBarberId && !service.specialists.some((specialist) => specialist.id === requestedBarberId)) {
        throw new QueueRejected('That barber does not offer the selected service.');
      }

      // Compare phone numbers by digits so formatting differences can't create duplicates.
      const duplicates = await transaction.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM "WalkInQueueEntry" WHERE "shop" = $1 AND status::text = ANY($2::text[]) AND regexp_replace(phone, '[^0-9]', '', 'g') = $3 LIMIT 1`,
          shopId, [...ACTIVE_QUEUE_STATUSES], phoneKey,
        );
      if (duplicates.length) throw new QueueRejected('This phone number is already in the queue. Contact the shop if you need help.');

      const created = await transaction.walkInQueueEntry.create({
        data: {
          shopId,
          customerName,
          phone,
          partySize,
          status: 'waiting',
          // No estimate until staff provide one; never invent a wait time.
          quotedWaitMinutes: null,
          publicAccessTokenHash: access.hash,
          requestedServiceId: requestedServiceId || null,
          requestedBarberId: requestedBarberId || null,
        },
        select: QUEUE_ENTRY_SELECT,
      });
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({
        eventKey: `queue:${created.id}:checked_in:v1`,
        eventType: 'queue.checked_in',
        aggregateType: 'walk_in_queue_entry',
        aggregateId: created.id,
        shopId,
        occurredAt: created.createdAt,
        data: {
          queueEntry: {
            id: created.id,
            status: created.status,
            requestedServiceId: requestedServiceId || null,
            requestedBarberId: requestedBarberId || null,
            partySize,
          },
        },
      }));
      return created;
    });

    return {
      success: true,
      error: null,
      accessToken: access.token,
      queueEntry: {
        id: queueEntry.id,
        status: queueEntry.status,
        partySize: queueEntry.partySize,
        quotedWaitMinutes: queueEntry.quotedWaitMinutes,
        requestedService: queueEntry.requestedService,
        requestedBarber: queueEntry.requestedBarber,
        checkedInAt: queueEntry.checkedInAt instanceof Date ? queueEntry.checkedInAt.toISOString() : queueEntry.checkedInAt,
      },
    };
  } catch (error) {
    return rejected(error instanceof QueueRejected ? error.message : 'We couldn’t confirm your place in the queue. Try again in a moment, or contact the shop.');
  }
}
