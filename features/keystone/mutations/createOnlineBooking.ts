import type { Prisma, PrismaClient } from '@prisma/client';

import { shopMinute } from '../../shared/shop-time';
import { dayKeyForDate, dayRange, isSlotAvailable, occupiedBufferMinutes } from '../utils/availability';
import {
  assertAppointmentCandidateSetComplete,
  lockBookingResources,
  MAX_BOOKING_CAPACITY_CANDIDATES,
  shopDayAppointmentCandidateFilter,
} from '../utils/bookingCapacity';
import { createPublicAccessToken, hashPublicAccessToken } from '../utils/publicAccessToken';
import { type GuestBookingCommand, validateGuestBookingCommand } from '../../shared/guest-booking-command';
import { lockGuestCommand, persistGuestCommand, readGuestCommand, runGuestCommand, unresolvedGuestCommand, type GuestCommandResult } from '../utils/guestBookingCommand';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { requireEffectivePractitionerAuthority } from '../utils/practitionerAuthority';
import { requireEffectiveBookingPolicy } from '../utils/bookingPolicy';
import { resolvePublishedShop } from '../utils/publicShop';
import { getWaiverRequirement } from '../utils/waiverEvidence';
import { assertPublicServiceEligibility } from '../utils/publicServiceEligibility';
import { publicBookingEligibilityView } from '../../shared/public-booking-eligibility';

type ServiceRecord = {
  id: string;
  name?: string | null;
  durationMinutes?: number | null;
  price?: number | null;
  depositRequired?: boolean | null;
  depositAmount?: number | null;
  status?: string | null;
  imagePath?: string | null;
  shop?: { id: string; status?: string | null; isPublic?: boolean | null } | null;
  category?: { id: string; status?: string | null; shop?: { id: string } | null } | null;
  specialists?: { id: string; displayName?: string | null }[] | null;
};

type BarberRecord = {
  id: string;
  displayName?: string | null;
  chairNumber?: string | null;
  shop?: { id: string } | null;
};

type BookingSudoContext = {
  query: {
    Service: { findOne(args: Record<string, unknown>): Promise<ServiceRecord | null> };
    Barber: { findMany(args: Record<string, unknown>): Promise<BarberRecord[]> };
  };
};

type BookingContext = {
  prisma: PrismaClient;
  session?: { itemId?: string };
  sudo(): BookingSudoContext;
};

const ACTIVE_APPOINTMENT_STATUSES = ['requested', 'confirmed', 'checked_in', 'in_chair'] as const;

function clean(value?: string | null) {
  return value?.trim() || '';
}

/** A definite admission refusal thrown before any write; the transaction rolls back. */
export class BookingRejected extends Error {}

const MAX_FIRST_AVAILABLE_CANDIDATES = 50;
const ONLINE_BOOKING_UNAVAILABLE = 'This time can’t be booked online right now. Choose another time or contact the shop.';
const BARBER_QUERY = 'id displayName chairNumber shop { id }';

/** Exact requested barber, or every eligible barber in a stable order for "First available". */
async function bookingCandidates(sudo: BookingSudoContext, service: ServiceRecord, requestedBarberId: string) {
  const shopId = service.shop?.id;
  if (!shopId) return [];
  const bookable = { shop: { id: { equals: shopId } }, status: { equals: 'active' }, bookingEnabled: { equals: true } };
  if (requestedBarberId) {
    return sudo.query.Barber.findMany({ where: { id: { equals: requestedBarberId }, ...bookable }, query: BARBER_QUERY, take: 1 });
  }
  const specialistIds = (service.specialists || []).map((specialist) => specialist.id);
  return sudo.query.Barber.findMany({
    where: { ...bookable, ...(specialistIds.length ? { id: { in: specialistIds } } : {}) },
    query: BARBER_QUERY,
    orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
    take: MAX_FIRST_AVAILABLE_CANDIDATES,
  });
}

function isAdmissionRefusal(error: unknown) {
  // Plain errors thrown by our own checks happen before any write. Database and
  // transport errors carry a code or a Prisma class name and stay unresolved.
  if (error instanceof BookingRejected) return true;
  if (!(error instanceof Error)) return false;
  const known = error as Error & { code?: unknown };
  return known.code === undefined && !error.constructor.name.startsWith('PrismaClient');
}

