import type { PrismaClient } from '@prisma/client';

import { shopDayRange, shopDateKey } from '../../shared/shop-time';
import { dayKeyForDate } from '../utils/availability';
import { triggerReminderSweep } from '../utils/appointmentReminders';
import { permissions, type Session } from '../access';
// Explicitly authorized aggregate projections use the request's canonical client.
// Cross-governed capabilities are checked below before any related-record read.
import { currentManagedShopIds, currentShopForPermission, hasCurrentOwnerMembership, requireCurrentShopPermission } from '../utils/currentAuthorization';
import { assertUsdSettlementCurrency } from '../utils/supportedSettlementCurrency';
import { countProjectedServices, uncategorizedServiceWhere } from '../utils/serviceCatalogProjection';
import { getBookingEligibilityProjection } from '../utils/bookingPolicy';
import { bookingEligibilityFromSnapshot } from '../../shared/public-booking-eligibility';
import { paymentProviderSettlement } from '../utils/paymentProviderAdapter';

type QueryListApi = {
  findMany(args: { where: Record<string, unknown>; orderBy?: Array<Record<string, 'asc' | 'desc'>>; take?: number; query: string }): Promise<Array<Record<string, unknown>>>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
};

// Trusted Keystone resolver context; `prisma` is its canonical client. Separately
// governed Lists (notes, commissions) are read through the session-bound Query API
// so their own List filter, field and nested relationship access apply.
type Context = {
  session?: Session;
  prisma: PrismaClient;
  query: { Customer: { count(args: { where: Record<string, unknown> }): Promise<number>; findMany(args: Record<string, unknown>): Promise<Array<{ id: string; firstName: string; lastName: string | null; phone: string; email: string | null; status: string | null; preferredContactMethod: string | null; acceptsMarketing: boolean; lastVisitAt: string | null; preferredBarber: { id: string } | null }>> }; WaiverForm: QueryListApi; CustomerNote: QueryListApi; Commission: QueryListApi; Appointment: QueryListApi; CheckoutTransaction: QueryListApi; CustomerPackage: QueryListApi; MembershipPlan: QueryListApi; ServicePackage: QueryListApi; Barber: QueryListApi; GroomingNote: QueryListApi };
};

const GROOMING_NOTE_LIMIT = 10;

type OperationsGroomingNotesContext = { session?: Session; prisma: PrismaClient; query: { GroomingNote: QueryListApi } };

/**
 * Grooming notes are customer-note governed (GroomingNote query = canReadCustomerNotes);
 * payment scope does not imply note capability. Fresh, durable, same-shop note authority
 * is established BEFORE any GroomingNote read; the restricted branch issues no note query.
 * Nested customer/barber attribution is selected only with its own fresh same-shop
 * customer/staff authority. Granted reads use the session-bound Query API, so List
 * filter and nested relationship access still apply (hidden items stay null) and
 * genuine query errors propagate.
 */
export async function loadOperationsGroomingNotes(context: OperationsGroomingNotesContext, shopId: string) {
  const access = async (permission: 'canManageCustomerNotes' | 'canManageCustomers' | 'canManageStaff'): Promise<RelationAccess> =>
    (await currentShopForPermission(context.session, permission, context.prisma)) === shopId ? 'granted' : 'restricted';
  const notesAccess = await access('canManageCustomerNotes');
  if (notesAccess === 'restricted') {
    return { notesAccess, notesCustomerAccess: 'restricted' as RelationAccess, notesStaffAccess: 'restricted' as RelationAccess, notes: null };
  }
  const [notesCustomerAccess, notesStaffAccess] = await Promise.all([access('canManageCustomers'), access('canManageStaff')]);
  const rows = await context.query.GroomingNote.findMany({
    where: { shop: { id: { equals: shopId } } },
    orderBy: [{ createdAt: 'desc' }], take: GROOMING_NOTE_LIMIT,
    query: `id title noteType privateToStaff${notesCustomerAccess === 'granted' ? ' customer { id firstName lastName }' : ''}${notesStaffAccess === 'granted' ? ' barber { id displayName }' : ''}`,
  });
  const notes = rows.map((item) => {
    const customer = notesCustomerAccess === 'granted' ? item.customer as { id: string; firstName?: string | null; lastName?: string | null } | null | undefined : null;
    const barber = notesStaffAccess === 'granted' ? item.barber as { id: string; displayName?: string | null } | null | undefined : null;
    const customerName = customer ? [customer.firstName, customer.lastName].filter(Boolean).join(' ') : '';
    // Hidden or empty values stay null; no placeholder is fabricated server-side.
    return {
      id: String(item.id),
      title: (item.title as string | null | undefined) ?? null,
      noteType: (item.noteType as string | null | undefined) ?? null,
      privateToStaff: (item.privateToStaff as boolean | null | undefined) ?? null,
      customer: customer ? { id: customer.id, name: customerName || null } : null,
      barber: barber ? { id: barber.id, name: barber.displayName ?? null } : null,
    };
  });
  return { notesAccess, notesCustomerAccess, notesStaffAccess, notes };
}

const PREFERRED_BARBER_LIMIT = 50;

type PreferredBarberContext = { session?: Session; prisma: PrismaClient; query: { Barber: QueryListApi } };

/**
 * A customer's preferred barber is a Barber record (staff-read governed). Fresh,
 * durable, same-shop staff authority is established BEFORE any Barber read; the
 * restricted branch performs no Barber query. Granted reads use the session-bound
 * Query API (Barber List access still applies) and real query errors propagate.
 */
export async function loadPreferredBarbers(context: PreferredBarberContext, shopId: string, preferredBarberIds: Array<string | null | undefined>) {
  const staffAccess: RelationAccess = (await currentShopForPermission(context.session, 'canManageStaff', context.prisma)) === shopId ? 'granted' : 'restricted';
  const barberIds = [...new Set(preferredBarberIds.filter((id): id is string => typeof id === 'string' && id.length > 0))].slice(0, PREFERRED_BARBER_LIMIT);
  const barbers = staffAccess === 'granted' && barberIds.length
    ? await context.query.Barber.findMany({
        where: { shop: { id: { equals: shopId } }, id: { in: barberIds } },
        take: barberIds.length, query: 'id displayName chairNumber',
      })
    : [];
  const barbersById = new Map(barbers.map((barber) => [String(barber.id), barber]));
  return { staffAccess, barbersById };
}

const CUSTOMER_NOTE_SELECTION = 'id noteType body visibility createdAt appointment { id startsAt serviceTitleSnapshot }';
const COMMISSION_LIMIT = 2000;
const MEMBERSHIP_PLAN_LIMIT = 100;

type RelationAccess = 'granted' | 'restricted';
type ProtectedCustomerRelationsContext = {
  session?: Session;
  prisma: PrismaClient;
  query: { Appointment: QueryListApi; CheckoutTransaction: QueryListApi; CustomerPackage: QueryListApi; MembershipPlan: QueryListApi; ServicePackage: QueryListApi };
};

async function sameShopAccess(context: ProtectedCustomerRelationsContext, permission: 'canManageAppointments' | 'canManagePayments' | 'canManageMemberships', shopId: string): Promise<RelationAccess> {
  return (await currentShopForPermission(context.session, permission, context.prisma)) === shopId ? 'granted' : 'restricted';
}

/**
 * Customer relations governed by other Lists (appointments, payments, memberships).
 * Each branch first establishes fresh, durable, same-shop authority; a restricted
 * branch issues NO read of that List and yields explicit nulls. Granted branches use
 * the session-bound Query API, so List filters, field access and nested relationship
 * access still apply (hidden nested items resolve to null, never fabricated values).
 */
