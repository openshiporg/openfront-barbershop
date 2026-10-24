import type { Prisma, PrismaClient } from '@prisma/client';

import { permissions } from '../access';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';
import { hashPublicAccessToken } from '../utils/publicAccessToken';
import { assertPackageRedeemableForService } from '../utils/packageUsageLedger';
import { buildAppointmentLineItemSnapshot } from '../utils/appointmentLineItemSnapshot';
import { calculateServiceCommission } from '../utils/commissionAccrual';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { consumePackageVisitInTransaction } from '../utils/packageUsageLedger';
import { runSerializableTransaction } from '../utils/serializableTransaction';
import { assertAuthorityMatches, requireEffectivePractitionerAuthority, type PractitionerAuthoritySnapshot } from '../utils/practitionerAuthority';
import { getAppointmentWaiverRequirement, requireSignedWaiver } from '../utils/waiverEvidence';

type Args = {
  appointmentId: string;
  paymentMethod?: string | null;
  packageBalanceId?: string | null;
  tipAmount?: number | null;
  discountAmount?: number | null;
  taxAmount?: number | null;
  notes?: string | null;
  paymentSessionId?: string | null;
  idempotencyKey?: string | null;
};

type CheckoutContext = {
  session?: Parameters<typeof permissions.canManagePayments>[0]['session'];
  prisma: PrismaClient;
};

function money(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 2_000_000_000) throw new Error('Amounts must be non-negative whole cents within the supported limit.');
  return amount;
}

function clean(value?: string | null) {
  return value?.trim() || '';
}

function assertCheckoutReplay(transaction: { paymentMethod: unknown; tipAmount: number | null; discountAmount: number | null; taxAmount: number | null; total: number | null; packageBalanceId: string | null; paymentSessionId: string | null; notes: string | null }, expected: { paymentMethod: string; tipAmount: number; discountAmount: number; taxAmount: number; total: number; packageBalanceId: string; paymentSessionId: string; notes: string }) {
  if (String(transaction.paymentMethod) !== expected.paymentMethod || (transaction.tipAmount || 0) !== expected.tipAmount || (transaction.discountAmount || 0) !== expected.discountAmount || (transaction.taxAmount || 0) !== expected.taxAmount || (transaction.total || 0) !== expected.total || (transaction.packageBalanceId || '') !== expected.packageBalanceId || (expected.paymentSessionId && (transaction.paymentSessionId || '') !== expected.paymentSessionId) || ((transaction.notes || '') !== expected.notes && !(transaction.notes || '').startsWith(expected.notes ? `${expected.notes} · Deposit ` : 'Deposit '))) throw new Error('This appointment was already checked out with different tender or totals.');
}

const checkoutInclude = {
  shop: true,
  customer: true,
  barber: true,
  service: true,
  transaction: { include: { lineItems: true } },
  queueEntry: true,
  chair: true,
} satisfies Prisma.AppointmentInclude;

