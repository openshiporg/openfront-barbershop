export type Session = {
  itemId: string
  listKey: string
  data: {
    name: string
    activeShop?: { id: string; slug?: string | null; status?: string | null } | null
    shopMemberships?: Array<{
      id?: string
      status?: string | null
      membershipRole?: string | null
      shop?: { id: string; slug?: string | null; status?: string | null } | null
    }>
    role: {
      id: string
      name: string
      canSeeOtherPeople: boolean
      canEditOtherPeople: boolean
      canManagePeople: boolean
      canManageRoles: boolean
      canAccessDashboard: boolean
      canManageOnboarding: boolean
      canManageServices: boolean
      canManageStaff: boolean
      canManageSchedules: boolean
      canManageAppointments: boolean
      canManageQueue: boolean
      canManageCustomers: boolean
      canManageCustomerNotes: boolean
      canManageMemberships: boolean
      canManagePayments: boolean
      canViewReports: boolean
    }
  }
}

type AccessArgs = {
  session?: Session
  context?: { prisma: unknown }
}

type CustomerNoteAccessPrisma = {
  user: {
    findUnique(args: { where: { id: string }; select: { role: { select: { canManageCustomerNotes: true } } } }): Promise<{ role: { canManageCustomerNotes: boolean } | null } | null>
  }
  shopMembership: {
    findMany(args: { where: { userId: string; shopId: { in: string[] }; status: 'active'; shop: { status: 'active' } }; select: { shopId: true; membershipRole: true } }): Promise<Array<{ shopId: string; membershipRole: string | null }>>
  }
}

export function isSignedIn({ session }: AccessArgs) {
  return Boolean(session)
}

export function membershipShopIds(session?: Session) {
  return Array.from(new Set(
    (session?.data.shopMemberships ?? [])
      .filter((membership) => membership.status === 'active' && membership.shop?.status === 'active')
      .map((membership) => membership.shop?.id)
      .filter((shopId): shopId is string => Boolean(shopId))
  )).sort()
}

export function activeShopIds(session?: Session) {
  const eligibleShopIds = membershipShopIds(session)
  const selectedShopId = session?.data.activeShop?.status === 'active' ? session.data.activeShop.id : ''
  if (selectedShopId) return eligibleShopIds.includes(selectedShopId) ? [selectedShopId] : []
  return eligibleShopIds.length === 1 ? eligibleShopIds : []
}

export function managedShopIds(session?: Session) {
  return Array.from(new Set(
    (session?.data.shopMemberships ?? [])
      .filter((membership) =>
        membership.status === 'active'
        && membership.shop?.status === 'active'
        && ['owner', 'manager'].includes(membership.membershipRole || '')
      )
      .map((membership) => membership.shop?.id)
      .filter((shopId): shopId is string => Boolean(shopId))
  )).sort()
}

export function shopRelationshipFilter(session?: Session, relationship = 'shop') {
  const shopIds = activeShopIds(session)
  return shopIds.length > 0 ? { [relationship]: { id: { in: shopIds } } } : false
}

export function assertActiveShopAccess(session: Session | undefined, shopId: string) {
  if (!session) throw new Error('A signed-in dashboard user is required.')
  if (!activeShopIds(session).includes(shopId)) {
    throw new Error('Not authorized to access this shop.')
  }
}

export function requireSingleActiveShop(session: Session | undefined) {
  const shopIds = activeShopIds(session)
  if (shopIds.length !== 1) {
    throw new Error('Select exactly one active shop before performing this operation.')
  }
  return shopIds[0]
}

type RolePermission = keyof Session['data']['role'];
type MembershipRole = 'owner' | 'manager' | 'front_desk' | 'barber' | 'viewer';

/**
 * Tenant membership role bounds which global role permissions apply inside a
 * shop. A global grant held for one shop never carries into another shop where
 * the user is only a viewer or barber. Permissions not listed for owner
 * (people/roles administration) are global, not shop-scoped.
 */
export const MEMBERSHIP_ROLE_CAPABILITIES: Record<MembershipRole, readonly RolePermission[]> = {
  owner: ['canAccessDashboard', 'canManageOnboarding', 'canManageServices', 'canManageStaff', 'canManageSchedules', 'canManageAppointments', 'canManageQueue', 'canManageCustomers', 'canManageCustomerNotes', 'canManageMemberships', 'canManagePayments', 'canViewReports'],
  manager: ['canAccessDashboard', 'canManageOnboarding', 'canManageServices', 'canManageStaff', 'canManageSchedules', 'canManageAppointments', 'canManageQueue', 'canManageCustomers', 'canManageCustomerNotes', 'canManageMemberships', 'canManagePayments', 'canViewReports'],
  front_desk: ['canAccessDashboard', 'canManageAppointments', 'canManageQueue', 'canManageCustomers', 'canManageCustomerNotes', 'canManageMemberships', 'canManagePayments'],
  barber: ['canAccessDashboard', 'canManageAppointments', 'canManageQueue', 'canManageCustomers', 'canManageCustomerNotes'],
  viewer: ['canAccessDashboard', 'canViewReports'],
};

const SHOP_SCOPED_PERMISSIONS = new Set<string>(MEMBERSHIP_ROLE_CAPABILITIES.owner);

export function membershipRoleAllows(membershipRole: string | null | undefined, permission: string) {
  if (!SHOP_SCOPED_PERMISSIONS.has(permission)) return true;
  const capabilities = MEMBERSHIP_ROLE_CAPABILITIES[(membershipRole || 'viewer') as MembershipRole] as readonly string[] | undefined;
  return Boolean(capabilities?.includes(permission));
}