export async function loadProtectedCustomerRelations(context: ProtectedCustomerRelationsContext, shopId: string, customerIds: string[], options: { planSearch?: string | null } = {}) {
  const planSearch = options.planSearch?.trim().slice(0, 120) || '';
  const [appointmentsAccess, paymentsAccess, membershipsAccess] = await Promise.all([
    sameShopAccess(context, 'canManageAppointments', shopId),
    sameShopAccess(context, 'canManagePayments', shopId),
    sameShopAccess(context, 'canManageMemberships', shopId),
  ]);
  const shopFilter = { shop: { id: { equals: shopId } } };
  // The nested payment record is selected only with payment authority.
  // Accepted service/barber snapshots are the visit identity; live relations may have been renamed.
  const appointmentSelection = `id startsAt status paymentStatus price durationMinutes serviceTitleSnapshot barberNameSnapshot${paymentsAccess === 'granted' ? ' transaction { id total paymentMethod completedAt }' : ''}`;

  const [appointmentsByCustomer, transactionsByCustomer, membershipReads] = await Promise.all([
    appointmentsAccess === 'granted'
      ? Promise.all(customerIds.map((customerId) => context.query.Appointment.findMany({
          where: { ...shopFilter, customer: { id: { equals: customerId } } },
          orderBy: [{ startsAt: 'desc' }, { id: 'desc' }], take: 5, query: appointmentSelection,
        })))
      : Promise.resolve(customerIds.map(() => null)),
    paymentsAccess === 'granted'
      ? Promise.all(customerIds.map((customerId) => context.query.CheckoutTransaction.findMany({
          where: { ...shopFilter, customer: { id: { equals: customerId } } },
          orderBy: [{ completedAt: 'desc' }, { id: 'desc' }], take: 5, query: 'id status total paymentMethod completedAt',
        })))
      : Promise.resolve(customerIds.map(() => null)),
    membershipsAccess === 'granted'
      ? Promise.all([
          Promise.all(customerIds.map((customerId) => context.query.CustomerPackage.findMany({
            // Expired/used-up balances stay visible so their original record can be renewed.
            where: { ...shopFilter, customer: { id: { equals: customerId } }, status: { in: ['active', 'paused', 'expired', 'used_up'] } },
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: 5,
            query: 'id remainingVisits status expiresAt nextBillingAt autoRenew servicePackage { id name } membershipPlan { id name billingInterval price includedVisits }',
          }))),
          context.query.MembershipPlan.findMany({
            where: { ...shopFilter, status: { equals: 'active' }, ...(planSearch ? { name: { contains: planSearch, mode: 'insensitive' } } : {}) },
            orderBy: [{ name: 'asc' }, { id: 'asc' }], take: MEMBERSHIP_PLAN_LIMIT + 1, query: 'id name price includedVisits billingInterval',
          }),
          context.query.CustomerPackage.count({ where: { ...shopFilter, status: { equals: 'active' } } }),
          context.query.ServicePackage.findMany({
            where: { ...shopFilter, status: { equals: 'active' }, ...(planSearch ? { name: { contains: planSearch, mode: 'insensitive' } } : {}) },
            orderBy: [{ name: 'asc' }, { id: 'asc' }], take: MEMBERSHIP_PLAN_LIMIT + 1, query: 'id name price items { quantity }',
          }),
        ])
      : Promise.resolve(null),
  ]);

  const [balancesByCustomer, planRows, packageHolders, packageRows] = membershipReads ?? [customerIds.map(() => null), null, null, null];
  const servicePackages = packageRows ? packageRows.slice(0, MEMBERSHIP_PLAN_LIMIT).map((row) => ({
    id: String(row.id), name: String(row.name ?? ''), price: Number(row.price) || 0,
    visits: ((row.items as Array<{ quantity?: number | null }> | null) || []).reduce((sum, item) => sum + (item.quantity || 0), 0),
  })) : null;
  const servicePackagesTruncated = Boolean(packageRows && packageRows.length > MEMBERSHIP_PLAN_LIMIT);
  // The plan cap is disclosed: a truncated list is flagged, never presented as complete.
  const membershipPlansTruncated = Boolean(planRows && planRows.length > MEMBERSHIP_PLAN_LIMIT);
  const membershipPlans = planRows ? planRows.slice(0, MEMBERSHIP_PLAN_LIMIT) : null;

  return {
    access: { appointments: appointmentsAccess, payments: paymentsAccess, memberships: membershipsAccess },
    appointmentsByCustomer,
    transactionsByCustomer,
    balancesByCustomer,
    membershipPlans,
    membershipPlansTruncated,
    servicePackages,
    servicePackagesTruncated,
    packageHolders,
  };
}

async function scope(context: Context, permission: Parameters<typeof requireCurrentShopPermission>[1], message: string) {
  if (!permissions.canAccessDashboard({ session: context.session })) throw new Error(message);
  try {
    const shopId = await requireCurrentShopPermission(context.session, permission, context.prisma);
    // A workflow grant does not silently confer separately governed reads. A
    // restricted actor gets a clear authorization state, never a partial total.
    // Only relations every row of the primary workflow reads are required here.
    // Separately governed optional sections (memberships, commissions, payments)
    // are authorized inside each projection and returned as restricted/null.
    const dependencies: Partial<Record<typeof permission, Array<typeof permission>>> = {
      canManageAppointments: ['canManageCustomers', 'canManageStaff', 'canManageServices'],
      canManageQueue: ['canManageCustomers', 'canManageStaff', 'canManageServices', 'canManageAppointments'],
      canViewReports: ['canManageAppointments', 'canManagePayments', 'canManageQueue', 'canManageSchedules', 'canManageStaff', 'canManageMemberships'],
      canManageSchedules: ['canManageStaff'],
    };
    for (const required of dependencies[permission] || []) await requireCurrentShopPermission(context.session, required, context.prisma);
    return shopId;
  }
  catch (error) {
    if (error instanceof Error && /revoked|changed|active shop/i.test(error.message)) throw error;
    throw new Error(message);
  }
}

async function shopTimeZone(prisma: PrismaClient, shopId: string) {
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { timezone: true } });
  return shop?.timezone || 'UTC';
}

const BOOKING_PAGE_SIZE = 100;
const BOOKING_STATUSES = ['requested', 'confirmed', 'checked_in', 'in_chair', 'completed', 'cancelled', 'no_show'];

