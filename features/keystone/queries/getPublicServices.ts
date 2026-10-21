import { resolvePublishedShop } from '../utils/publicShop';

type PublicServiceContext = {
  sudo(): {
    prisma: {
      shop: { findMany(args: Record<string, unknown>): Promise<Array<{ id: string }>> };
      serviceCategory: { findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]> };
      barber: { findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]> };
      product: { findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]> };
    };
  };
};

async function canonicalPublicShopId(context: PublicServiceContext) {
  const shop = await resolvePublishedShop(context.sudo().prisma, { id: true });
  return shop?.id || '';
}

export async function getPublicServiceCatalog(
  _root: unknown,
  _args: unknown,
  context: PublicServiceContext
) {
  const shopId = await canonicalPublicShopId(context);
  if (!shopId) return [];
  return context.sudo().prisma.serviceCategory.findMany({
    where: { shopId, status: 'active' },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      services: {
        where: { shopId, status: 'active' },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          imagePath: true,
          durationMinutes: true,
          price: true,
          depositRequired: true,
          depositAmount: true,
          color: true,
          specialists: {
            where: { shopId, status: 'active', bookingEnabled: true },
            orderBy: { displayName: 'asc' },
            select: { id: true, displayName: true, imagePath: true, chairNumber: true, bookingEnabled: true },
          },
        },
      },
    },
  });
}

export async function getPublicBarbers(
  _root: unknown,
  _args: unknown,
  context: PublicServiceContext
) {
  const shopId = await canonicalPublicShopId(context);
  if (!shopId) return [];
  return context.sudo().prisma.barber.findMany({
    where: { shopId, status: 'active', bookingEnabled: true },
    orderBy: { displayName: 'asc' },
    select: {
      id: true,
      displayName: true,
      bio: true,
      imagePath: true,
      chairNumber: true,
      bookingEnabled: true,
      specialties: {
        where: { shopId, status: 'active' },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          imagePath: true,
          durationMinutes: true,
          price: true,
          depositRequired: true,
          depositAmount: true,
          color: true,
        },
      },
    },
  });
}

export async function getPublicProducts(
  _root: unknown,
  _args: unknown,
  context: PublicServiceContext
) {
  const shopId = await canonicalPublicShopId(context);
  if (!shopId) return [];
  return context.sudo().prisma.product.findMany({
    where: { shopId, status: 'active' },
    orderBy: { name: 'asc' },
    take: 24,
    select: {
      id: true,
      name: true,
      sku: true,
      productType: true,
      price: true,
      description: true,
      imagePath: true,
    },
  });
}
