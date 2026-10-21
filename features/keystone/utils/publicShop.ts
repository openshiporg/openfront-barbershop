type PublishedShop = {
  id: string;
  name?: string | null;
  tagline?: string | null;
  address?: string | null;
  phone?: string | null;
  timezone?: string | null;
  currencyCode?: string | null;
  hours?: unknown;
  brandColor?: string | null;
  logoIcon?: string | null;
  logoColor?: string | null;
  isDemo?: boolean | null;
};

type PublishedShopClient = {
  shop: {
    findMany(args: Record<string, unknown>): Promise<PublishedShop[]>;
  };
};

/**
 * A flattened local storefront can publish exactly one active shop. Returning
 * null for zero or multiple matches avoids silently exposing the wrong tenant.
 */
export async function resolvePublishedShop(client: unknown, select: Record<string, unknown> = { id: true }) {
  const database = client as PublishedShopClient;
  const shops = await database.shop.findMany({
    where: { status: 'active', isPublic: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 2,
    select,
  });

  return shops.length === 1 ? shops[0] : null;
}