export async function getBookingProjection(_root: unknown, args: { date?: string | null; status?: string | null; page?: number | null }, context: Context) {
  const shopId = await scope(context, 'canManageAppointments', 'Not authorized to access booking operations.');
  triggerReminderSweep(context.prisma);
  const shop = await context.prisma.shop.findUnique({ where: { id: shopId }, select: { timezone: true } });
  if (!shop?.timezone) throw new Error('Shop timezone is not configured. Set it in Store Settings.');
  const timeZone = shop.timezone;
  const { start, end } = shopDayRange(args.date && /^\d{4}-\d{2}-\d{2}$/.test(args.date) ? args.date : new Date(), timeZone);
  const status = args.status && BOOKING_STATUSES.includes(args.status) ? args.status : null;
  const page = Math.max(1, Math.floor(Number(args.page) || 1));
  const dayWhere = { shopId, startsAt: { gte: start, lt: end } };
  const listWhere = { ...dayWhere, ...(status ? { status: status as 'requested' } : {}) };
  const [appointments, matching, grouped, bookedValue, barbers, services] = await Promise.all([
    context.prisma.appointment.findMany({
      where: listWhere, orderBy: [{ startsAt: 'asc' }, { id: 'asc' }], skip: (page - 1) * BOOKING_PAGE_SIZE, take: BOOKING_PAGE_SIZE,
      select: {
        id: true, startsAt: true, endsAt: true, durationMinutes: true, status: true, source: true, paymentStatus: true,
        price: true, depositAmount: true, customerNotes: true, internalNotes: true, bookingPolicySnapshot: true,
        serviceTitleSnapshot: true, barberNameSnapshot: true, barberChairNumberSnapshot: true,
        customer: { select: { id: true, firstName: true, lastName: true, phone: true, status: true } },
        barber: { select: { id: true, displayName: true, chairNumber: true } },
        service: { select: { id: true, name: true, durationMinutes: true, price: true, color: true } },
        noShowEvents: { orderBy: { markedAt: 'desc' }, take: 1, select: { id: true, feeAmount: true, feeWaived: true, markedAt: true } },
      },
    }),
    context.prisma.appointment.count({ where: listWhere }),
    context.prisma.appointment.groupBy({ by: ['status'], where: dayWhere, _count: true }),
    context.prisma.appointment.aggregate({ where: { ...dayWhere, status: { notIn: ['cancelled', 'no_show'] } }, _sum: { price: true } }),
    context.prisma.barber.findMany({ where: { shopId, status: 'active' }, orderBy: [{ displayName: 'asc' }, { id: 'asc' }], select: {
      id: true, displayName: true, chairNumber: true, bookingEnabled: true,
      schedules: { where: { dayOfWeek: dayKeyForDate(shopDateKey(start, timeZone), timeZone) as 'monday', isWorking: true }, select: { startMinute: true, endMinute: true } },
      scheduleExceptions: { where: { status: 'active', exceptionType: 'time_off', startsAt: { lt: end }, endsAt: { gt: start } }, select: { id: true } },
    } }),
    context.prisma.service.findMany({ where: { shopId, status: 'active' }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true, durationMinutes: true, price: true, depositRequired: true, specialists: { select: { id: true } } } }),
  ]);
  // On the floor that day: weekly hours for the weekday, no time off.
  const dayBarbers = barbers.map(({ schedules, scheduleExceptions, ...barber }) => ({
    ...barber,
    workingDay: schedules.length > 0 && scheduleExceptions.length === 0,
    dayStartMinute: schedules[0]?.startMinute ?? null,
    dayEndMinute: schedules[0]?.endMinute ?? null,
  }));
  // Counts and metrics come from aggregates over the whole shop day, never from the displayed page.
  const counted = Object.fromEntries(grouped.map((item) => [String(item.status), item._count]));
  const statusCounts = Object.fromEntries(BOOKING_STATUSES.map((value) => [value, counted[value] || 0]));
  const total = BOOKING_STATUSES.reduce((sum, value) => sum + statusCounts[value], 0);
  return {
    timeZone, date: shopDateKey(start, timeZone), status, page, pageSize: BOOKING_PAGE_SIZE, matching,
    appointments: appointments.map(({ bookingPolicySnapshot, ...appointment }) => ({ ...appointment, bookingEligibility: bookingEligibilityFromSnapshot(bookingPolicySnapshot) })),
    barbers: dayBarbers,
    services: services.map(({ specialists, ...service }) => ({ ...service, specialistIds: specialists.map((item) => item.id) })),
    statusCounts,
    metrics: {
      scheduled: total,
      inShop: statusCounts.checked_in + statusCounts.in_chair,
      activeFlow: statusCounts.requested + statusCounts.confirmed + statusCounts.checked_in + statusCounts.in_chair,
      bookedValue: bookedValue._sum.price || 0,
    },
  };
}

const QUEUE_PAGE_SIZE = 100;

export async function getQueueProjection(_root: unknown, args: { search?: string | null; page?: number | null }, context: Context) {
  const shopId = await scope(context, 'canManageQueue', 'Not authorized to access queue operations.');
  const select = {
    id: true, customerName: true, phone: true, partySize: true, status: true, quotedWaitMinutes: true, checkedInAt: true, seatedAt: true, notes: true,
    requestedService: { select: { id: true, name: true, durationMinutes: true, price: true } },
    requestedBarber: { select: { id: true, displayName: true, chairNumber: true } },
    appointment: { select: { id: true, status: true, startsAt: true, serviceTitleSnapshot: true, barberNameSnapshot: true } },
    customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
  } as const;
  const search = args.search?.trim().slice(0, 120) || '';
  const page = Math.max(1, Math.floor(Number(args.page) || 1));
  // Day-end rule: walk-ins still waiting from an earlier shop day have left.
  const timeZone = await shopTimeZone(context.prisma, shopId);
  const { start: shopDayStart } = shopDayRange(new Date(), timeZone);
  await context.prisma.walkInQueueEntry.updateMany({ where: { shopId, status: { in: ['waiting', 'texted'] }, checkedInAt: { lt: shopDayStart } }, data: { status: 'left' } });
  const activeWhere = {
    shopId, status: { in: ['waiting', 'texted', 'in_chair'] as Array<'waiting' | 'texted' | 'in_chair'> },
    ...(search ? { OR: [{ customerName: { contains: search, mode: 'insensitive' as const } }, { phone: { contains: search } }] } : {}),
  };
  const [active, activeMatching, served, grouped, services, barbers] = await Promise.all([
    context.prisma.walkInQueueEntry.findMany({ where: activeWhere, orderBy: [{ checkedInAt: 'asc' }, { id: 'asc' }], skip: (page - 1) * QUEUE_PAGE_SIZE, take: QUEUE_PAGE_SIZE, select }),
    context.prisma.walkInQueueEntry.count({ where: activeWhere }),
    context.prisma.walkInQueueEntry.findMany({ where: { shopId, status: 'served' }, orderBy: [{ seatedAt: 'desc' }, { id: 'desc' }], take: 20, select }),
    context.prisma.walkInQueueEntry.groupBy({ by: ['status'], where: { shopId }, _count: true }),
    context.prisma.service.findMany({ where: { shopId, status: 'active' }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true, durationMinutes: true, price: true, specialists: { select: { id: true } } } }),
    context.prisma.barber.findMany({ where: { shopId, status: 'active', bookingEnabled: true }, orderBy: [{ displayName: 'asc' }, { id: 'asc' }], select: { id: true, displayName: true, chairNumber: true } }),
  ]);
  const counts = Object.fromEntries(grouped.map((item) => [String(item.status), item._count]));
  const activeTotal = (counts.waiting || 0) + (counts.texted || 0) + (counts.in_chair || 0);
  return {
    active, served, counts, activeTotal, activeMatching, search, page, pageSize: QUEUE_PAGE_SIZE, timeZone,
    hasMoreActive: page * QUEUE_PAGE_SIZE < activeMatching,
    services: services.map(({ specialists, ...service }) => ({ ...service, specialistIds: specialists.map((item) => item.id) })),
    barbers,
  };
}

const CUSTOMER_PAGE_SIZE = 25;
const CUSTOMER_HISTORY_PREVIEW = 5;

function pageNumber(value: unknown) {
  return Math.max(1, Math.floor(Number(value) || 1));
}

