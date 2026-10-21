import { parsePublicServiceEligibility } from '../../shared/public-booking-eligibility';

export type PublicBookingService = {
  shopId: string;
  status?: string | null;
  shop: { id: string; status?: string | null; isPublic?: boolean | null };
  categoryId?: string | null;
  category?: { id: string; shopId: string; status?: string | null } | null;
};

export function assertPublicServiceEligibility(
  service: PublicBookingService,
  publishedShopId: string,
  policy: unknown,
) {
  if (!publishedShopId || service.shopId !== publishedShopId || service.shop.id !== publishedShopId
    || service.shop.status !== 'active' || !service.shop.isPublic || service.status !== 'active') {
    throw new Error('Selected service is no longer available.');
  }
  if ((service.category && service.category.shopId !== service.shopId)
    || (service.categoryId && service.category?.id !== service.categoryId)) {
    throw new Error('Selected service category does not belong to this shop.');
  }
  if (parsePublicServiceEligibility(policy) === 'active_catalog'
    && (!service.category || service.category.status !== 'active')) {
    throw new Error('This shop accepts online requests only for services in its active public catalog.');
  }
}