export async function createLockedAppointment({
  transaction,
  serviceId,
  barberId,
  expectedChairNumber,
  expectedShopId,
  startsAt,
  customerName,
  customerPhone,
  customerEmail,
  notes,
  publicAccess,
  accountId,
  reviewed,
}: {
  transaction: Prisma.TransactionClient;
  serviceId: string;
  barberId: string;
  expectedChairNumber: string;
  expectedShopId?: string;
  startsAt: Date;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes: string;
  publicAccess: ReturnType<typeof createPublicAccessToken>;
  accountId?: string;
  reviewed?: { price?: number; durationMinutes?: number; policyVersion?: string };
}) {
  await lockBookingResources(transaction, { serviceId, barberId });

  const [service, barber, publishedShop] = await Promise.all([
    transaction.service.findUnique({
      where: { id: serviceId },
      include: {
        shop: { select: { id: true, status: true, isPublic: true, timezone: true } },
        category: { select: { id: true, shopId: true, status: true } },
        specialists: { select: { id: true } },
      },
    }),
    transaction.barber.findUnique({ where: { id: barberId }, include: { chair: { select: { id: true, shopId: true, status: true } } } }),
    resolvePublishedShop(transaction, { id: true }),
  ]);
  if (
    !service
    || service.status !== 'active'
    || !service.shopId
    || !publishedShop
    || service.shopId !== publishedShop.id
    || (expectedShopId !== undefined && service.shopId !== expectedShopId)
    || service.shop.status !== 'active'
    || !service.shop.isPublic
  ) throw new BookingRejected('Selected service is no longer available.');
  if (service.depositRequired) {
    throw new BookingRejected('Online booking for deposit-required services is unavailable until a customer payment provider is connected.');
  }
  if (!barber || barber.status !== 'active' || !barber.bookingEnabled) {
    throw new BookingRejected('Selected barber is no longer available.');
  }
  if (!barber.chair) throw new BookingRejected('The selected barber does not have an assigned chair.');
  if (barber.shopId !== service.shopId || barber.chair.shopId !== service.shopId) {
    throw new BookingRejected('Selected service, barber, and chair must belong to the same shop.');
  }
  if (barber.chair.status !== 'active') throw new BookingRejected('The selected barber chair is unavailable.');
  await lockBookingResources(transaction, { serviceId, barberId, chairNumber: `${service.shopId}:${barber.chair.id}` });
  if ((barber.chairNumber || '') !== expectedChairNumber) {
    throw new BookingRejected('The selected barber chair changed. Refresh availability and try again.');
  }
  if (service.specialists.length > 0 && !service.specialists.some((specialist) => specialist.id === barber.id)) {
    throw new BookingRejected('Selected barber does not provide this service.');
  }

  const bookingPolicy = await requireEffectiveBookingPolicy(transaction, { shopId: service.shopId, at: new Date() });
  assertPublicServiceEligibility(service, publishedShop.id, bookingPolicy.publicServiceEligibility);
  if (reviewed) {
    if (reviewed.price !== undefined && reviewed.price !== (service.price || 0)) throw new BookingRejected('The price of this service has changed. Review the updated price and book again.');
    if (reviewed.durationMinutes !== undefined && reviewed.durationMinutes !== service.durationMinutes) throw new BookingRejected('The length of this service has changed. Review the updated details and book again.');
    if (reviewed.policyVersion !== undefined && reviewed.policyVersion !== `${bookingPolicy.policyId}:${bookingPolicy.version}`) throw new BookingRejected('The shop’s booking policy has changed. Review it and book again.');
  }

  const timeZone = service.shop.timezone;
  if (!timeZone) throw new BookingRejected('Shop timezone is unavailable.');
  try { new Intl.DateTimeFormat('en', { timeZone }).format(startsAt); }
  catch { throw new BookingRejected('Shop timezone is unavailable.'); }
  if (!Number.isInteger(service.durationMinutes) || service.durationMinutes < 1) throw new BookingRejected('Service duration is unavailable.');
  if (startsAt.getTime() < Date.now() + 5 * 60_000 || startsAt.getTime() > Date.now() + 90 * 86400_000) throw new BookingRejected('Choose an appointment at least 5 minutes and no more than 90 days from now.');
  const { start, end } = dayRange(startsAt, timeZone);
  const minute = (value: Date) => value <= start ? 0 : value >= end ? 1440 : shopMinute(value, timeZone);
  const durationMinutes = service.durationMinutes;
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  // Cleanup after the visit is part of the occupied interval for every check.
  const bufferMinutes = occupiedBufferMinutes(barber.bufferMinutes, service.bookingBufferMinutes);
  const occupiedEndsAt = new Date(endsAt.getTime() + bufferMinutes * 60_000);
  const [weeklySchedule, exceptions, shifts] = await Promise.all([
    transaction.barberSchedule.findFirst({
      where: {
        barberId,
        dayOfWeek: dayKeyForDate(startsAt, timeZone) as Prisma.EnumBarberScheduleDayOfWeekTypeFilter['equals'],
        isWorking: true,
      },
    }),
    transaction.scheduleException.findMany({
      where: {
        shopId: service.shopId, status: 'active', startsAt: { lt: occupiedEndsAt }, endsAt: { gt: startsAt },
        OR: [
          { barberId },
          { exceptionType: 'shop_closure', barberId: null, chairId: null },
          ...(barber.chairId ? [{ chairId: barber.chairId }] : []),
        ],
      },
    }),
    transaction.staffShift.findMany({ where: { shopId: service.shopId, barberId, status: { in: ['scheduled', 'clocked_in'] }, scheduledStart: { lt: end }, scheduledEnd: { gt: start } }, orderBy: { scheduledStart: 'asc' } }),
  ]);
  const blockingExceptions = exceptions.filter((item) => item.exceptionType !== 'working_override');
  if (blockingExceptions.length) throw new BookingRejected(blockingExceptions[0].reason || 'That time is blocked by a schedule exception.');
  const override = exceptions.find((item) => item.exceptionType === 'working_override');
  const baseSchedule = override ? {
    id: override.id, barberId, dayOfWeek: dayKeyForDate(startsAt, timeZone), isWorking: true,
    startMinute: minute(override.startsAt),
    endMinute: minute(override.endsAt),
    breakStartMinute: null, breakEndMinute: null, notes: override.reason, createdAt: override.createdAt, updatedAt: override.updatedAt,
  } : weeklySchedule;
  if (shifts.length && !shifts.some((shift) => startsAt >= shift.scheduledStart && occupiedEndsAt <= shift.scheduledEnd)) throw new BookingRejected('That time is outside the barber’s scheduled shift.');
  const schedule = baseSchedule;
  const appointments = await transaction.appointment.findMany({
    where: {
      shopId: service.shopId, status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      ...shopDayAppointmentCandidateFilter(start, end, bufferMinutes),
      OR: [
        { barberId },
        ...(barber.chair?.id ? [{ chairId: barber.chair.id }] : []),
      ],
    },
    select: { id: true, startsAt: true, endsAt: true, durationMinutes: true, barberId: true, status: true },
    take: MAX_BOOKING_CAPACITY_CANDIDATES + 1,
  });
  assertAppointmentCandidateSetComplete(appointments);

  if (!isSlotAvailable({
    startsAt, timeZone,
    serviceDuration: durationMinutes + bufferMinutes,
    schedule: schedule ? {
      ...schedule,
      dayOfWeek: String(schedule.dayOfWeek),
      barber: { id: barber.id, displayName: barber.displayName },
    } : null,
    appointments: appointments.map((appointment) => ({
      id: appointment.id,
      startsAt: appointment.startsAt.toISOString(),
      endsAt: appointment.endsAt?.toISOString() || null,
      durationMinutes: appointment.durationMinutes || 30,
      status: appointment.status,
      barber: appointment.barberId ? { id: appointment.barberId } : null,
    })),
    occupiedAppointmentBufferMinutes: bufferMinutes,
    blockingWindows: blockingExceptions.map((item) => ({ startsAt: item.startsAt, endsAt: item.endsAt, reason: item.reason })),
  })) {
    throw new BookingRejected('That slot was just taken or is outside working hours. Choose another time.');
  }

  const [bookingAuthority, waiverRequirement] = await Promise.all([
    requireEffectivePractitionerAuthority(transaction, { shopId: service.shopId, barberId: barber.id, serviceId: service.id, at: startsAt }),
    getWaiverRequirement(transaction, service.id),
  ]);

  // Contact details are not authentication. Never attach a guest to an existing
  // customer/profile/package balance solely because they know a phone number.
  const [firstName, ...rest] = customerName.split(/\s+/);
  const customer = await transaction.customer.create({
    data: {
      shopId: service.shopId,
      firstName: firstName || customerName,
      lastName: rest.join(' '),
      phone: customerPhone,
      email: customerEmail,
      status: 'active',
    },
  });

  const appointment = await transaction.appointment.create({
    data: {
      shopId: service.shopId,
      accountId,
      chairId: barber.chair?.id || null,
      startsAt,
      endsAt,
      durationMinutes,
      serviceTitleSnapshot: service.name || 'Barbershop service',
      serviceImagePathSnapshot: service.imagePath || '',
      serviceModifiersSnapshot: [],
      barberNameSnapshot: barber.displayName || '',
      barberChairNumberSnapshot: barber.chairNumber || '',
      status: 'requested',
      source: 'online',
      paymentStatus: service.depositRequired ? 'deposit_due' : 'not_required',
      price: service.price || 0,
      depositAmount: service.depositAmount || 0,
      customerNotes: notes,
      guestNameSnapshot: customerName,
      publicAccessTokenHash: publicAccess.hash,
      serviceId: service.id,
      barberId: barber.id,
      customerId: customer.id,
    },
    include: {
      service: { select: { id: true, name: true, durationMinutes: true, price: true, imagePath: true } },
      barber: { select: { id: true, displayName: true, chairNumber: true, imagePath: true } },
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
    },
  });
  await transaction.$executeRawUnsafe(`
    UPDATE "Appointment"
    SET "bookingAuthoritySnapshot" = $2::jsonb,
        "bookingPolicySnapshot" = $3::jsonb,
        "waiverRequirementSnapshot" = $4::jsonb
    WHERE id = $1
  `, appointment.id, JSON.stringify(bookingAuthority), JSON.stringify(bookingPolicy), JSON.stringify(waiverRequirement));
  await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({
    eventKey: `appointment:${appointment.id}:created:v1`,
    eventType: 'appointment.created',
    aggregateType: 'appointment',
    aggregateId: appointment.id,
    shopId: service.shopId,
    occurredAt: appointment.createdAt,
    data: {
      appointment: {
        id: appointment.id,
        status: appointment.status,
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt?.toISOString() || null,
        customerId: appointment.customerId,
        barberId: appointment.barberId,
        chairId: appointment.chairId,
        serviceId: appointment.serviceId,
        price: appointment.price,
        bookingAuthority,
        bookingPolicy,
        waiverRequirement,
      },
    },
  }));
  return { ...appointment, bookingEligibility: publicBookingEligibilityView(bookingPolicy), bookingTimezone: timeZone };
}