export default async function checkoutAppointment(
  _root: unknown,
  args: Args,
  context: CheckoutContext
) {
  if (!permissions.canManagePayments({ session: context.session })) {
    return { success: false, error: 'Not authorized to process checkout.', transaction: null, appointment: null };
  }
  if (!args.appointmentId?.trim()) {
    return { success: false, error: 'Appointment is required.', transaction: null, appointment: null };
  }

  try {
    // Authorize first; the appointment body is only read inside the caller's shop.
    const activeShopId = await requireCurrentShopPermission(context.session, 'canManagePayments');
    const preview = await context.prisma.appointment.findFirst({
      where: { id: args.appointmentId, shopId: activeShopId },
      include: checkoutInclude,
    });
    if (!preview || !preview.shopId) throw new Error('Appointment not found.');
    if (['cancelled', 'no_show'].includes(String(preview.status))) {
      throw new Error('Cancelled or no-show appointments cannot be checked out.');
    }

    const paymentMethod = clean(args.paymentMethod) || 'cash';
    const packageBalanceId = clean(args.packageBalanceId);
    // Card is tender taken on the shop's own terminal and recorded here; no
    // online card settlement is connected.
    if (!['cash', 'card', 'package'].includes(paymentMethod)) throw new Error('Choose cash, card or a prepaid visit.');
    if (preview.shop.currencyCode !== 'USD') throw new Error('This release supports USD settlement only.');
    if (preview.price == null) throw new Error('This legacy appointment has no agreed price. Resolve its commercial evidence before checkout.');
    const subtotal = paymentMethod === 'package' ? 0 : money(preview.price);
    const tipAmount = money(args.tipAmount);
    const discountAmount = Math.min(money(args.discountAmount), subtotal);
    const taxAmount = money(args.taxAmount);
    const total = Math.max(0, subtotal + tipAmount + taxAmount - discountAmount);

    if (!Number.isSafeInteger(total) || total > 2_000_000_000) throw new Error('Checkout total exceeds the supported limit.');
    if (paymentMethod === 'package' && total > 0) throw new Error('Package tender covers a visit only. Collect tips/tax separately; mixed tender is not supported.');
    if (clean(args.paymentSessionId)) throw new Error('Processor settlement is not enabled for this cash-only release.');
    const idempotencyKey = clean(args.idempotencyKey);
    if (idempotencyKey.length > 200) throw new Error('Checkout request key is too long.');
    const commandKeyHash = idempotencyKey ? hashPublicAccessToken(idempotencyKey) : null;
    const replayInput = { paymentMethod, tipAmount, discountAmount, taxAmount, total, packageBalanceId, paymentSessionId: clean(args.paymentSessionId), notes: clean(args.notes) };
    if (preview.transactionId && preview.paymentStatus === 'paid' && preview.transaction) {
      assertCheckoutReplay(preview.transaction, replayInput);
      return { success: true, error: null, transaction: preview.transaction, appointment: preview };
    }

    const result = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client as Prisma.TransactionClient;
      await transaction.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
        'barbershop-checkout',
        preview.id
      );
      const shopId = await requireCurrentShopPermission(context.session, 'canManagePayments', transaction);
      const appointment = await transaction.appointment.findFirst({
        where: { id: preview.id, shopId },
        include: checkoutInclude,
      });
      if (!appointment || !appointment.shopId) throw new Error('Appointment not found.');
      if (appointment.price !== preview.price || appointment.shop.currencyCode !== 'USD') throw new Error('The agreed price or currency changed. Refresh before checkout.');

      if (appointment.transactionId && appointment.paymentStatus === 'paid') {
        const replayTransaction = await transaction.checkoutTransaction.findUniqueOrThrow({ where: { id: appointment.transactionId }, include: { lineItems: true } });
        assertCheckoutReplay(replayTransaction, replayInput);
        if (commandKeyHash) {
          const event = await transaction.lifecycleOutboxEvent.findUnique({ where: { eventKey: `checkout:${replayTransaction.id}:paid:v1` } });
          const saved = (event?.payload as { data?: { command?: { keyHash?: string | null } } } | null)?.data?.command?.keyHash;
          if (saved && saved !== commandKeyHash) throw new Error('This appointment was already checked out by another request.');
        }
        return { appointment, transaction: replayTransaction };
      }
      if (appointment.status !== 'in_chair') {
        throw new Error('Only an in-chair appointment can be completed at checkout.');
      }
      if (!appointment.barberId || !appointment.serviceId || !appointment.customerId) throw new Error('Completion authority linkage is incomplete.');
      const executionRows = await transaction.$queryRawUnsafe<Array<{ executionAuthoritySnapshot: PractitionerAuthoritySnapshot | null; serviceStartedAt: Date | null }>>('SELECT "executionAuthoritySnapshot", "serviceStartedAt" FROM "Appointment" WHERE id = $1 LIMIT 1', appointment.id);
      if (!executionRows[0]?.executionAuthoritySnapshot || !executionRows[0].serviceStartedAt) throw new Error('Recorded execution authority is required before completion.');
      assertAuthorityMatches(executionRows[0].executionAuthoritySnapshot, { shopId: appointment.shopId, barberId: appointment.barberId, serviceId: appointment.serviceId, at: executionRows[0].serviceStartedAt });
      const completionAuthority = await requireEffectivePractitionerAuthority(transaction, { shopId: appointment.shopId, barberId: appointment.barberId, serviceId: appointment.serviceId, at: new Date() });
      const waiver = await getAppointmentWaiverRequirement(transaction, appointment.id);
      if (waiver.required) await requireSignedWaiver(transaction, { appointmentId: appointment.id, serviceId: appointment.serviceId, customerId: appointment.customerId, templateHash: waiver.templateHash });

      let packageBalance = null;
      if (paymentMethod === 'package') {
        if (!packageBalanceId) throw new Error('Select an active package or membership balance before using package tender.');
        packageBalance = await transaction.customerPackage.findUnique({
          where: { id: packageBalanceId },
          include: { servicePackage: { include: { items: { select: { serviceId: true } } } }, membershipPlan: true },
        });
        if (!packageBalance || packageBalance.shopId !== appointment.shopId || packageBalance.status !== 'active') {
          throw new Error('Selected package balance is not active for this shop.');
        }
        if (packageBalance.customerId !== appointment.customerId || Number(packageBalance.remainingVisits || 0) < 1) {
          throw new Error('Selected package does not belong to this customer or has no visits remaining.');
        }
        assertPackageRedeemableForService(packageBalance, appointment.serviceId, new Date());
      }

      let paymentSession = null;
      if (clean(args.paymentSessionId)) {
        paymentSession = await transaction.paymentSession.findUnique({ where: { id: clean(args.paymentSessionId) } });
        if (!paymentSession || paymentSession.shopId !== appointment.shopId || paymentSession.appointmentId !== appointment.id) {
          throw new Error('Selected payment session does not belong to this appointment and shop.');
        }
        if (paymentSession.status !== 'captured' || Number(paymentSession.amount) !== total) {
          throw new Error('Payment session must be captured for the exact checkout total.');
        }
      }

      const completedAt = new Date();
      // A deposit paid online is part of this receipt's total; staff collect the balance.
      const depositSession = !paymentSession && appointment.paymentStatus === 'deposit_paid'
        ? await transaction.paymentSession.findFirst({ where: { appointmentId: appointment.id, status: 'captured', transaction: null }, orderBy: { capturedAt: 'desc' } })
        : null;
      const depositNote = depositSession ? `Deposit ${(depositSession.amount / 100).toFixed(2)} paid online` : '';
      const checkout = await transaction.checkoutTransaction.create({
        data: {
          shopId: appointment.shopId,
          customerId: appointment.customerId,
          barberId: appointment.barberId,
          appointments: { connect: { id: appointment.id } },
          status: 'paid',
          subtotal,
          tipAmount,
          taxAmount,
          discountAmount,
          total,
          paymentMethod: paymentMethod as Prisma.CheckoutTransactionCreateInput['paymentMethod'],
          providerPaymentId: paymentSession?.providerPaymentId || depositSession?.providerPaymentId || '',
          packageBalanceId: packageBalance?.id,
          paymentSessionId: paymentSession?.id || depositSession?.id,
          completedAt,
          currencyCode: 'USD',
          merchantSnapshot: { name: appointment.shop.name, legalName: appointment.shop.legalName, address: appointment.shop.address, phone: appointment.shop.phone, timezone: appointment.shop.timezone },
          taxRuleSnapshot: { mode: 'operator_entered', amount: taxAmount },
          notes: [clean(args.notes), depositNote].filter(Boolean).join(' · '),
        },
      });

      const snapshot = buildAppointmentLineItemSnapshot(appointment, packageBalance);
      const lineItem = await transaction.appointmentLineItem.create({
        data: {
          appointmentId: appointment.id,
          transactionId: checkout.id,
          serviceId: appointment.serviceId,
          ...snapshot,
          modifiers: snapshot.modifiers as Prisma.InputJsonValue,
        },
      });

      if (packageBalance) {
        await consumePackageVisitInTransaction(transaction, {
          customerPackageId: packageBalance.id,
          appointmentId: appointment.id,
          transactionId: checkout.id,
        });
      } else {
        await transaction.appointment.update({
          where: { id: appointment.id },
          data: { status: 'completed', paymentStatus: 'paid', transactionId: checkout.id },
        });
      }

      await transaction.$executeRawUnsafe('UPDATE "Appointment" SET "serviceCompletedAt" = $2 WHERE id = $1', appointment.id, completedAt);

      if (tipAmount > 0 && appointment.barberId) {
        await transaction.tip.create({
          data: {
            shopId: appointment.shopId,
            tipNumber: `tip-${checkout.id}`,
            barberId: appointment.barberId,
            customerId: appointment.customerId,
            transactionId: checkout.id,
            appointmentId: appointment.id,
            amount: tipAmount,
            paymentMethod: paymentMethod === 'cash' ? 'cash' : 'card',
            paidAt: completedAt,
            metadata: { source: 'checkoutAppointment' },
          },
        });
      }

      const commission = calculateServiceCommission({
        subtotal,
        discountAmount,
        rateBps: appointment.barber?.serviceCommissionRateBps || 0,
      });
      if (commission.commissionAmount > 0 && appointment.barberId) {
        await transaction.commission.create({
          data: {
            shopId: appointment.shopId,
            commissionNumber: `commission-${checkout.id}`,
            barberId: appointment.barberId,
            transactionId: checkout.id,
            appointmentId: appointment.id,
            status: 'projected',
            serviceAmount: commission.serviceAmount,
            productAmount: 0,
            commissionRate: commission.commissionRate,
            commissionAmount: commission.commissionAmount,
            metadata: { source: 'checkoutAppointment' },
          },
        });
      }

      if (appointment.queueEntry?.id) {
        await transaction.walkInQueueEntry.update({
          where: { id: appointment.queueEntry.id },
          data: { status: 'served' },
        });
      }
      if (appointment.customerId) {
        await transaction.customer.update({ where: { id: appointment.customerId }, data: { lastVisitAt: completedAt } });
      }

      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId,
        eventKey: `checkout:${checkout.id}:paid:v1`,
        eventType: 'checkout.paid',
        aggregateType: 'checkout_transaction',
        aggregateId: checkout.id,
        shopId: appointment.shopId,
        occurredAt: completedAt,
        data: {
          checkout: { id: checkout.id, subtotal, tipAmount, taxAmount, discountAmount, total, paymentMethod },
          appointment: { id: appointment.id, serviceId: appointment.serviceId, barberId: appointment.barberId, completionAuthority },
          lineItem: { id: lineItem.id, ...snapshot },
          settlement: { providerPaymentId: paymentSession?.providerPaymentId || '' },
          command: { keyHash: commandKeyHash, actorId: context.session?.itemId ?? null },
        },
      }));

      const updatedAppointment = await transaction.appointment.findUnique({
        where: { id: appointment.id },
        include: { customer: true, barber: true, service: true, transaction: { include: { lineItems: true } } },
      });
      return { appointment: updatedAppointment, transaction: { ...checkout, lineItems: [lineItem] } };
    });

    return { success: true, error: null, transaction: result.transaction, appointment: result.appointment };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to checkout appointment.',
      transaction: null,
      appointment: null,
    };
  }
}
