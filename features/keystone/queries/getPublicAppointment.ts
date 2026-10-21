import { canAccessAppointment } from '../utils/waiverEvidence';
import { bookingEligibilityFromSnapshot } from '../../shared/public-booking-eligibility';

type Args = {
  appointmentId: string;
  accessToken?: string | null;
};

type PublicAppointmentRecord = {
  id: string;
  shopId?: string | null;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  durationMinutes?: number | null;
  serviceTitleSnapshot?: string | null;
  serviceImagePathSnapshot?: string | null;
  serviceModifiersSnapshot?: unknown;
  barberNameSnapshot?: string | null;
  barberChairNumberSnapshot?: string | null;
  status?: string | null;
  source?: string | null;
  paymentStatus?: string | null;
  price?: number | null;
  depositAmount?: number | null;
  customerNotes?: string | null;
  guestNameSnapshot?: string | null;
  customerId?: string | null;
  barberId?: string | null;
  serviceId?: string | null;
  transactionId?: string | null;
  publicAccessTokenHash?: string | null;
  accountId?: string | null;
};

type PublicAppointmentLineItemRecord = {
  id: string;
  title?: string | null;
  price?: number | null;
  durationMinutes?: number | null;
  imagePath?: string | null;
  modifiers?: unknown;
  barberName?: string | null;
  barberChairNumber?: string | null;
  packageBalanceId?: string | null;
  packageName?: string | null;
  packageVisitsConsumed?: number | null;
};

type PublicAppointmentSudoContext = {
  prisma: {
    $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
    appointment: {
      findUnique(args: Record<string, unknown>): Promise<PublicAppointmentRecord | null>;
    };
    customer: {
      findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    };
    barber: {
      findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    };
    service: {
      findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    };
    checkoutTransaction: {
      findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    };
    appointmentLineItem: {
      findMany(args: Record<string, unknown>): Promise<PublicAppointmentLineItemRecord[]>;
    };
  };
};

type PublicAppointmentContext = {
  session?: { itemId?: string } | null;
  sudo(): PublicAppointmentSudoContext;
};

function toIsoString(value?: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function formatCurrency(cents: unknown) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(cents || 0) / 100);
}