export default async function createOnlineBooking(
  _root: unknown,
  args: GuestBookingCommand,
  context: BookingContext
): Promise<GuestCommandResult> {
  // This capability is guest-only. A current signed-in actor cannot silently
  // adopt a saved guest request; account workflows need separate authority.
  if (context.session) return unresolvedGuestCommand();
  return createBookingForActor(args, context);
}

export async function createAccountBooking(_root: unknown, args: GuestBookingCommand, context: BookingContext) {
  if (!context.session?.itemId) return unresolvedGuestCommand();
  return createBookingForActor(args, context, context.session.itemId);
}

async function createBookingForActor(args: GuestBookingCommand, context: BookingContext, accountId?: string): Promise<GuestCommandResult> {
  const actor = accountId ? `account:${accountId}` : 'guest';
  try {
    const body = validateGuestBookingCommand(args);
    return await runGuestCommand(async (transaction) => {
      await lockGuestCommand(transaction, args.requestKey);
      if (accountId && !(await transaction.user.findUnique({ where: { id: accountId }, select: { id: true } }))) throw new Error('Account unavailable.');
      const original = await readGuestCommand(transaction, args, actor);
      if (original) return original;
      // Original ACK precedes every mutable fresh-admission prerequisite.
      const startsAt = new Date(body.startsAt);
      if (startsAt.getTime() < Date.now() + 5 * 60_000 || startsAt.getTime() > Date.now() + 90 * 86400_000) throw new BookingRejected('Choose an appointment at least 5 minutes and no more than 90 days from now.');
      const sudo = context.sudo();
      const [service, publishedShop] = await Promise.all([
        sudo.query.Service.findOne({
          where: { id: body.serviceId },
          query: 'id name imagePath durationMinutes price depositRequired depositAmount status shop { id status isPublic } category { id status shop { id } } specialists(where: { status: { equals: active }, bookingEnabled: { equals: true } }) { id displayName }',
        }),
        resolvePublishedShop(transaction, { id: true }),
      ]);
      if (!service || !publishedShop || publishedShop.id !== body.shopId
        || service.status !== 'active' || service.shop?.id !== publishedShop.id
        || service.shop?.status !== 'active' || !service.shop?.isPublic) throw new BookingRejected('This service is no longer available online.');
      if (service.depositRequired) throw new BookingRejected('This service needs a deposit and can’t be booked online yet. Contact the shop.');
      try {
        const policy = await requireEffectiveBookingPolicy(transaction, { shopId: publishedShop.id, at: new Date() });
        assertPublicServiceEligibility({
          shopId: service.shop.id, status: service.status, shop: service.shop,
          category: service.category ? { id: service.category.id, status: service.category.status, shopId: service.category.shop?.id || '' } : null,
        }, publishedShop.id, policy.publicServiceEligibility);
      } catch (error) {
        if (isAdmissionRefusal(error)) throw new BookingRejected(ONLINE_BOOKING_UNAVAILABLE);
        throw error;
      }
      if (body.reviewedPrice === undefined || body.reviewedDurationMinutes === undefined || body.reviewedPolicyVersion === undefined) {
        throw new BookingRejected('Review the service details and booking policy, then book again.');
      }
      const requestedBarberId = clean(body.barberId);
      const candidates = await bookingCandidates(sudo, service, requestedBarberId);
      if (!candidates.length) throw new BookingRejected(requestedBarberId ? 'That barber is no longer taking online bookings for this service.' : 'No barber is taking online bookings for this service.');
      let appointment: Awaited<ReturnType<typeof createLockedAppointment>> | null = null;
      let refusal: unknown = null;
      // "First available" tries each eligible barber in a stable order and books
      // the first one whose capacity is actually free at this time.
      for (const barber of candidates) {
        try {
          appointment = await createLockedAppointment({
            transaction, accountId, serviceId: body.serviceId, barberId: barber.id,
            expectedChairNumber: barber.chairNumber || '', expectedShopId: body.shopId, startsAt,
            customerName: body.customerName, customerPhone: body.customerPhone,
            customerEmail: body.customerEmail, notes: body.notes,
            publicAccess: { token: args.guestProof, hash: hashPublicAccessToken(args.guestProof) },
            reviewed: { price: body.reviewedPrice, durationMinutes: body.reviewedDurationMinutes, policyVersion: body.reviewedPolicyVersion },
          });
          break;
        } catch (error) {
          if (!isAdmissionRefusal(error)) throw error;
          refusal = error instanceof BookingRejected ? error : new BookingRejected(ONLINE_BOOKING_UNAVAILABLE);
        }
      }
      if (!appointment) {
        if (candidates.length === 1 && refusal instanceof BookingRejected) throw refusal;
        throw new BookingRejected(requestedBarberId ? 'That time is no longer available. Choose another time.' : 'No barber is free at that time anymore. Choose another time.');
      }
      // Receipt is immutable accepted evidence, not a later catalog projection.
      const receipt = {
        id: appointment.id, bookingEligibility: appointment.bookingEligibility, bookingTimezone: appointment.bookingTimezone,
        startsAt: appointment.startsAt.toISOString(), endsAt: appointment.endsAt?.toISOString() || null,
        durationMinutes: appointment.durationMinutes, status: appointment.status,
        paymentStatus: appointment.paymentStatus, price: appointment.price, depositAmount: appointment.depositAmount,
        service: { id: appointment.serviceId, name: appointment.serviceTitleSnapshot, imagePath: appointment.serviceImagePathSnapshot, durationMinutes: appointment.durationMinutes, price: appointment.price },
        barber: { id: appointment.barberId, displayName: appointment.barberNameSnapshot, chairNumber: appointment.barberChairNumberSnapshot },
      };
      await persistGuestCommand(transaction, args, { version: 1, disposition: 'accepted', appointment: receipt }, actor);
      return { success: true, disposition: 'accepted', error: null, appointment: receipt, accessToken: args.guestProof };
    });
  } catch (error) {
    // Our own refusals happen before any write, so nothing was booked.
    if (error instanceof BookingRejected) return { success: false, disposition: 'rejected', error: error.message, appointment: null, accessToken: null };
    // Includes lost commit ACK: never infer rollback from transport/DB error.
    return unresolvedGuestCommand();
  }
}
