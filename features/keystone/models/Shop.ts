import { list } from '@keystone-6/core';
import { checkbox, json, relationship, select, text } from '@keystone-6/core/fields';

import { permissions, type Session } from '../access';
import { currentManagedShopIds, currentMembershipShopIds, hasCurrentRolePermission } from '../utils/currentAuthorization';
import { trackingFields } from './trackingFields';
import { assertUsdSettlementCurrency } from '../utils/supportedSettlementCurrency';
import { sanitizeStoreLogoSvg } from '../../shared/sanitize-store-logo';
import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from '../../platform/store-settings/lib/store-logo';

const currentShopReadAccess = async ({ session }: { session?: Session }) => {
  if (!permissions.canAccessDashboard({ session })) return false;
  return hasCurrentRolePermission(session, 'canAccessDashboard');
};

const currentShopCreateAccess = async ({ session }: { session?: Session }) => {
  if (!permissions.canManageOnboarding({ session })) return false;
  // Shop bootstrap has no selected shop yet; recheck only the global onboarding grant.
  return hasCurrentRolePermission(session, 'canManageOnboarding');
};

const currentShopManageAccess = async ({ session }: { session?: Session }) => {
  if (!permissions.canManageShops({ session })) return false;
  return (await currentManagedShopIds(session)).length > 0;
};

const currentShopReadFilter = async (session?: Session) => {
  const shopIds = await currentMembershipShopIds(session);
  return shopIds.length ? { id: { in: shopIds } } : false;
};

const currentShopManageFilter = async (session?: Session) => {
  const shopIds = await currentManagedShopIds(session);
  return shopIds.length ? { id: { in: shopIds } } : false;
};

