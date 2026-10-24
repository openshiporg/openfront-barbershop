import type { Context as KeystoneContext } from '.keystone/types';
import { lockGuestCommand, persistGuestCommand, readGuestCommand, runGuestCommand, unresolvedGuestCommand } from '../utils/guestBookingCommand';
import { type GuestBookingCommand, validateGuestBookingCommand } from '../../shared/guest-booking-command';

const ACCOUNT_BOOKING_PAGE_SIZE = 25;

async function currentAccountId(context: KeystoneContext) {
  const accountId = context.session?.itemId;
  // Authenticate a durable identity before any privileged appointment read.
  if (!accountId || !(await context.query.User.findOne({ where: { id: accountId }, query: 'id' }))) return null;
  return accountId;
}

/** Accepted booking timezone comes from the original receipt, never today's shop setting. */
async function acceptedTimezones(context: KeystoneContext, appointmentIds: string[]) {
  if (!appointmentIds.length) return new Map<string, string>();
  const rows = await context.prisma.$queryRawUnsafe<Array<{ appointmentId: string; bookingTimezone: string | null }>>(
    `SELECT "appointment" AS "appointmentId", receipt->'appointment'->>'bookingTimezone' AS "bookingTimezone" FROM "GuestBookingCommand" WHERE "appointment" = ANY($1::text[])`,
    appointmentIds,
  );
  return new Map(rows.filter((row) => row.bookingTimezone).map((row) => [row.appointmentId, row.bookingTimezone as string]));
}

export async function getAccountBookings(_root: unknown, args: { page?: number | null }, context: KeystoneContext) {
  const accountId = await currentAccountId(context);
  if (!accountId) return { success: false, error: 'Sign in to view bookings.', data: null };
  const page = Math.max(1, Math.floor(Number(args?.page) || 1));
  const [bookings, total] = await Promise.all([
    context.prisma.appointment.findMany({
      where: { accountId }, orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * ACCOUNT_BOOKING_PAGE_SIZE, take: ACCOUNT_BOOKING_PAGE_SIZE,
      select: { id: true, startsAt: true, status: true, paymentStatus: true, price: true, serviceTitleSnapshot: true, serviceImagePathSnapshot: true, barberNameSnapshot: true, shop: { select: { timezone: true } } },
    }),
    context.prisma.appointment.count({ where: { accountId } }),
  ]);
  const zones = await acceptedTimezones(context, bookings.map((booking) => booking.id));
  return {
    success: true,
    error: null,
    data: {
      bookings: bookings.map(({ shop, ...item }) => ({ ...item, timeZone: zones.get(item.id) || shop.timezone || null, startsAt: item.startsAt.toISOString() })),
      page,
      pageSize: ACCOUNT_BOOKING_PAGE_SIZE,
      total,
      hasMore: page * ACCOUNT_BOOKING_PAGE_SIZE < total,
    },
  };
}

const EXPORT_LIMIT = 1000;

/** The signed-in person's own account and bookings; never matched by email or phone. */
export async function exportMyAccountData(_root: unknown, _args: unknown, context: KeystoneContext) {
  const accountId = await currentAccountId(context);
  if (!accountId) return { success: false, error: 'Sign in to export your data.', data: null };
  const [user, appointments] = await Promise.all([
    context.prisma.user.findUnique({ where: { id: accountId }, select: { id: true, name: true, email: true, createdAt: true } }),
    context.prisma.appointment.findMany({
      where: { accountId }, orderBy: [{ startsAt: 'desc' }, { id: 'desc' }], take: EXPORT_LIMIT + 1,
      select: { id: true, startsAt: true, endsAt: true, status: true, paymentStatus: true, price: true, depositAmount: true, serviceTitleSnapshot: true, barberNameSnapshot: true, customerNotes: true, guestNameSnapshot: true, createdAt: true },
    }),
  ]);
  return {
    success: true,
    error: null,
    data: {
      exportedAt: new Date().toISOString(),
      account: user,
      appointments: appointments.slice(0, EXPORT_LIMIT),
      complete: appointments.length <= EXPORT_LIMIT,
      note: appointments.length > EXPORT_LIMIT ? `Latest ${EXPORT_LIMIT} bookings. Contact the shop for older records.` : null,
    },
  };
}

export async function recoverAccountBooking(_root: unknown, args: GuestBookingCommand & { closeIfAbsent?: boolean }, context: KeystoneContext) {
  const accountId = context.session?.itemId;
  if (!accountId) return unresolvedGuestCommand();
  try {
    validateGuestBookingCommand(args);
    return await runGuestCommand(async tx => {
      if (!(await tx.user.findUnique({ where: { id: accountId }, select: { id: true } }))) return unresolvedGuestCommand();
      await lockGuestCommand(tx, args.requestKey);
      const actor = `account:${accountId}`;
      const original = await readGuestCommand(tx, args, actor);
      if (original) return original;
      if (!args.closeIfAbsent) return unresolvedGuestCommand();
      await persistGuestCommand(tx, args, { version: 1, disposition: 'closed', appointment: null }, actor);
      return { success: false, disposition: 'closed' as const, error: 'That earlier request was not booked.', appointment: null, accessToken: null };
    });
  } catch { return unresolvedGuestCommand(); }
}

/**
 * Package and membership balances for the signed-in account: client profiles
 * linked to the account, or created by its own bookings.
 */
export async function getAccountBalances(_root: unknown, _args: unknown, context: KeystoneContext) {
  const accountId = await currentAccountId(context);
  if (!accountId) return { success: false, error: 'Sign in to view balances.', data: null };
  const booked = await context.prisma.appointment.findMany({ where: { accountId, customerId: { not: null } }, select: { customerId: true }, distinct: ['customerId'], take: 200 });
  const customerIds = booked.map((row) => row.customerId).filter((id): id is string => Boolean(id));
  const balances = await context.prisma.customerPackage.findMany({
    where: { status: { in: ['active', 'paused'] }, customer: { OR: [{ userId: accountId }, ...(customerIds.length ? [{ id: { in: customerIds } }] : [])] } },
    orderBy: [{ createdAt: 'desc' }],
    take: 50,
    select: { id: true, status: true, remainingVisits: true, expiresAt: true, nextBillingAt: true, servicePackage: { select: { name: true } }, membershipPlan: { select: { name: true, billingInterval: true } } },
  });
  return {
    success: true,
    error: null,
    data: balances.map((item) => ({
      id: item.id, status: item.status, remainingVisits: item.remainingVisits,
      name: item.membershipPlan?.name || item.servicePackage?.name || 'Balance',
      kind: item.membershipPlan ? 'membership' : 'package',
      billingInterval: item.membershipPlan?.billingInterval || null,
      expiresAt: item.expiresAt?.toISOString() || null, nextBillingAt: item.nextBillingAt?.toISOString() || null,
    })),
  };
}
