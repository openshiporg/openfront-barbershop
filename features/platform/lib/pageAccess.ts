/**
 * Which platform pages a signed-in user may open in the active shop. Mirrors what each page's
 * projection requires (global role flag AND the shop membership role), so the sidebar hides
 * what a role cannot use and the route answers 404 instead of a 200 error page.
 * Pure module: used by the server guard and the client sidebar.
 */
import { membershipRoleAllows } from '../../keystone/access';

type Flags = Record<string, boolean | null | undefined>;
export type PageAccessUser = {
  role?: Flags | null;
  activeShop?: { id: string; status?: string | null } | null;
  shopMemberships?: Array<{ membershipRole?: string | null; shop?: { id: string; status?: string | null } | null }> | null;
} | null | undefined;

const REPORT_DEPENDENCIES = ['canViewReports', 'canManageAppointments', 'canManagePayments', 'canManageQueue', 'canManageSchedules', 'canManageStaff', 'canManageMemberships'];

// First path segment under /platform -> permissions the page needs (all of them).
export const PLATFORM_PAGE_PERMISSIONS: Record<string, string[]> = {
  booking: ['canManageAppointments', 'canManageCustomers'],
  queue: ['canManageQueue', 'canManageCustomers', 'canManageAppointments'],
  barbershop: ['canManagePayments'],
  services: ['canManageServices'],
  staff: ['canManageSchedules', 'canManageStaff'],
  customers: ['canManageCustomers'],
  pos: ['canManagePayments', 'canManageAppointments', 'canManageCustomers', 'canManageMemberships'],
  inventory: ['canManagePayments'],
  payroll: ['canManagePayments'],
  payments: ['canManagePayments'],
  policies: ['canManageAppointments'],
  // Owner and manager only: canManageOnboarding is in their capabilities and nobody else's.
  team: ['canManageOnboarding'],
  'store-settings': ['canManageOnboarding'],
  reports: REPORT_DEPENDENCIES,
};

/** Membership role in the shop the user is working in; null when it cannot be told yet. */
function activeMembershipRole(user: NonNullable<PageAccessUser>) {
  const memberships = (user.shopMemberships || []).filter((item) => item.shop?.id && (item.shop.status ?? 'active') === 'active');
  const selected = user.activeShop?.id && memberships.some((item) => item.shop?.id === user.activeShop?.id) ? user.activeShop.id : null;
  const shopId = selected || (memberships.length === 1 ? memberships[0].shop!.id : null);
  if (!shopId) return null;
  return memberships.find((item) => item.shop?.id === shopId)?.membershipRole ?? null;
}

export function canUsePermission(user: PageAccessUser, permission: string) {
  if (!user?.role) return true; // unknown user is left to the middleware
  if (!user.role[permission]) return false;
  const role = activeMembershipRole(user);
  // No single shop selected yet: the layout's shop chooser handles it.
  return role === null ? true : membershipRoleAllows(role, permission);
}

/** Pages with no rule (and unknown slugs) stay open; only listed pages are narrowed. */
export function canUsePlatformPage(user: PageAccessUser, slug: string) {
  const needed = PLATFORM_PAGE_PERMISSIONS[slug];
  return !needed || needed.every((permission) => canUsePermission(user, permission));
}

/** The owner "Set up your shop" card is for owners and managers only. */
export function canSeeOnboarding(user: PageAccessUser) {
  return canUsePermission(user, 'canManageOnboarding');
}