export const Shop = list({
  access: {
    operation: {
      query: currentShopReadAccess,
      create: currentShopCreateAccess,
      update: currentShopManageAccess,
      delete: currentShopManageAccess,
    },
    filter: {
      query: ({ session }) => currentShopReadFilter(session),
      update: ({ session }) => currentShopManageFilter(session),
      delete: ({ session }) => currentShopManageFilter(session),
    },
  },
  ui: {
    listView: { initialColumns: ['name', 'slug', 'status', 'phone', 'timezone'] },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    legalName: text({ validation: { isRequired: true } }),
    slug: text({
      isIndexed: 'unique',
      validation: {
        isRequired: true,
        match: {
          regex: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
          explanation: 'Use a lowercase URL-safe shop slug.',
        },
      },
    }),
    status: select({
      type: 'enum',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' },
        { label: 'Inactive', value: 'inactive' },
      ],
      defaultValue: 'active',
    }),
    logoIcon: text({
      defaultValue: DEFAULT_STORE_LOGO_ICON,
      hooks: { resolveInput: ({ resolvedData, fieldKey }) => {
        const value = resolvedData[fieldKey];
        if (value === undefined) return undefined;
        const sanitized = typeof value === 'string' ? sanitizeStoreLogoSvg(value) : '';
        if (!sanitized) throw new Error('Invalid SVG format.');
        return sanitized;
      } },
    }),
    logoColor: text({ defaultValue: '0', hooks: { resolveInput: ({ resolvedData, fieldKey }) => resolvedData[fieldKey] === undefined ? undefined : normalizeStoreLogoColor(resolvedData[fieldKey]) } }),
    tagline: text(),
    address: text(),
    phone: text(),
    timezone: text({ defaultValue: 'America/New_York', validation: { isRequired: true }, hooks: { resolveInput: ({ resolvedData, fieldKey }) => { const value = resolvedData[fieldKey]; if (value === undefined) return undefined; try { new Intl.DateTimeFormat('en', { timeZone: String(value) }).format(); } catch { throw new Error('Timezone must be a valid IANA timezone.'); } return value; } } }),
    currencyCode: text({ defaultValue: 'USD', validation: { isRequired: true }, hooks: { resolveInput: ({ resolvedData, fieldKey }) => { const value = resolvedData[fieldKey]; if (value === undefined) return undefined; assertUsdSettlementCurrency(value); return value; } } }),
    jurisdictionCode: text({ ui: { description: 'Merchant-reviewed operating jurisdiction, for example US-NY. Required before public booking.' } }),
    hours: json({ defaultValue: {} }),
    brandColor: select({
      type: 'enum',
      options: [
        { label: 'Warm amber', value: 'amber' },
        { label: 'Indigo', value: 'indigo' },
        { label: 'Emerald', value: 'emerald' },
        { label: 'Rose', value: 'rose' },
        { label: 'Slate', value: 'slate' },
      ],
      defaultValue: 'amber',
      validation: { isRequired: true },
      ui: { description: 'Constrained storefront brand palette.' },
    }),
    isPublic: checkbox({ defaultValue: false }),
    isDemo: checkbox({ defaultValue: false }),
    memberships: relationship({ ref: 'ShopMembership.shop', many: true, access: { create: () => false, update: () => false } }),
    activeUsers: relationship({ ref: 'User.activeShop', many: true, access: { create: () => false, update: () => false } }),
    chairs: relationship({ ref: 'BarberChair.shop', many: true, access: { create: () => false, update: () => false } }),
    barbers: relationship({ ref: 'Barber.shop', many: true, access: { create: () => false, update: () => false } }),
    scheduleExceptions: relationship({ ref: 'ScheduleException.shop', many: true, access: { create: () => false, update: () => false } }),
    staffShifts: relationship({ ref: 'StaffShift.shop', many: true, access: { create: () => false, update: () => false } }),
    customers: relationship({ ref: 'Customer.shop', many: true, access: { create: () => false, update: () => false } }),
    customerNotes: relationship({ ref: 'CustomerNote.shop', many: true, access: { create: () => false, update: () => false } }),
    groomingNotes: relationship({ ref: 'GroomingNote.shop', many: true, access: { create: () => false, update: () => false } }),
    waiverForms: relationship({ ref: 'WaiverForm.shop', many: true, access: { create: () => false, update: () => false } }),
    serviceCategories: relationship({ ref: 'ServiceCategory.shop', many: true, access: { create: () => false, update: () => false } }),
    services: relationship({ ref: 'Service.shop', many: true, access: { create: () => false, update: () => false } }),
    products: relationship({ ref: 'Product.shop', many: true, access: { create: () => false, update: () => false } }),
    servicePackages: relationship({ ref: 'ServicePackage.shop', many: true, access: { create: () => false, update: () => false } }),
    membershipPlans: relationship({ ref: 'MembershipPlan.shop', many: true, access: { create: () => false, update: () => false } }),
    customerPackages: relationship({ ref: 'CustomerPackage.shop', many: true, access: { create: () => false, update: () => false } }),
    membershipEvents: relationship({ ref: 'MembershipEvent.shop', many: true, access: { create: () => false, update: () => false } }),
    appointments: relationship({ ref: 'Appointment.shop', many: true, access: { create: () => false, update: () => false } }),
    appointmentChangeEvents: relationship({ ref: 'AppointmentChangeEvent.shop', many: true, access: { create: () => false, update: () => false } }),
    bookingPolicies: relationship({ ref: 'BookingPolicy.shop', many: true, access: { create: () => false, update: () => false } }),
    practitionerCredentials: relationship({ ref: 'PractitionerCredential.shop', many: true, access: { create: () => false, update: () => false } }),
    noShowPolicies: relationship({ ref: 'NoShowPolicy.shop', many: true, access: { create: () => false, update: () => false } }),
    noShowEvents: relationship({ ref: 'NoShowEvent.shop', many: true, access: { create: () => false, update: () => false } }),
    queueEntries: relationship({ ref: 'WalkInQueueEntry.shop', many: true, access: { create: () => false, update: () => false } }),
    waitlistEntries: relationship({ ref: 'WaitlistEntry.shop', many: true, access: { create: () => false, update: () => false } }),
    transactions: relationship({ ref: 'CheckoutTransaction.shop', many: true, access: { create: () => false, update: () => false } }),
    paymentProviders: relationship({ ref: 'PaymentProvider.shop', many: true, access: { create: () => false, update: () => false } }),
    paymentSessions: relationship({ ref: 'PaymentSession.shop', many: true, access: { create: () => false, update: () => false } }),
    commissions: relationship({ ref: 'Commission.shop', many: true, access: { create: () => false, update: () => false } }),
    commissionPayouts: relationship({ ref: 'CommissionPayout.shop', many: true, access: { create: () => false, update: () => false } }),
    tips: relationship({ ref: 'Tip.shop', many: true, access: { create: () => false, update: () => false } }),
    suppliers: relationship({ ref: 'Supplier.shop', many: true, access: { create: () => false, update: () => false } }),
    inventoryLots: relationship({ ref: 'InventoryLot.shop', many: true, access: { create: () => false, update: () => false } }),
    inventoryMovements: relationship({ ref: 'InventoryMovement.shop', many: true, access: { create: () => false, update: () => false } }),
    productSaleLines: relationship({ ref: 'ProductSaleLine.shop', many: true, access: { create: () => false, update: () => false } }),
    paymentReconciliations: relationship({ ref: 'PaymentReconciliation.shop', many: true, access: { create: () => false, update: () => false } }),
    lifecycleEvents: relationship({ ref: 'LifecycleOutboxEvent.shop', many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields,
  },
});