export async function getCustomersProjection(_root: unknown, args: { search?: string | null; page?: number | null; customerId?: string | null; planSearch?: string | null }, context: Context) {
  const shopId = await scope(context, 'canManageCustomers', 'Not authorized to access customer records.');
  const search = args.search?.trim().slice(0, 120) || '';
  const page = pageNumber(args.page);
  const isOwner = await hasCurrentOwnerMembership(context.session, shopId, context.prisma);
  const shopFilter = { shop: { id: { equals: shopId } } };
  const timeZone = await shopTimeZone(context.prisma, shopId);
  const customerSelection = 'id firstName lastName phone email status preferredContactMethod acceptsMarketing lastVisitAt preferredBarber { id }';
  const directoryWhere = { ...shopFilter, ...(search ? { OR: [
    { firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } },
    { phone: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } },
  ] } : {}) };
  const [pageCustomers, total, requested] = await Promise.all([
    context.query.Customer.findMany({
      where: directoryWhere,
      // Stable order: id breaks ties so paging never skips or repeats a customer.
      orderBy: [{ lastVisitAt: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }], take: CUSTOMER_PAGE_SIZE, skip: (page - 1) * CUSTOMER_PAGE_SIZE,
      query: customerSelection,
    }),
    context.query.Customer.count({ where: directoryWhere }),
    // An explicitly requested customer resolves under the same shop scope even when off-page.
    args.customerId ? context.query.Customer.findMany({ where: { ...shopFilter, id: { equals: args.customerId } }, take: 1, query: customerSelection }) : Promise.resolve([]),
  ]);
  const requestedCustomer = requested[0] && !pageCustomers.some((customer) => customer.id === requested[0].id) ? requested[0] : null;
  const customers = requestedCustomer ? [requestedCustomer, ...pageCustomers] : pageCustomers;
  const statuses = ['active', 'vip', 'needs_attention', 'blocked'];
  const [statusCounts, waiversByCustomer, relations, preferred] = await Promise.all([
    Promise.all(statuses.map(status => context.query.Customer.count({ where: { ...shopFilter, status: { equals: status } } }))),
    Promise.all(customers.map(customer => context.query.WaiverForm.findMany({ where: { ...shopFilter, customer: { id: { equals: customer.id } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: CUSTOMER_HISTORY_PREVIEW, query: 'id title waiverType status signedAt createdAt' }))),
    loadProtectedCustomerRelations(context, shopId, customers.map((customer) => customer.id), { planSearch: args.planSearch }),
    loadPreferredBarbers(context, shopId, customers.map((customer) => customer.preferredBarber?.id)),
  ]);
  // Customer management does not imply note capability. Fresh, same-shop note
  // authority is established BEFORE any note read; the restricted branch issues
  // no CustomerNote query and returns an explicit restricted DTO.
  const notesAccess: 'granted' | 'restricted' = (await currentShopForPermission(context.session, 'canManageCustomerNotes', context.prisma)) === shopId ? 'granted' : 'restricted';
  const noteVisibility = isOwner ? {} : { visibility: { equals: 'staff' } };
  const [notesByCustomer, notesCount] = notesAccess === 'granted'
    ? await Promise.all([
        Promise.all(customers.map((customer) => context.query.CustomerNote.findMany({
          where: { shop: { id: { equals: shopId } }, customer: { id: { equals: customer.id } }, ...noteVisibility },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: CUSTOMER_HISTORY_PREVIEW, query: CUSTOMER_NOTE_SELECTION,
        }))),
        context.query.CustomerNote.count({ where: { shop: { id: { equals: shopId } }, ...noteVisibility } }),
      ])
    : [customers.map(() => null), null];
  return {
    timeZone,
    page, pageSize: CUSTOMER_PAGE_SIZE, total,
    requestedCustomerId: requestedCustomer?.id ?? null,
    historyPreviewLimit: CUSTOMER_HISTORY_PREVIEW,
    customers: customers.map((customer, index) => {
      // preferredBarberId is always stripped; only the gated Barber projection is returned.
      const { preferredBarber, ...record } = customer;
      const preferredBarberId = preferredBarber?.id;
      const waivers = waiversByCustomer[index];
      return {
        ...record, waivers, notes: notesByCustomer[index],
        preferredBarber: preferred.staffAccess === 'granted' && preferredBarberId ? preferred.barbersById.get(preferredBarberId) ?? null : null,
        appointments: relations.appointmentsByCustomer[index],
        transactions: relations.transactionsByCustomer[index],
        packageBalances: relations.balancesByCustomer[index],
      };
    }),
    membershipPlans: relations.membershipPlans,
    membershipPlansTruncated: relations.membershipPlansTruncated,
    servicePackages: relations.servicePackages,
    servicePackagesTruncated: relations.servicePackagesTruncated,
    counts: Object.fromEntries(statuses.map((status, index) => [status, statusCounts[index]])),
    packageHolders: relations.packageHolders,
    notesCount, notesAccess,
    appointmentsAccess: relations.access.appointments,
    paymentsAccess: relations.access.payments,
    membershipsAccess: relations.access.memberships,
    staffAccess: preferred.staffAccess,
  };
}

const POS_PAGE_SIZE = 25;

type PosArgs = { appointmentId?: string | null; ticketPage?: number | null; ticketSearch?: string | null; salePage?: number | null; saleSearch?: string | null; receiptPage?: number | null; receiptId?: string | null };

export async function getPosProjection(_root: unknown, args: PosArgs, context: Context) {
  const shopId = await scope(context, 'canManagePayments', 'Not authorized to access POS settlement.');
  // Tickets display accepted service/barber snapshots, so live staff/service grants are not required.
  for (const permission of ['canManageAppointments', 'canManageCustomers', 'canManageMemberships'] as const) await requireCurrentShopPermission(context.session, permission, context.prisma);
  const shop = await context.prisma.shop.findUnique({ where: { id: shopId }, select: { currencyCode: true } });
  assertUsdSettlementCurrency(shop?.currencyCode);
  const timeZone = await shopTimeZone(context.prisma, shopId);
  const { start, end } = shopDayRange(new Date(), timeZone);
  const now = new Date();
  const ticketPage = pageNumber(args?.ticketPage), salePage = pageNumber(args?.salePage), receiptPage = pageNumber(args?.receiptPage);
  const ticketSearch = args?.ticketSearch?.trim().slice(0, 120) || '';
  const saleSearch = args?.saleSearch?.trim().slice(0, 120) || '';
  const receiptId = args?.receiptId?.trim().slice(0, 64) || '';
  // Completed visits were settled by checkout; only visits in the shop are open tickets.
  const openTicketWhere = { shopId, status: { in: ['checked_in', 'in_chair'] as Array<'checked_in' | 'in_chair'> }, paymentStatus: { notIn: ['paid', 'refunded'] as Array<'paid' | 'refunded'> } };
  const ticketWhere = { ...openTicketWhere, ...(ticketSearch ? { OR: [
    { customer: { firstName: { contains: ticketSearch, mode: 'insensitive' as const } } },
    { customer: { lastName: { contains: ticketSearch, mode: 'insensitive' as const } } },
    { customer: { phone: { contains: ticketSearch } } },
    { serviceTitleSnapshot: { contains: ticketSearch, mode: 'insensitive' as const } },
    { barberNameSnapshot: { contains: ticketSearch, mode: 'insensitive' as const } },
  ] } : {}) };
  // Only balances that can actually pay: visits remaining and not past expiry.
  // Redeemable now: active, visits left, already started and not yet expired.
  const usableBalances = { status: 'active' as const, remainingVisits: { gt: 0 }, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] };
  const ticketSelect = {
    id: true, startsAt: true, status: true, paymentStatus: true, price: true, depositAmount: true, serviceId: true,
    serviceTitleSnapshot: true, barberNameSnapshot: true, barberChairNumberSnapshot: true,
    customer: { select: { id: true, firstName: true, lastName: true, phone: true, packageBalances: { where: usableBalances, orderBy: [{ expiresAt: 'asc' as const }, { id: 'asc' as const }], select: { id: true, remainingVisits: true, expiresAt: true, servicePackage: { select: { id: true, name: true, items: { select: { serviceId: true } } } }, membershipPlan: { select: { id: true, name: true } } } } } },
  };
  const saleWhere = { shopId, lineType: 'sale' as const, ...(saleSearch ? { OR: [
    { productNameSnapshot: { contains: saleSearch, mode: 'insensitive' as const } },
    { skuSnapshot: { contains: saleSearch, mode: 'insensitive' as const } },
    { transactionId: saleSearch },
  ] } : {}) };
  const receiptWhere = { shopId, appointments: { some: {} }, status: { in: ['paid', 'refunded', 'partially_refunded'] as Array<'paid' | 'refunded' | 'partially_refunded'> }, ...(receiptId ? { id: receiptId } : {}) };
  const [appointments, ticketTotal, outstanding, packageHolders, requested, products, productLines, saleTotal, receipts, receiptTotal, paidToday] = await Promise.all([
    context.prisma.appointment.findMany({ where: ticketWhere, orderBy: [{ status: 'desc' }, { startsAt: 'desc' }, { id: 'asc' }], take: POS_PAGE_SIZE, skip: (ticketPage - 1) * POS_PAGE_SIZE, select: ticketSelect }),
    context.prisma.appointment.count({ where: ticketWhere }),
    context.prisma.appointment.aggregate({ where: openTicketWhere, _sum: { price: true } }),
    context.prisma.appointment.count({ where: { ...openTicketWhere, customer: { packageBalances: { some: usableBalances } } } }),
    // A handed-off appointment is resolved on its own, under this shop, regardless of page.
    args?.appointmentId ? context.prisma.appointment.findFirst({ where: { id: args.appointmentId, shopId }, select: ticketSelect }) : Promise.resolve(null),
    context.prisma.product.findMany({ where: { shopId, status: 'active' }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true, sku: true, price: true, inventoryLots: { where: { status: 'active' }, select: { quantityRemaining: true } } } }),
    context.prisma.productSaleLine.findMany({ where: saleWhere, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: POS_PAGE_SIZE, skip: (salePage - 1) * POS_PAGE_SIZE, select: { id: true, lineType: true, productNameSnapshot: true, skuSnapshot: true, quantity: true, unitPrice: true, subtotal: true, taxAmount: true, total: true, returnedQuantity: true, occurredAt: true, originalLineId: true, transactionId: true, transaction: { select: { paymentMethod: true } } } }),
    context.prisma.productSaleLine.count({ where: saleWhere }),
    context.prisma.checkoutTransaction.findMany({ where: receiptWhere, orderBy: [{ completedAt: 'desc' }, { id: 'desc' }], take: POS_PAGE_SIZE, skip: (receiptPage - 1) * POS_PAGE_SIZE, select: {
      id: true, status: true, subtotal: true, tipAmount: true, taxAmount: true, discountAmount: true, total: true, paymentMethod: true, paymentSessionId: true, currencyCode: true, completedAt: true,
      customer: { select: { id: true, firstName: true, lastName: true } },
      lineItems: { orderBy: { createdAt: 'asc' }, select: { id: true, title: true, price: true, durationMinutes: true, barberName: true, barberChairNumber: true, packageName: true, packageVisitsConsumed: true } },
      cashRefund: { select: { id: true, amount: true, reason: true, refundedAt: true } },
    } }),
    context.prisma.checkoutTransaction.count({ where: receiptWhere }),
    context.prisma.checkoutTransaction.count({ where: { shopId, status: 'paid', completedAt: { gte: start, lt: end } } }),
  ]);
  // Package balances qualify only when the plan is a membership or the package covers this service.
  const eligible = <T extends { serviceId: string | null; customer: { packageBalances: Array<{ servicePackage: { items: Array<{ serviceId: string | null }> } | null; membershipPlan: unknown }> } | null }>(ticket: T): T => ticket.customer ? {
    ...ticket,
    customer: { ...ticket.customer, packageBalances: ticket.customer.packageBalances.filter((balance) => Boolean(balance.membershipPlan) || Boolean(ticket.serviceId && balance.servicePackage?.items.some((item) => item.serviceId === ticket.serviceId))) },
  } : ticket;
  return {
    timeZone,
    appointments: appointments.map(eligible),
    requestedAppointment: requested ? eligible(requested) : null,
    requestedAppointmentId: args?.appointmentId || null,
    tickets: { page: ticketPage, pageSize: POS_PAGE_SIZE, total: ticketTotal, search: ticketSearch },
    products: products.map((product) => ({ ...product, availableQuantity: product.inventoryLots.reduce((sum, lot) => sum + (lot.quantityRemaining || 0), 0), inventoryLots: undefined })),
    productLines: productLines.map(({ transaction, ...line }) => ({ ...line, paymentMethod: transaction?.paymentMethod ?? null })),
    sales: { page: salePage, pageSize: POS_PAGE_SIZE, total: saleTotal, search: saleSearch },
    receipts,
    receiptPaging: { page: receiptPage, pageSize: POS_PAGE_SIZE, total: receiptTotal, receiptId },
    // Totals are computed over the full open-ticket scope, not the displayed page.
    metrics: { ready: await context.prisma.appointment.count({ where: openTicketWhere }), outstanding: outstanding._sum.price || 0, packageHolders, paidToday },
  };
}