/** Role of the caller's membership in the single selected active shop. */
export function activeMembershipRole(session?: Session) {
  const [shopId] = activeShopIds(session);
  if (!shopId) return null;
  return (session?.data.shopMemberships ?? []).find((membership) =>
    membership.status === 'active' && membership.shop?.id === shopId && membership.shop?.status === 'active'
  )?.membershipRole ?? null;
}

/** Global role flag, narrowed by the tenant role when a shop is selected. */
function shopPermission(permission: RolePermission) {
  return ({ session }: AccessArgs) => {
    if (!session?.data.role?.[permission]) return false;
    if (!activeShopIds(session).length) return true;
    return membershipRoleAllows(activeMembershipRole(session), permission);
  };
}

const canAccessDashboard = ({ session }: AccessArgs) => session?.data.role?.canAccessDashboard ?? false;

export const permissions = {
  canAccessDashboard,
  canManageShops: ({ session }: AccessArgs) => managedShopIds(session).length > 0,
  canManageOnboarding: ({ session }: AccessArgs) => session?.data.role?.canManageOnboarding ?? false,
  canManagePeople: ({ session }: AccessArgs) => session?.data.role?.canManagePeople ?? false,
  canManageRoles: ({ session }: AccessArgs) => session?.data.role?.canManageRoles ?? false,
  canReadServices: shopPermission('canManageServices'),
  canManageServices: shopPermission('canManageServices'),
  canReadStaff: shopPermission('canManageStaff'),
  canManageStaff: shopPermission('canManageStaff'),
  canReadSchedules: shopPermission('canManageSchedules'),
  canManageSchedules: shopPermission('canManageSchedules'),
  canReadAppointments: shopPermission('canManageAppointments'),
  canManageAppointments: shopPermission('canManageAppointments'),
  canReadQueue: shopPermission('canManageQueue'),
  canManageQueue: shopPermission('canManageQueue'),
  canReadCustomers: shopPermission('canManageCustomers'),
  canManageCustomers: shopPermission('canManageCustomers'),
  canReadCustomerNotes: shopPermission('canManageCustomerNotes'),
  canManageCustomerNotes: shopPermission('canManageCustomerNotes'),
  canReadMemberships: shopPermission('canManageMemberships'),
  canManageMemberships: shopPermission('canManageMemberships'),
  canReadPayments: shopPermission('canManagePayments'),
  canManagePayments: shopPermission('canManagePayments'),
  canViewReports: shopPermission('canViewReports'),
}

export const rules = {
  canReadCustomerNotes: async ({ session, context }: AccessArgs) => {
    const shopIds = activeShopIds(session);
    if (!session?.itemId || !shopIds.length || !context) return false;
    const prisma = context.prisma as CustomerNoteAccessPrisma;
    const [user, memberships] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.itemId },
        select: { role: { select: { canManageCustomerNotes: true } } },
      }),
      prisma.shopMembership.findMany({
        where: { userId: session.itemId, shopId: { in: shopIds }, status: 'active', shop: { status: 'active' } },
        select: { shopId: true, membershipRole: true },
      }),
    ]);
    if (!user?.role?.canManageCustomerNotes) return false;
    const currentShopIds = Array.from(new Set(memberships.filter((membership) => membershipRoleAllows(membership.membershipRole, 'canManageCustomerNotes')).map((membership) => membership.shopId))).sort();
    if (!currentShopIds.length) return false;
    const ownerShopIds = memberships.filter((membership) => membership.membershipRole === 'owner').map((membership) => membership.shopId);
    const visibilityFilter = ownerShopIds.length
      ? { OR: [{ visibility: { equals: 'staff' } }, { shop: { id: { in: ownerShopIds } } }] }
      : { visibility: { equals: 'staff' } };
    return { AND: [{ shop: { id: { in: currentShopIds } } }, visibilityFilter] };
  },
  canAccessBarberShopRecords: ({ session }: AccessArgs) => {
    const shopIds = activeShopIds(session);
    return shopIds.length ? { barber: { shop: { id: { in: shopIds } } } } : false;
  },
  canAccessPackageShopRecords: ({ session }: AccessArgs) => {
    const shopIds = activeShopIds(session);
    return shopIds.length ? { package: { shop: { id: { in: shopIds } } } } : false;
  },
  canAccessShopRecords: ({ session }: AccessArgs) => shopRelationshipFilter(session),
  canAccessTransactionShopRecords: ({ session }: AccessArgs) => {
    const shopIds = activeShopIds(session)
    return shopIds.length > 0 ? { transaction: { shop: { id: { in: shopIds } } } } : false
  },
  canAccessCustomerPackageShopRecords: ({ session }: AccessArgs) => {
    const shopIds = activeShopIds(session)
    return shopIds.length > 0 ? { customerPackage: { shop: { id: { in: shopIds } } } } : false
  },
  canReadShops: ({ session }: AccessArgs) => {
    const shopIds = membershipShopIds(session)
    return shopIds.length > 0 ? { id: { in: shopIds } } : false
  },
  canManageShops: ({ session }: AccessArgs) => {
    const shopIds = managedShopIds(session)
    return shopIds.length > 0 ? { id: { in: shopIds } } : false
  },
  canReadPublishedServices: ({ session }: AccessArgs) => {
    if (session?.data.role?.canAccessDashboard) return true
    return { status: { equals: 'active' } }
  },
  canReadPublishedServiceCategories: ({ session }: AccessArgs) => {
    if (session?.data.role?.canAccessDashboard) return true
    return { status: { equals: 'active' } }
  },
  canReadPublishedStaff: ({ session }: AccessArgs) => {
    if (session?.data.role?.canAccessDashboard) return true
    return {
      status: { equals: 'active' },
      bookingEnabled: { equals: true },
    }
  },
}