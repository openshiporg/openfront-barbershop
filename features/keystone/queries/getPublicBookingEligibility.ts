import { getBookingEligibilityProjection } from '../utils/bookingPolicy';
import { resolvePublishedShop } from '../utils/publicShop';

type Context = { prisma: Parameters<typeof getBookingEligibilityProjection>[0] };

export default async function getPublicBookingEligibility(_root: unknown, _args: unknown, context: Context) {
  const shop = await resolvePublishedShop(context.prisma, { id: true });
  if (!shop) return { success: false, error: 'Public booking is unavailable.', data: null };
  // Narrow policy descriptor only: no cancellation fees, hashes, private shop data,
  // or raw CRUD access is granted by this anonymous custom operation.
  return getBookingEligibilityProjection(context.prisma, shop.id);
}