const REPORT_MAX_DAYS = 366;
const REPORT_DEFAULT_DAYS = 30;

function reportRange(args: { startDate?: string | null; endDate?: string | null }, timeZone: string) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const today = shopDateKey(new Date(), timeZone);
  const endDate = args.endDate && datePattern.test(args.endDate) ? args.endDate : today;
  const defaultStart = new Date(`${endDate}T12:00:00Z`); defaultStart.setUTCDate(defaultStart.getUTCDate() - (REPORT_DEFAULT_DAYS - 1));
  const startDate = args.startDate && datePattern.test(args.startDate) ? args.startDate : defaultStart.toISOString().slice(0, 10);
  if ((args.startDate && !datePattern.test(args.startDate)) || (args.endDate && !datePattern.test(args.endDate))) throw new Error('Report dates must be shop-local calendar dates.');
  const days = Math.round((Date.parse(`${endDate}T12:00:00Z`) - Date.parse(`${startDate}T12:00:00Z`)) / 86400_000) + 1;
  if (!Number.isFinite(days) || days < 1) throw new Error('The report start date must be on or before the end date.');
  if (days > REPORT_MAX_DAYS) throw new Error(`Choose a report range of at most ${REPORT_MAX_DAYS} days.`);
  // Shop-local day boundaries (DST-aware), returned as the accepted UTC instants.
  return { start: shopDayRange(startDate, timeZone).start, end: shopDayRange(endDate, timeZone).end, startDate, endDate, days };
}

