import { activeShopIds, type Session } from '../access';

type HookRecord = Record<string, unknown>;

type ShopPrisma = Record<string, {
  findUnique(args: { where: { id: string }; select: { id: true; shopId: true } }): Promise<{ id: string; shopId: string | null } | null>;
  findMany(args: { where: { id: { in: string[] } }; select: { id: true; shopId: true } }): Promise<Array<{ id: string; shopId: string | null }>>;
}>;

type HookContext = { prisma: unknown; session?: Session };

type HookArgs = {
  resolvedData: HookRecord;
  item?: HookRecord;
  context: HookContext;
  addValidationError(message: string): void;
};

type RelatedShopSpec = {
  field: string;
  delegate: string;
  many?: boolean;
};

export function connectedRelationshipId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const relationship = value as { connect?: { id?: unknown }; disconnect?: boolean };
  if (relationship.disconnect) return undefined;
  return typeof relationship.connect?.id === 'string' ? relationship.connect.id : undefined;
}

function connectedRelationshipIds(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  const relationship = value as {
    connect?: { id?: unknown } | Array<{ id?: unknown }>;
    set?: Array<{ id?: unknown }>;
  };
  const candidates = [
    ...(Array.isArray(relationship.connect) ? relationship.connect : relationship.connect ? [relationship.connect] : []),
    ...(Array.isArray(relationship.set) ? relationship.set : []),
  ];
  return candidates.map((item) => item.id).filter((id): id is string => typeof id === 'string');
}

export async function validateShopRelationships(args: HookArgs, relationships: RelatedShopSpec[]) {
  const shopId = connectedRelationshipId(args.resolvedData.shop) || String(args.item?.shopId || '');
  if (!shopId) {
    args.addValidationError('Shop is required for this merchant record.');
    return;
  }
  // No permission flag (including onboarding) widens this: writes are bound to
  // the caller's selected active shop. Onboarding refreshes its session to the
  // shop it created or already owns before writing child records.
  if (args.context.session && !activeShopIds(args.context.session).includes(shopId)) {
    args.addValidationError('Not authorized to create or change records for this shop.');
  }

  for (const relationship of relationships) {
    const prisma = args.context.prisma as ShopPrisma;
    if (relationship.many) {
      const relationIds = connectedRelationshipIds(args.resolvedData[relationship.field]);
      if (relationIds.length === 0) continue;
      const relatedItems = await prisma[relationship.delegate].findMany({
        where: { id: { in: relationIds } },
        select: { id: true, shopId: true },
      });
      if (relatedItems.length !== new Set(relationIds).size || relatedItems.some((related) => related.shopId !== shopId)) {
        args.addValidationError(`${relationship.field} must belong to the same shop.`);
      }
      continue;
    }

    const relationId = args.resolvedData[relationship.field] === undefined
      ? String(args.item?.[`${relationship.field}Id`] || '')
      : connectedRelationshipId(args.resolvedData[relationship.field]);
    if (!relationId) continue;
    const related = await prisma[relationship.delegate].findUnique({
      where: { id: relationId },
      select: { id: true, shopId: true },
    });
    if (!related || related.shopId !== shopId) {
      args.addValidationError(`${relationship.field} must belong to the same shop.`);
    }
  }
}
