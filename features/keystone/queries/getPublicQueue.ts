import { publicAccessTokenMatches } from '../utils/publicAccessToken';
import { resolvePublishedShop } from '../utils/publicShop';

type QueueArgs = {
  queueEntryId?: string | null;
  accessToken?: string | null;
};

type PublicQueueContext = {
  sudo(): {
    prisma: {
      shop: { findMany(args: Record<string, unknown>): Promise<Array<{ id: string }>> };
      walkInQueueEntry: {
        findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
        findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
      };
    };
  };
};

function toIsoString(value: unknown) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function publicQueueItem(item: Record<string, unknown>) {
  return {
    id: item.id,
    status: item.status,
    partySize: item.partySize,
    quotedWaitMinutes: item.quotedWaitMinutes,
    checkedInAt: toIsoString(item.checkedInAt),
    seatedAt: toIsoString(item.seatedAt),
    requestedService: item.requestedService ?? null,
    requestedBarber: item.requestedBarber ?? null,
  };
}

export async function getPublicQueue(
  _root: unknown,
  _args: unknown,
  context: PublicQueueContext
) {
  const prisma = context.sudo().prisma;
  const shop = await resolvePublishedShop(prisma, { id: true });
  if (!shop) return [];
  const items = await prisma.walkInQueueEntry.findMany({
    where: { shopId: shop.id, status: { in: ['waiting', 'texted', 'in_chair'] } },
    orderBy: { checkedInAt: 'asc' },
    take: 100,
    select: {
      id: true,
      status: true,
      partySize: true,
      quotedWaitMinutes: true,
      checkedInAt: true,
      seatedAt: true,
      requestedService: {
        select: { id: true, name: true, imagePath: true, durationMinutes: true },
      },
      requestedBarber: {
        select: { id: true, displayName: true, imagePath: true, chairNumber: true },
      },
    },
  });

  return items.map(publicQueueItem);
}

export async function getPublicQueueEntry(
  _root: unknown,
  args: QueueArgs,
  context: PublicQueueContext
) {
  const queueEntryId = args.queueEntryId?.trim();
  const accessToken = args.accessToken?.trim();
  if (!queueEntryId || !accessToken) return null;

  const item = await context.sudo().prisma.walkInQueueEntry.findUnique({
    where: { id: queueEntryId },
    select: {
      id: true,
      publicAccessTokenHash: true,
      status: true,
      partySize: true,
      quotedWaitMinutes: true,
      checkedInAt: true,
      seatedAt: true,
      requestedService: {
        select: { id: true, name: true, imagePath: true, durationMinutes: true },
      },
      requestedBarber: {
        select: { id: true, displayName: true, imagePath: true, chairNumber: true },
      },
    },
  });

  if (!item || !publicAccessTokenMatches(accessToken, String(item.publicAccessTokenHash || ''))) {
    return null;
  }

  return publicQueueItem(item);
}