export async function getReportsProjection(_root: unknown, args: { startDate?: string | null; endDate?: string | null }, context: Context) {
  const shopId = await scope(context, 'canViewReports', 'Not authorized to access owner reports.');
  const shopRow = await context.prisma.shop.findUnique({ where: { id: shopId }, select: { timezone: true, currencyCode: true } });
  const timeZone = validTimeZone(shopRow?.timezone);
  if (!timeZone) throw new Error('The shop timezone is not set. Set it in Store Settings to view reports.');
  const { start, end, startDate, endDate, days } = reportRange(args || {}, timeZone);
  const [appointments, settledTransactions, queue, payouts, productLines, completedAppointments, schedules, blockingExceptions, membershipBalances, membershipEvents] = await Promise.all([
    context.prisma.appointment.groupBy({ by: ['status'], where: { shopId, startsAt: { gte: start, lt: end } }, _count: true }),
    context.prisma.checkoutTransaction.findMany({ take: 5001, where: { shopId, status: { in: ['paid', 'partially_refunded', 'refunded'] }, completedAt: { gte: start, lt: end } }, select: { id: true, status: true, subtotal: true, discountAmount: true, taxAmount: true, tipAmount: true, total: true, paymentSession: { select: { refundedAmount: true } }, cashRefund: { select: { amount: true, tipAmount: true, taxAmount: true } }, lineItems: { select: { title: true, barberName: true, price: true, durationMinutes: true, service: { select: { id: true } }, appointment: { select: { barberId: true } } } } } }),
    context.prisma.walkInQueueEntry.groupBy({ by: ['status'], where: { shopId, checkedInAt: { gte: start, lt: end } }, _count: true }),
    context.prisma.commissionPayout.aggregate({ where: { shopId, paidAt: { gte: start, lt: end } }, _sum: { totalAmount: true }, _count: true }),
    context.prisma.productSaleLine.findMany({ take: 5001, where: { shopId, occurredAt: { gte: start, lt: end } }, select: { lineType: true, total: true } }),
    // Completions count when the service finished, the same clock receipts use.
    context.prisma.appointment.findMany({ take: 5001, where: { shopId, status: 'completed', OR: [{ serviceCompletedAt: { gte: start, lt: end } }, { serviceCompletedAt: null, startsAt: { gte: start, lt: end } }] }, select: { durationMinutes: true, barber: { select: { displayName: true } } } }),
    context.prisma.barberSchedule.findMany({ take: 5001, where: { barber: { shopId, status: 'active' }, isWorking: true }, select: { startMinute: true, endMinute: true, breakStartMinute: true, breakEndMinute: true } }),
    context.prisma.scheduleException.findMany({ take: 5001, where: { shopId, status: 'active', exceptionType: { in: ['time_off', 'shop_closure', 'chair_unavailable'] }, startsAt: { lt: end }, endsAt: { gt: start } }, select: { startsAt: true, endsAt: true } }),
    context.prisma.customerPackage.findMany({ take: 5001, where: { shopId, status: { in: ['active', 'paused'] } }, select: { id: true, remainingVisits: true, membershipPlan: { select: { price: true, includedVisits: true } }, servicePackage: { select: { price: true, items: { select: { quantity: true } } } } } }),
    context.prisma.membershipEvent.findMany({ take: 5001, where: { shopId, eventType: { in: ['purchased', 'renewed'] } }, orderBy: { occurredAt: 'desc' }, select: { customerPackageId: true, amount: true, visitsDelta: true } }),
  ]);
  // Sentinel caps never produce falsely complete totals.
  for (const rows of [settledTransactions, productLines, completedAppointments, schedules, blockingExceptions, membershipBalances, membershipEvents]) {
    if (rows.length > 5000) throw new Error('Report range exceeds the supported record limit.');
  }
  const appointmentCounts: Record<string, number> = { ...Object.fromEntries(appointments.map((item) => [String(item.status), item._count])), completed: completedAppointments.length };
  const queueCounts = Object.fromEntries(queue.map((item) => [String(item.status), item._count]));
  const appointmentTotal = appointments.reduce((sum, item) => sum + item._count, 0);
  const queueClosed = (queueCounts.served || 0) + (queueCounts.left || 0);
  const serviceLines = settledTransactions.flatMap((transaction) => {
    const refundableServiceTotal = Math.max(0, (transaction.subtotal || 0) - (transaction.discountAmount || 0) - (transaction.paymentSession?.refundedAmount || 0) - Math.max(0, (transaction.cashRefund?.amount || 0) - (transaction.cashRefund?.tipAmount || 0) - (transaction.cashRefund?.taxAmount || 0)));
    const lineTotal = transaction.lineItems.reduce((sum, line) => sum + Math.max(0, line.price || 0), 0);
    return transaction.lineItems.map((line) => ({ ...line, netRevenue: lineTotal ? Math.round(refundableServiceTotal * Math.max(0, line.price || 0) / lineTotal) : 0 }));
  });
  // Group by the linked service/barber identity; names are labels only. Lines
  // without a linked record are kept separate and labelled, never merged by name.
  type PerformanceRow = { key: string; name: string; revenue: number; appointments: number; linked: boolean };
  const performance = (identity: (line: typeof serviceLines[number]) => { id: string | null; label: string }) => {
    const rows = Object.values(serviceLines.reduce<Record<string, PerformanceRow>>((result, line) => {
      const { id, label } = identity(line);
      const key = id ? `id:${id}` : `label:${label}`;
      const current = result[key] || { key, name: label, revenue: 0, appointments: 0, linked: Boolean(id) };
      current.revenue += line.netRevenue; current.appointments += 1; result[key] = current; return result;
    }, {})).sort((left, right) => right.revenue - left.revenue);
    const nameCounts = rows.reduce<Record<string, number>>((counts, row) => { counts[row.name] = (counts[row.name] || 0) + 1; return counts; }, {});
    return rows.map((row) => ({ ...row, duplicateName: nameCounts[row.name] > 1 }));
  };
  const servicePerformance = performance((line) => ({ id: line.service?.id || null, label: line.title || 'Service' }));
  const barberPerformance = performance((line) => ({ id: line.appointment?.barberId || null, label: line.barberName || 'Unassigned' }));
  const completedMinutes = completedAppointments.reduce((sum, item) => sum + (item.durationMinutes || 0), 0);
  const weeklyCapacityMinutes = schedules.reduce((sum, item) => {
    const breakMinutes = item.breakStartMinute != null && item.breakEndMinute != null ? Math.max(0, item.breakEndMinute - item.breakStartMinute) : 0;
    return sum + Math.max(0, (item.endMinute || 0) - (item.startMinute || 0) - breakMinutes);
  }, 0);
  const exceptionMinutes = blockingExceptions.reduce((sum, item) => sum + Math.max(0, (Math.min(end.getTime(), item.endsAt.getTime()) - Math.max(start.getTime(), item.startsAt.getTime())) / 60_000), 0);
  const capacityMinutes = Math.max(0, Math.round(weeklyCapacityMinutes * (days / 7) - exceptionMinutes));
  const latestMembershipGrant = new Map<string, { amount: number; visitsDelta: number }>();
  membershipEvents.forEach((event) => { if (event.customerPackageId && !latestMembershipGrant.has(event.customerPackageId)) latestMembershipGrant.set(event.customerPackageId, { amount: event.amount || 0, visitsDelta: event.visitsDelta || 0 }); });
  const membershipLiability = membershipBalances.reduce((sum, balance) => {
    const visits = Math.max(0, balance.remainingVisits || 0);
    if (balance.membershipPlan) {
      const snapshot = latestMembershipGrant.get(balance.id);
      return sum + Math.round((snapshot?.amount || 0) * visits / Math.max(1, snapshot?.visitsDelta || 1));
    }
    const packageVisits = balance.servicePackage?.items.reduce((total, item) => total + (item.quantity || 0), 0) || 1;
    return sum + Math.round((balance.servicePackage?.price || 0) * visits / packageVisits);
  }, 0);
  const netPaidTotal = settledTransactions.reduce((sum, transaction) => { const total = transaction.total || 0; return sum + (total < 0 ? total : Math.max(0, total - (transaction.paymentSession?.refundedAmount || 0) - (transaction.cashRefund?.amount || 0))); }, 0);
  const netTips = settledTransactions.reduce((sum, transaction) => sum + (transaction.status === 'refunded' ? 0 : transaction.tipAmount || 0), 0);
  return { range: { start, end, startDate, endDate, days, timeZone, currencyCode: shopRow?.currencyCode || 'USD' }, appointments: { total: appointmentTotal, ...appointmentCounts }, revenue: { paidTotal: netPaidTotal, tips: netTips, transactionCount: settledTransactions.length, productSales: productLines.reduce((sum, line) => sum + (line.total || 0), 0), productSaleCount: productLines.filter((line) => line.lineType === 'sale').length }, queue: queueCounts, payouts: { total: payouts._sum.totalAmount || 0, count: payouts._count }, rates: { completion: appointmentTotal ? Math.min(100, Math.round(((appointmentCounts.completed || 0) / appointmentTotal) * 100)) : 0, queueConversion: queueClosed ? Math.round(((queueCounts.served || 0) / queueClosed) * 100) : 0, utilization: capacityMinutes ? Math.round((completedMinutes / capacityMinutes) * 100) : 0 }, liabilities: { memberships: membershipLiability, activeBalances: membershipBalances.length }, servicePerformance, barberPerformance };
}

export async function getServicesProjection(_root: unknown, _args: unknown, context: Context) {
  const shopId = await scope(context, 'canManageServices', 'Not authorized to access service management.');
  // Packages and memberships are membership-governed; without that authority the
  // section is restricted (null), never an empty catalog.
  const membershipsAccess: RelationAccess = (await currentShopForPermission(context.session, 'canManageMemberships', context.prisma)) === shopId ? 'granted' : 'restricted';
  const [categories, uncategorizedServices, packages, memberships, products, bookingEligibility] = await Promise.all([
    context.prisma.serviceCategory.findMany({ where: { shopId }, orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }], select: { id: true, name: true, status: true, services: { where: { shopId }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true, status: true, durationMinutes: true, price: true, depositAmount: true } } } }),
    context.prisma.service.findMany({ where: uncategorizedServiceWhere(shopId), orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true, status: true, durationMinutes: true, price: true, depositAmount: true } }),
    membershipsAccess === 'granted' ? context.prisma.servicePackage.findMany({ where: { shopId }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true, status: true, price: true } }) : Promise.resolve(null),
    membershipsAccess === 'granted' ? context.prisma.membershipPlan.findMany({ where: { shopId }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true, status: true, price: true, includedVisits: true } }) : Promise.resolve(null),
    context.prisma.product.findMany({ where: { shopId }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true, sku: true, status: true, price: true } }),
    getBookingEligibilityProjection(context.prisma, shopId),
  ]);
  return { categories, uncategorizedServices, packages, memberships, membershipsAccess, products, bookingEligibility, metrics: { services: countProjectedServices(categories, uncategorizedServices), packages: packages?.length ?? null, memberships: memberships?.length ?? null, products: products.length } };
}

const STAFF_ROW_LIMIT = 10;

function validTimeZone(value: string | null | undefined) {
  if (!value) return null;
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date()); return value; }
  catch { return null; }
}