export default async function getPublicAppointment(_root: unknown, args: Args, context: PublicAppointmentContext) {
  const appointmentId = args.appointmentId?.trim();
  const accessToken = args.accessToken?.trim() || '';
  const sessionItemId = context.session?.itemId || null;

  if (!appointmentId || (!accessToken && !sessionItemId)) return null;

  const prisma = context.sudo().prisma;
  const credential = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, shopId: true, publicAccessTokenHash: true, accountId: true },
  });
  if (!credential?.shopId || !canAccessAppointment({ token: accessToken, storedHash: credential.publicAccessTokenHash, accountId: credential.accountId, sessionItemId })) return null;
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      shopId: true,
      startsAt: true,
      endsAt: true,
      durationMinutes: true,
      serviceTitleSnapshot: true,
      serviceImagePathSnapshot: true,
      serviceModifiersSnapshot: true,
      barberNameSnapshot: true,
      barberChairNumberSnapshot: true,
      status: true,
      source: true,
      paymentStatus: true,
      price: true,
      depositAmount: true,
      customerNotes: true,
      guestNameSnapshot: true,
      customerId: true,
      barberId: true,
      serviceId: true,
      transactionId: true,
      publicAccessTokenHash: true,
      accountId: true,
    },
  });

  if (!appointment?.customerId || appointment.shopId !== credential.shopId || !canAccessAppointment({ token: accessToken, storedHash: appointment.publicAccessTokenHash, accountId: appointment.accountId, sessionItemId })) {
    return null;
  }

  const [barber, service, transaction, lineItems, waiverRows] = await Promise.all([
    appointment.barberId
      ? prisma.barber.findFirst({
          where: { id: appointment.barberId, shopId: appointment.shopId },
          select: { id: true, displayName: true, imagePath: true, chairNumber: true },
        })
      : null,
    appointment.serviceId
      ? prisma.service.findFirst({
          where: { id: appointment.serviceId, shopId: appointment.shopId },
          select: { id: true, name: true, description: true, imagePath: true },
        })
      : null,
    appointment.transactionId
      ? prisma.checkoutTransaction.findFirst({
          where: { id: appointment.transactionId, shopId: appointment.shopId, customerId: appointment.customerId,
            lineItems: { some: { appointmentId: appointment.id } },
            appointments: { every: { id: appointment.id } },
          },
          select: { id: true, status: true, total: true, paymentMethod: true, completedAt: true, cashRefund: { select: { amount: true, refundedAt: true } } },
        })
      : null,
    prisma.appointmentLineItem.findMany({
      where: { appointmentId: appointment.id, transactionId: appointment.transactionId || null,
        ...(appointment.transactionId ? { transaction: { shopId: appointment.shopId, customerId: appointment.customerId,
          appointments: { every: { id: appointment.id } } } } : {}),
      },
      select: {
        id: true,
        title: true,
        price: true,
        durationMinutes: true,
        imagePath: true,
        modifiers: true,
        barberName: true,
        barberChairNumber: true,
        packageBalanceId: true,
        packageName: true,
        packageVisitsConsumed: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.$queryRawUnsafe<Array<{ requirement: Record<string, unknown> | null; signed: boolean; bookingPolicySnapshot?: unknown; bookingTimezone?: string | null }>>(`
      SELECT a."waiverRequirementSnapshot" AS requirement, a."bookingPolicySnapshot",
        command.receipt->\'appointment\'->>\'bookingTimezone\' AS "bookingTimezone",
        EXISTS (SELECT 1 FROM "WaiverForm" waiver WHERE waiver."appointment" = a.id AND waiver."shop" = a."shop" AND waiver."customer" = a."customer" AND waiver."service" = a."service" AND waiver.status = 'signed' AND waiver."templateHash" = a."waiverRequirementSnapshot"->>'templateHash' AND waiver."affirmationHash" IS NOT NULL AND waiver."signedAt" IS NOT NULL) AS signed
      FROM "Appointment" a LEFT JOIN "GuestBookingCommand" command ON command."appointment" = a.id AND command."shop" = a."shop"
      WHERE a.id = $1 AND a."shop" = $2 LIMIT 1
    `, appointment.id, appointment.shopId),
  ]);
  const waiver = waiverRows[0];
  const requirement = waiver?.requirement || null;

  return {
    id: appointment.id,
    startsAt: toIsoString(appointment.startsAt),
    endsAt: toIsoString(appointment.endsAt),
    durationMinutes: appointment.durationMinutes,
    status: appointment.status,
    source: appointment.source,
    paymentStatus: appointment.paymentStatus,
    price: appointment.price,
    depositAmount: appointment.depositAmount,
    customerNotes: appointment.customerNotes,
    bookingEligibility: bookingEligibilityFromSnapshot(waiver?.bookingPolicySnapshot),
    bookingTimezone: waiver?.bookingTimezone || null,
    waiverRequired: requirement?.required === true,
    waiverTemplateKey: requirement?.templateKey || null,
    waiverTemplateVersion: requirement?.templateVersion || null,
    waiverTemplateText: requirement?.templateText || null,
    waiverTemplateHash: requirement?.templateHash || null,
    waiverSigned: waiver?.signed || false,
    // A booking token authorizes this occurrence, never a customer account.
    // Legacy occurrences without a supplied-name snapshot intentionally show Guest.
    customer: { id: `guest:${appointment.id}`, firstName: appointment.guestNameSnapshot || 'Guest', lastName: '', packageBalances: [] },
    // Accepted snapshots are the receipt; current rows only supply a photo.
    barber: appointment.barberId
      ? {
          id: appointment.barberId,
          displayName: appointment.barberNameSnapshot || String(barber?.displayName || ''),
          chairNumber: appointment.barberChairNumberSnapshot || String(barber?.chairNumber || ''),
          imagePath: barber?.imagePath || null,
        }
      : null,
    service: appointment.serviceId
      ? {
          id: appointment.serviceId,
          name: appointment.serviceTitleSnapshot || String(service?.name || ''),
          description: service?.description || null,
          imagePath: appointment.serviceImagePathSnapshot || String(service?.imagePath || ''),
          durationMinutes: appointment.durationMinutes,
          price: appointment.price,
          // Deposit facts come from this booking, not the service's current settings.
          depositRequired: appointment.paymentStatus === 'deposit_due' || appointment.paymentStatus === 'deposit_paid',
          depositAmount: appointment.depositAmount,
        }
      : null,
    lineItems: lineItems.length
      ? lineItems
      : [{
          id: `booking:${appointment.id}`,
          title: appointment.serviceTitleSnapshot || String(service?.name || 'Barbershop service'),
          price: appointment.price ?? 0,
          durationMinutes: appointment.durationMinutes ?? null,
          imagePath: appointment.serviceImagePathSnapshot || String(service?.imagePath || ''),
          modifiers: appointment.serviceModifiersSnapshot || [],
          barberName: appointment.barberNameSnapshot || String(barber?.displayName || ''),
          barberChairNumber: appointment.barberChairNumberSnapshot || String(barber?.chairNumber || ''),
          packageBalanceId: '',
          packageName: '',
          packageVisitsConsumed: 0,
        }],
    transaction: transaction
      ? (() => {
          const { cashRefund, ...receipt } = transaction as Record<string, unknown> & { cashRefund?: { amount?: number | null; refundedAt?: Date | string | null } | null };
          return {
            ...receipt,
            formattedTotal: formatCurrency(receipt.total),
            completedAt: toIsoString(receipt.completedAt as Date | string | null),
            refundedAmount: cashRefund ? Number(cashRefund.amount || 0) : null,
            formattedRefundedAmount: cashRefund ? formatCurrency(cashRefund.amount) : null,
            refundedAt: cashRefund ? toIsoString(cashRefund.refundedAt || null) : null,
          };
        })()
      : null,
  };
}
