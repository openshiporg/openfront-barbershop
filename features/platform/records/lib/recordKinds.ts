export type RecordKind = 'service' | 'barber' | 'customer' | 'product';

/** Where each create screen returns to; shared by the server page and the client form. */
export const RECORD_RETURN: Record<RecordKind, string> = {
  service: '/dashboard/platform/services',
  barber: '/dashboard/platform/staff',
  customer: '/dashboard/platform/customers',
  product: '/dashboard/platform/services',
};
