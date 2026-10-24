import { resolvePublishedShop } from '../utils/publicShop';

type ImageQuery = { findMany(args: { where: Record<string, unknown>; query: string }): Promise<Array<{ id: string; [field: string]: unknown }>> };

type PublicServiceContext = {
  sudo(): {
    query: { Service: ImageQuery; Barber: ImageQuery; Product: ImageQuery };
    prisma: {
      shop: { findMany(args: Record<string, unknown>): Promise<Array<{ id: string }>> };
      serviceCategory: { findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]> };
      barber: { findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]> };
      product: { findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]> };
    };
  };
};

type Row = Record<string, unknown> & { id?: unknown; imagePath?: unknown };

/**
 * Uploaded images live in signed S3 storage, so their URLs are resolved at
 * read time and replace the stored path; rows without an upload keep imagePath.
 */
async function applyUploadedImages(context: PublicServiceContext, list: 'Service' | 'Barber' | 'Product', field: 'image' | 'photo', rows: Row[]) {
  const ids = [...new Set(rows.map((row) => String(row.id || '')).filter(Boolean))];
  if (!ids.length) return;
  const found = await context.sudo().query[list].findMany({ where: { id: { in: ids } }, query: `id ${field} { url }` });
  const urls = new Map(found.flatMap((item) => {
    const url = (item[field] as { url?: string } | null)?.url;
    return url ? [[item.id, url] as const] : [];
  }));
  for (const row of rows) {
    const url = urls.get(String(row.id || ''));
    if (url) row.imagePath = url;
  }
}

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
  const categories = await context.sudo().prisma.serviceCategory.findMany({
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
  const services = categories.flatMap((category) => (category.services as Row[]) || []);
  await Promise.all([
    applyUploadedImages(context, 'Service', 'image', services),
    applyUploadedImages(context, 'Barber', 'photo', services.flatMap((service) => (service.specialists as Row[]) || [])),
  ]);
  return categories;
}

export async function getPublicBarbers(
  _root: unknown,
  _args: unknown,
  context: PublicServiceContext
) {
  const shopId = await canonicalPublicShopId(context);
  if (!shopId) return [];
  const barbers = await context.sudo().prisma.barber.findMany({
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
  await Promise.all([
    applyUploadedImages(context, 'Barber', 'photo', barbers as Row[]),
    applyUploadedImages(context, 'Service', 'image', barbers.flatMap((barber) => (barber.specialties as Row[]) || [])),
  ]);
  return barbers;
}

export async function getPublicProducts(
  _root: unknown,
  _args: unknown,
  context: PublicServiceContext
) {
  const shopId = await canonicalPublicShopId(context);
  if (!shopId) return [];
  const products = await context.sudo().prisma.product.findMany({
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
  await applyUploadedImages(context, 'Product', 'image', products as Row[]);
  return products;
}