export async function getStaffProjection(_root: unknown, _args: unknown, context: Context) {
  const shopId = await scope(context, 'canManageSchedules', 'Not authorized to access staff operations.');
  const shop = await context.prisma.shop.findUnique({ where: { id: shopId }, select: { timezone: true } });
  // Without an authoritative shop timezone, time-changing forms are disabled (null), not UTC.
  const timeZone = validTimeZone(shop?.timezone);
  const now = new Date();
  // A clocked-in shift stays actionable after its scheduled end; scheduled shifts are upcoming only.
  const openShiftWhere = { OR: [{ status: 'clocked_in' as const }, { status: 'scheduled' as const, scheduledEnd: { gte: now } }] };
  const upcomingExceptionWhere = { endsAt: { gte: now }, status: 'active' as const };
  const shopWideExceptionWhere = { shopId, barberId: null, status: 'active' as const, endsAt: { gte: now } };
  const [barbers, shopWideExceptions, shopWideExceptionCount] = await Promise.all([context.prisma.barber.findMany({ where: { shopId }, orderBy: [{ displayName: 'asc' }, { id: 'asc' }], select: {
    id: true, displayName: true, status: true, bookingEnabled: true, chairNumber: true, serviceCommissionRateBps: true, userId: true,
    chair: { select: { id: true, chairNumber: true, stationName: true, status: true } }, specialties: { select: { id: true, name: true } }, schedules: { orderBy: [{ dayOfWeek: 'asc' }, { id: 'asc' }], select: { id: true, dayOfWeek: true, isWorking: true, startMinute: true, endMinute: true, breakStartMinute: true, breakEndMinute: true } },
    shifts: { where: openShiftWhere, orderBy: [{ scheduledStart: 'asc' }, { id: 'asc' }], take: STAFF_ROW_LIMIT, select: { id: true, status: true, scheduledStart: true, scheduledEnd: true, clockedInAt: true, chair: { select: { id: true, chairNumber: true } } } },
    scheduleExceptions: { where: upcomingExceptionWhere, orderBy: [{ startsAt: 'asc' }, { id: 'asc' }], take: STAFF_ROW_LIMIT, select: { id: true, exceptionType: true, status: true, startsAt: true, endsAt: true, reason: true } },
    _count: { select: { shifts: { where: openShiftWhere }, scheduleExceptions: { where: upcomingExceptionWhere } } },
  } }), context.prisma.scheduleException.findMany({ where: shopWideExceptionWhere, orderBy: [{ startsAt: 'asc' }, { id: 'asc' }], take: STAFF_ROW_LIMIT, select: { id: true, exceptionType: true, startsAt: true, endsAt: true, reason: true } }),
  context.prisma.scheduleException.count({ where: shopWideExceptionWhere })]);
  // Scheduling authority does not imply financial entitlement. Fresh, same-shop
  // payment authority gates the Commission read; totals are null (never a partial
  // or fabricated figure) when restricted, truncated or not attributable.
  const commissionAccess: 'granted' | 'restricted' = (await currentShopForPermission(context.session, 'canManagePayments', context.prisma)) === shopId ? 'granted' : 'restricted';
  const commissionRows = commissionAccess === 'granted'
    ? await context.query.Commission.findMany({
        where: { shop: { id: { equals: shopId } }, status: { in: ['projected', 'approved'] } },
        orderBy: [{ createdAt: 'desc' }], take: COMMISSION_LIMIT + 1, query: 'commissionAmount status barber { id }',
      })
    : [];
  const commissionTruncated = commissionRows.length > COMMISSION_LIMIT;
  // Account linking is owner/manager only (linkBarberAccount); others see no member list.
  const canLinkAccounts = (await currentManagedShopIds(context.session, context.prisma)).includes(shopId);
  const memberRows = canLinkAccounts
    ? await context.prisma.shopMembership.findMany({ where: { shopId, status: 'active' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 200, select: { user: { select: { id: true, name: true, email: true } } } })
    : [];
  const members = canLinkAccounts ? memberRows.flatMap((row) => (row.user ? [{ id: row.user.id, name: row.user.name || row.user.email || 'Member', email: row.user.email || null }] : [])) : null;
  const commissionTotalsAvailable = commissionAccess === 'granted' && !commissionTruncated;
  const commissionBarberId = (row: Record<string, unknown>) => (row.barber as { id?: unknown } | null | undefined)?.id;
  const commissionAttributable = commissionTotalsAvailable && commissionRows.every((row) => typeof commissionBarberId(row) === 'string');
  const commissionSum = (rows: Array<Record<string, unknown>>) => rows.reduce((sum, row) => sum + (Number(row.commissionAmount) || 0), 0);
  return {
    timeZone, commissionAccess, commissionTruncated, members,
    barbers: barbers.map(({ _count, userId, ...barber }) => ({
      ...barber,
      // The linked account id is shown only to those who may change it.
      linkedUserId: canLinkAccounts ? userId : undefined,
      accountLinked: Boolean(userId),
      openShiftCount: _count.shifts,
      upcomingExceptionCount: _count.scheduleExceptions,
      projectedCommission: commissionAttributable ? commissionSum(commissionRows.filter((row) => commissionBarberId(row) === barber.id)) : null,
    })),
    shopWideExceptions, shopWideExceptionCount,
    metrics: { total: barbers.length, bookable: barbers.filter((item) => item.bookingEnabled && item.status === 'active').length, workingDays: barbers.reduce((sum, item) => sum + item.schedules.filter((schedule) => schedule.isWorking).length, 0), projectedCommission: commissionTotalsAvailable ? commissionSum(commissionRows) : null, openShifts: barbers.reduce((sum, item) => sum + item._count.shifts, 0), upcomingExceptions: barbers.reduce((sum, item) => sum + item._count.scheduleExceptions, 0) + shopWideExceptionCount },
  };
}

const OPERATIONS_ROW_LIMIT = 20;
const SUPPLIER_OPTION_LIMIT = 200;

export async function getOperationsProjection(_root: unknown, _args: unknown, context: Context) {
  const shopId = await scope(context, 'canManagePayments', 'Not authorized to access owner operations.');
  // Each section is gated by its own current same-shop authority BEFORE it is read;
  // a restricted section is null (shown as restricted), never an empty list.
  const sectionAccess = async (permission: 'canManageStaff' | 'canManageServices' | 'canManageQueue' | 'canManageCustomers' | 'canManageAppointments'): Promise<RelationAccess> =>
    (await currentShopForPermission(context.session, permission, context.prisma)) === shopId ? 'granted' : 'restricted';
  const [staffAccess, inventoryAccess, queueAccess, customersAccess, policiesAccess] = await Promise.all([
    sectionAccess('canManageStaff'), sectionAccess('canManageServices'), sectionAccess('canManageQueue'), sectionAccess('canManageCustomers'), sectionAccess('canManageAppointments'),
  ]);
  const when = <T,>(access: RelationAccess, read: () => Promise<T>) => (access === 'granted' ? read() : Promise.resolve(null));
  const actionableCommission = { shopId, status: { in: ['projected', 'approved'] as Array<'projected' | 'approved'> } };
  const actionableWaitlist = { shopId, status: { in: ['waiting', 'notified'] as Array<'waiting' | 'notified'> } };
  const openPaymentSession = { shopId, status: { in: ['pending', 'authorized', 'captured', 'partially_refunded'] as Array<'pending' | 'authorized' | 'captured' | 'partially_refunded'> } };
  const [shop, chairs, lots, suppliers, products, activeServices, activeBarbers, commissions, payouts, tips, policies, waitlist, groomingNotes, waivers, paymentSessions, reconciliations] = await Promise.all([
    context.prisma.shop.findUniqueOrThrow({ where: { id: shopId }, select: { id: true, name: true, slug: true, timezone: true, currencyCode: true } }),
    when(staffAccess, () => context.prisma.barberChair.findMany({ where: { shopId }, orderBy: [{ chairNumber: 'asc' }, { id: 'asc' }], take: OPERATIONS_ROW_LIMIT, select: { id: true, chairNumber: true, stationName: true, status: true, assignedBarbers: { select: { id: true, displayName: true } } } })),
    when(inventoryAccess, () => context.prisma.inventoryLot.findMany({ where: { shopId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: OPERATIONS_ROW_LIMIT, select: { id: true, lotNumber: true, quantityReceived: true, quantityRemaining: true, unitCost: true, receivedAt: true, expiresAt: true, status: true, product: { select: { id: true, name: true } }, supplier: { select: { id: true, name: true } } } })),
    when(inventoryAccess, () => context.prisma.supplier.findMany({ where: { shopId }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: SUPPLIER_OPTION_LIMIT, select: { id: true, name: true, status: true, contactName: true, email: true, phone: true } })),
    when(inventoryAccess, () => context.prisma.product.findMany({ where: { shopId, status: 'active', inventoryTracked: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true, sku: true, cost: true, inventoryLots: { where: { status: 'active' }, select: { quantityRemaining: true } } } })),
    when(queueAccess, () => context.prisma.service.findMany({ where: { shopId, status: 'active' }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true } })),
    when(queueAccess, () => context.prisma.barber.findMany({ where: { shopId, status: 'active' }, orderBy: [{ displayName: 'asc' }, { id: 'asc' }], select: { id: true, displayName: true } })),
    // Unresolved commissions first, oldest first, so older approved work is never starved by newer rows.
    context.prisma.commission.findMany({ where: actionableCommission, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: OPERATIONS_ROW_LIMIT, select: { id: true, commissionNumber: true, status: true, commissionAmount: true, commissionRate: true, createdAt: true, barber: { select: { id: true, displayName: true } }, appointment: { select: { startsAt: true, serviceTitleSnapshot: true } }, transaction: { select: { completedAt: true } } } }),
    context.prisma.commissionPayout.findMany({ where: { shopId }, orderBy: [{ paidAt: 'desc' }, { id: 'desc' }], take: OPERATIONS_ROW_LIMIT, select: { id: true, payoutNumber: true, status: true, commissionCount: true, totalAmount: true, paidAt: true, notes: true, barber: { select: { id: true, displayName: true } } } }),
    context.prisma.tip.findMany({ where: { shopId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: OPERATIONS_ROW_LIMIT, select: { id: true, tipNumber: true, amount: true, paymentMethod: true, createdAt: true, barber: { select: { id: true, displayName: true } }, customer: { select: { id: true, firstName: true, lastName: true } } } }),
    when(policiesAccess, () => context.prisma.noShowPolicy.findMany({ where: { shopId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: OPERATIONS_ROW_LIMIT, select: { id: true, name: true, status: true, feeAmount: true, graceMinutes: true, appliesToMemberships: true } })),
    when(queueAccess, () => context.prisma.waitlistEntry.findMany({ where: actionableWaitlist, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: OPERATIONS_ROW_LIMIT, select: { id: true, customerName: true, phone: true, status: true, preferredAt: true, notifiedAt: true, requestedService: { select: { id: true, name: true } }, requestedBarber: { select: { id: true, displayName: true } } } })),
    // Customer-note governed: gated separately from the payment scope above.
    loadOperationsGroomingNotes(context, shopId),
    when(customersAccess, () => context.prisma.waiverForm.findMany({ where: { shopId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: OPERATIONS_ROW_LIMIT, select: { id: true, title: true, waiverType: true, status: true, signedByName: true, signedAt: true, customer: { select: { id: true, firstName: true, lastName: true } } } })),
    context.prisma.paymentSession.findMany({ where: openPaymentSession, orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }], take: OPERATIONS_ROW_LIMIT, select: { id: true, status: true, amount: true, currencyCode: true, updatedAt: true, paymentProvider: { select: { code: true, name: true } } } }),
    context.prisma.paymentReconciliation.findMany({ where: { shopId }, orderBy: [{ observedAt: 'desc' }, { id: 'desc' }], take: OPERATIONS_ROW_LIMIT, select: { id: true, localStatusBefore: true, remoteStatus: true, localStatusAfter: true, changed: true, amount: true, observedAt: true } }),
  ]);
  const countWhen = (access: RelationAccess, count: () => Promise<number>) => (access === 'granted' ? count() : Promise.resolve(null));
  const [chairCount, lotCount, supplierCount, commissionCount, payoutCount, tipCount, policyCount, waitlistCount, waiverCount, reconciliationCount, inventoryUnits, payableCommission, tipTotal, reconciliationChanges] = await Promise.all([
    countWhen(staffAccess, () => context.prisma.barberChair.count({ where: { shopId } })),
    countWhen(inventoryAccess, () => context.prisma.inventoryLot.count({ where: { shopId } })),
    countWhen(inventoryAccess, () => context.prisma.supplier.count({ where: { shopId } })),
    context.prisma.commission.count({ where: actionableCommission }),
    context.prisma.commissionPayout.count({ where: { shopId } }),
    context.prisma.tip.count({ where: { shopId } }),
    countWhen(policiesAccess, () => context.prisma.noShowPolicy.count({ where: { shopId } })),
    countWhen(queueAccess, () => context.prisma.waitlistEntry.count({ where: actionableWaitlist })),
    countWhen(customersAccess, () => context.prisma.waiverForm.count({ where: { shopId } })),
    context.prisma.paymentReconciliation.count({ where: { shopId } }),
    inventoryAccess === 'granted' ? context.prisma.inventoryLot.aggregate({ where: { shopId, status: 'active' }, _sum: { quantityRemaining: true } }).then((result) => result._sum.quantityRemaining || 0) : Promise.resolve(null),
    context.prisma.commission.aggregate({ where: { shopId, status: 'approved' }, _sum: { commissionAmount: true } }).then((result) => result._sum.commissionAmount || 0),
    context.prisma.tip.aggregate({ where: { shopId }, _sum: { amount: true } }).then((result) => result._sum.amount || 0),
    context.prisma.paymentReconciliation.count({ where: { shopId, changed: true } }),
  ]);
  const customerName = (customer?: { id: string; firstName: string | null; lastName: string | null } | null) => customer ? { id: customer.id, name: [customer.firstName, customer.lastName].filter(Boolean).join(' ') } : null;
  return {
    shop,
    access: { staff: staffAccess, inventory: inventoryAccess, queue: queueAccess, customers: customersAccess, policies: policiesAccess },
    chairs: chairs?.map((item) => ({ ...item, assignedBarbers: item.assignedBarbers.map((barber) => ({ id: barber.id, name: barber.displayName })) })) ?? null,
    lots, suppliers,
    activeServices,
    activeBarbers: activeBarbers?.map((barber) => ({ id: barber.id, name: barber.displayName })) ?? null,
    products: products?.map((product) => { const onHand = product.inventoryLots.reduce((sum, lot) => sum + (lot.quantityRemaining || 0), 0); return { id: product.id, name: product.name, sku: product.sku, cost: product.cost, onHand, reorderSuggested: onHand <= 5 }; }) ?? null,
    commissions: commissions.map((item) => ({ ...item, barber: item.barber ? { id: item.barber.id, name: item.barber.displayName } : null })),
    payouts: payouts.map((item) => ({ ...item, barber: item.barber ? { id: item.barber.id, name: item.barber.displayName } : null })),
    tips: tips.map((item) => ({ ...item, barber: item.barber ? { id: item.barber.id, name: item.barber.displayName } : null, customer: customerName(item.customer) })),
    policies,
    waitlist: waitlist?.map((item) => ({ ...item, requestedBarber: item.requestedBarber ? { id: item.requestedBarber.id, name: item.requestedBarber.displayName } : null })) ?? null,
    // null (never an empty list) when note authority is restricted.
    notes: groomingNotes.notes,
    notesAccess: groomingNotes.notesAccess,
    notesCustomerAccess: groomingNotes.notesCustomerAccess,
    notesStaffAccess: groomingNotes.notesStaffAccess,
    waivers: waivers?.map((item) => ({ ...item, customer: customerName(item.customer) })) ?? null,
    // Only processor-settled sessions can be reconciled; manual (pay-in-person)
    // sessions have no remote status, so they are not offered for reconciliation.
    paymentSessions: paymentSessions.filter((session) => session.paymentProvider && paymentProviderSettlement(session.paymentProvider) === 'processor').map(({ paymentProvider, ...session }) => ({ ...session, paymentProvider: paymentProvider ? { name: paymentProvider.name } : null })),
    reconciliations,
    counts: { chairs: chairCount, lots: lotCount, suppliers: supplierCount, commissions: commissionCount, payouts: payoutCount, tips: tipCount, policies: policyCount, waitlist: waitlistCount, waivers: waiverCount, reconciliations: reconciliationCount },
    // Complete shop-wide aggregates, independent of the capped display rows.
    metrics: { inventoryUnits, payableCommission, tips: tipTotal, reconciliationChanges },
  };
}
