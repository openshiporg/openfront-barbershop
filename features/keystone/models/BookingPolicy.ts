import { list } from '@keystone-6/core';
import { integer, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { permissions, rules, type Session } from '../access';
import { trackingFields } from './trackingFields';
import { validateShopRelationships, connectedRelationshipId } from '../utils/shopRelationshipHooks';
import { assertCurrentShopAccess } from '../utils/currentAuthorization';

type PolicyPrisma = {
  bookingPolicy: { findFirst(args: Record<string, unknown>): Promise<{ id: string; version: string } | null> };
};

async function assertPolicyAuthority(args: { context: { session?: unknown; prisma: unknown }; addValidationError(message: string): void }, shopId: string) {
  try {
    const session = args.context.session as Session | undefined;
    // Owners/managers running setup may create the first policy; otherwise
    // appointment-policy permission is required in the selected shop.
    const permission = session?.data.role?.canManageAppointments ? 'canManageAppointments' : 'canManageOnboarding';
    await assertCurrentShopAccess(session, shopId, args.context.prisma as never, permission);
    return true;
  } catch {
    args.addValidationError('Current appointment-policy permission and active shop membership are required.');
    return false;
  }
}

/**
 * Policies are versioned and immutable. A policy is replaced by first retiring
 * it (setting effectiveUntil once, and/or status Retired) and then creating the
 * next version whose effective window does not overlap any active version.
 * Accepted appointments keep their own policy snapshots.
 */
export const BookingPolicy = list({
  hooks: { validate: {
    create: async (args) => {
      await validateShopRelationships(args, []);
      const shopId = connectedRelationshipId(args.resolvedData.shop);
      if (shopId) await assertPolicyAuthority(args, shopId);
      const start = new Date(String(args.resolvedData.effectiveFrom || ''));
      const end = args.resolvedData.effectiveUntil ? new Date(String(args.resolvedData.effectiveUntil)) : null;
      if (Number.isNaN(start.getTime()) || (end && (Number.isNaN(end.getTime()) || end <= start))) {
        args.addValidationError('Booking policy effective dates are invalid.');
        return;
      }
      if (shopId && args.resolvedData.status !== 'retired') {
        const overlapping = await (args.context.prisma as unknown as PolicyPrisma).bookingPolicy.findFirst({
          where: {
            shopId, status: 'active',
            ...(end ? { effectiveFrom: { lt: end } } : {}),
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: start } }],
          },
          select: { id: true, version: true },
        });
        if (overlapping) args.addValidationError(`Policy version ${overlapping.version} is still effective in this window. Set its end date or retire it first.`);
      }
    },
    update: async (args) => {
      const allowed = new Set(['effectiveUntil', 'status']);
      if (Object.keys(args.resolvedData).some((key) => !allowed.has(key))) {
        args.addValidationError('Only the end date and retirement of a booking policy can be changed.');
        return;
      }
      if (!(await assertPolicyAuthority(args, String(args.item.shopId)))) return;
      if (args.resolvedData.status !== undefined && !(args.item.status === 'active' && args.resolvedData.status === 'retired') && args.resolvedData.status !== args.item.status) {
        args.addValidationError('A retired booking policy cannot be reactivated. Create a new version instead.');
      }
      if (args.resolvedData.effectiveUntil !== undefined) {
        if (args.item.effectiveUntil) {
          args.addValidationError('This policy already has an end date.');
          return;
        }
        const end = args.resolvedData.effectiveUntil ? new Date(String(args.resolvedData.effectiveUntil)) : null;
        const start = new Date(String(args.item.effectiveFrom));
        if (!end || Number.isNaN(end.getTime()) || end <= start) args.addValidationError('The end date must be after the policy start date.');
        else if (end.getTime() < Date.now() - 60_000) args.addValidationError('The end date cannot be in the past; policies already applied to bookings stay as they were.');
      }
    },
  } },
  access: {
    operation: {
      query: permissions.canReadAppointments,
      create: (args) => permissions.canManageAppointments(args) || permissions.canManageOnboarding(args),
      update: permissions.canManageAppointments,
      delete: () => false,
    },
    filter: { query: rules.canAccessShopRecords, update: rules.canAccessShopRecords },
  },
  ui: { listView: { initialColumns: ['name', 'version', 'publicServiceEligibility', 'jurisdictionCode', 'status', 'effectiveFrom', 'effectiveUntil'] } },
  fields: {
    shop: relationship({ ref: 'Shop.bookingPolicies', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') }, access: { update: () => false } }),
    name: text({ validation: { isRequired: true }, access: { update: () => false } }),
    version: text({ validation: { isRequired: true }, access: { update: () => false } }),
    jurisdictionCode: text({ validation: { isRequired: true }, access: { update: () => false } }),
    policyTextHash: text({ validation: { isRequired: true }, access: { update: () => false } }),
    status: select({ type: 'enum', options: [{ label: 'Active', value: 'active' }, { label: 'Retired', value: 'retired' }], defaultValue: 'active' }),
    effectiveFrom: timestamp({ validation: { isRequired: true }, access: { update: () => false } }),
    effectiveUntil: timestamp({ ui: { description: 'Set once to close this version before creating the next one.' } }),
    cancellationWindowMinutes: integer({ validation: { isRequired: true, min: 0 }, defaultValue: 1440, access: { update: () => false } }),
    rescheduleWindowMinutes: integer({ validation: { isRequired: true, min: 0 }, defaultValue: 1440, access: { update: () => false } }),
    lateCancellationFeeAmount: integer({ validation: { isRequired: true, min: 0 }, defaultValue: 0, access: { update: () => false } }),
    rescheduleFeeAmount: integer({ validation: { isRequired: true, min: 0 }, defaultValue: 0, access: { update: () => false } }),
    depositCancellationRule: select({
      type: 'enum',
      options: [
        { label: 'Refund', value: 'refund' },
        { label: 'Forfeit', value: 'forfeit' },
        { label: 'Manual Review', value: 'manual_review' },
      ],
      defaultValue: 'manual_review',
      access: { update: () => false },
    }),
    publicServiceEligibility: select({
      type: 'enum',
      options: [
        { label: 'Legacy: any active shop service may be requested directly', value: 'legacy_active_service' },
        { label: 'Active public catalog only', value: 'active_catalog' },
      ],
      defaultValue: 'legacy_active_service',
      db: { isNullable: false },
      validation: { isRequired: true },
      access: { update: () => false },
      ui: { description: 'Immutable versioned eligibility. Catalog discovery always requires an active same-shop category. Legacy mode preserves direct booking of uncategorized/hidden-category active services; capacity and authority checks still apply.' },
    }),
    maxCustomerReschedules: integer({ validation: { isRequired: true, min: 0, max: 20 }, defaultValue: 2, access: { update: () => false } }),
    ...trackingFields,
  },
});
