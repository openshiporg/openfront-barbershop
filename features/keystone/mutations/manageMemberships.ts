import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';

import { permissions, type Session } from '../access';
import { buildLifecycleEnvelope, enqueueLifecycleEvent } from '../utils/lifecycleOutbox';
import { runSerializableTransaction } from '../utils/serializableTransaction';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';
import { assertUsdSettlementCurrency } from '../utils/supportedSettlementCurrency';

const ACTIONS = new Set(['purchase', 'purchase_package', 'renew', 'pause', 'resume', 'cancel']);
const PAID_ACTIONS = new Set(['purchase', 'purchase_package', 'renew']);
// Card/gift-card tenders require processor or ledger evidence that this bounded
// command does not own. Until a membership-capable adapter is registered, only
// operator-confirmed cash may become an immediately paid membership transaction.
const PAYMENT_METHODS = new Set(['cash']);

type Context = { session?: Session; prisma: PrismaClient };
type Args = {
  action: string;
  customerId?: string | null;
  membershipPlanId?: string | null;
  servicePackageId?: string | null;
  customerPackageId?: string | null;
  paymentMethod?: string | null;
  reason?: string | null;
  idempotencyKey: string;
};

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function membershipEventType(action: string) {
  return action === 'purchase' || action === 'purchase_package' ? 'purchased' : action === 'renew' ? 'renewed' : action === 'pause' ? 'paused' : action === 'resume' ? 'resumed' : 'cancelled';
}

/** Calendar months in UTC, clamped to the last day of the target month so a
 * term starting Jan 31 ends Feb 28/29 rather than rolling into March. */
function addCalendarMonths(from: Date, months: number) {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(from.getUTCDate(), lastDay), from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds(), from.getUTCMilliseconds()));
}

function termEnd(from: Date, interval: string) {
  return addCalendarMonths(from, interval === 'annual' ? 12 : interval === 'quarterly' ? 3 : 1);
}

export default async function manageMembership(_root: unknown, args: Args, context: Context) {
  if (!permissions.canManageMemberships({ session: context.session })) {
    return { success: false, error: 'Not authorized to manage memberships.', membership: null };
  }
  const action = args.action?.trim();
  const idempotencyKey = args.idempotencyKey?.trim();
  const targetMissing = action === 'purchase' ? !args.membershipPlanId : action === 'purchase_package' ? !args.servicePackageId : !args.customerPackageId;
  if (!ACTIONS.has(action) || !idempotencyKey || idempotencyKey.length > 200 || !args.customerId || targetMissing) {
    return { success: false, error: 'Customer, target membership, valid action, and idempotency key are required.', membership: null };
  }
  const paid = PAID_ACTIONS.has(action);
  if (paid && !permissions.canManagePayments({ session: context.session })) {
    return { success: false, error: 'Taking payment for a membership or package requires payment permission.', membership: null };
  }

  try {
    const shopId = await requireCurrentShopPermission(context.session, 'canManageMemberships');
    const result = await runSerializableTransaction(context.prisma, async (transactionValue) => {
      const transaction = transactionValue as Prisma.TransactionClient;
      // Authority is rechecked under row locks at the commit boundary.
      await requireCurrentShopPermission(context.session, 'canManageMemberships', transaction);
      if (paid) await requireCurrentShopPermission(context.session, 'canManagePayments', transaction);
      const commandHash = hash(idempotencyKey);
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-membership', commandHash);
      const replay = await transaction.membershipEvent.findUnique({ where: { idempotencyKeyHash: commandHash }, include: { customerPackage: true, transaction: true } });
      if (replay) {
        const expectedPaymentMethod = paid ? (args.paymentMethod || 'cash') : null;
        if (expectedPaymentMethod) assertUsdSettlementCurrency(replay.transaction?.currencyCode);
        if (replay.shopId !== shopId
          || replay.eventType !== membershipEventType(action)
          || replay.customerId !== args.customerId
          || (action === 'purchase' && replay.membershipPlanId !== args.membershipPlanId)
          || (action === 'purchase_package' && replay.customerPackage?.servicePackageId !== args.servicePackageId)
          || (!action.startsWith('purchase') && replay.customerPackageId !== args.customerPackageId)
          || (expectedPaymentMethod && replay.transaction?.paymentMethod !== expectedPaymentMethod)
          || replay.reason !== (args.reason?.trim() || '')) {
          throw new Error('Membership idempotency key was reused for a different command.');
        }
        return replay.customerPackage;
      }

      const customer = await transaction.customer.findFirst({ where: { id: args.customerId!, shopId } });
      if (!customer) throw new Error('Customer was not found in the active shop.');
      const now = new Date();

      if (action === 'purchase_package') {
        const paymentMethod = args.paymentMethod || 'cash';
        if (!PAYMENT_METHODS.has(paymentMethod)) throw new Error('Package card and gift-card tenders require captured provider or ledger evidence; record cash or use a connected adapter.');
        const servicePackage = await transaction.servicePackage.findFirst({ where: { id: args.servicePackageId!, shopId }, include: { items: { include: { service: { select: { id: true, name: true, shopId: true } } } } } });
        if (!servicePackage) throw new Error('Service package was not found in the active shop.');
        if (servicePackage.status !== 'active') throw new Error('Only active service packages can be sold.');
        const items = servicePackage.items.filter((item) => item.service?.shopId === shopId);
        const visits = items.reduce((total, item) => total + Math.max(0, item.quantity || 0), 0);
        if (!items.length || visits < 1) throw new Error('This package has no included services.');
        const shop = await transaction.shop.findUnique({ where: { id: shopId }, select: { currencyCode: true } });
        assertUsdSettlementCurrency(shop?.currencyCode);
        await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-membership-balance', `${customer.id}:package:${servicePackage.id}`);
        const amount = servicePackage.price;
        const sale = await transaction.checkoutTransaction.create({ data: {
          shopId, customerId: customer.id, status: 'paid', subtotal: amount, total: amount, currencyCode: 'USD',
          paymentMethod: paymentMethod as never, completedAt: now,
          notes: `Package purchase · ${servicePackage.name} · ${items.map((item) => `${item.quantity}× ${item.service?.name ?? 'service'}`).join(', ')}`,
        } });
        const balance = await transaction.customerPackage.create({ data: {
          shopId, customerId: customer.id, servicePackageId: servicePackage.id, remainingVisits: visits,
          status: 'active', startsAt: now, autoRenew: false,
        } });
        await transaction.packageUsage.create({ data: {
          customerPackageId: balance.id, transactionId: sale.id, usageType: 'grant', visitsDelta: visits,
          balanceAfter: visits, reason: `purchase · ${servicePackage.name}`,
          referenceKey: `membership:${commandHash}:grant`, occurredAt: now,
        } });
        const event = await transaction.membershipEvent.create({ data: {
          shopId, customerId: customer.id, customerPackageId: balance.id, transactionId: sale.id, idempotencyKeyHash: commandHash,
          eventType: 'purchased', planNameSnapshot: servicePackage.name, amount, visitsDelta: visits, resultingVisits: visits,
          occurredAt: now, reason: args.reason?.trim() || '',
        } });
        await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId,
          eventKey: `membership:${event.id}:purchased:v1`, eventType: 'service_package.purchased',
          aggregateType: 'customer_package', aggregateId: balance.id, shopId, occurredAt: now,
          data: { servicePackage: { id: balance.id, packageId: servicePackage.id, amount, visits, actorId: context.session?.itemId ?? null } },
        }));
        return balance;
      }

      let membership = args.customerPackageId
        ? await transaction.customerPackage.findFirst({ where: { id: args.customerPackageId, shopId }, include: { membershipPlan: true } })
        : null;
      if (args.customerPackageId && !membership) throw new Error('Membership was not found in the active shop.');
      const plan = args.membershipPlanId
        ? await transaction.membershipPlan.findFirst({ where: { id: args.membershipPlanId, shopId } })
        : membership?.membershipPlan ?? null;
      if (!plan || plan.shopId !== shopId) throw new Error('Membership plan was not found in the active shop.');
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'barbershop-membership-balance', membership?.id || `${customer.id}:${plan.id}`);
      if (action === 'purchase') {
        if (plan.status !== 'active') throw new Error('Only active membership plans can be purchased.');
        const existingMembership = await transaction.customerPackage.findFirst({ where: { shopId, customerId: customer.id, membershipPlanId: plan.id, status: { in: ['active', 'paused'] } } });
        if (existingMembership) throw new Error('Customer already has an active or paused balance for this membership plan.');
      }
      if (membership && (membership.membershipPlanId !== plan.id || membership.customerId !== customer.id)) {
        throw new Error('Membership relationships must belong to the active shop.');
      }
      if (paid) {
        const shop = await transaction.shop.findUnique({ where: { id: shopId }, select: { currencyCode: true } });
        assertUsdSettlementCurrency(shop?.currencyCode);
      }

      let transactionId: string | null = null;
      let visitsDelta = 0;
      let amount = 0;
      if (paid) {
        if (action === 'purchase' && membership) throw new Error('Purchase cannot target an existing membership.');
        if (action === 'renew' && !membership) throw new Error('Renew requires an existing membership.');
        if (membership?.status === 'cancelled') throw new Error('A cancelled membership cannot be renewed.');
        const paymentMethod = args.paymentMethod || 'cash';
        if (!PAYMENT_METHODS.has(paymentMethod)) throw new Error('Membership card and gift-card tenders require captured provider or ledger evidence; record cash or use a connected membership-capable adapter.');
        if (!Number.isInteger(plan.price) || plan.price < 0 || !Number.isInteger(plan.includedVisits) || (plan.includedVisits ?? 0) < 0) {
          throw new Error('This membership plan has an invalid price or included visits. Fix the plan before selling it.');
        }
        amount = plan.price;
        visitsDelta = plan.includedVisits ?? 0;
        const sale = await transaction.checkoutTransaction.create({
          data: {
            shopId, customerId: customer.id, status: 'paid', subtotal: amount, total: amount, currencyCode: 'USD',
            paymentMethod: paymentMethod as never,
            completedAt: now, notes: `${action === 'purchase' ? 'Membership purchase' : 'Membership renewal'} · ${plan.name} · ${plan.billingInterval} · ${visitsDelta} visits`,
          },
        });
        transactionId = sale.id;
        // A renewal extends the paid term from its current end, never shortens it.
        const termStart = membership?.expiresAt && membership.expiresAt > now ? membership.expiresAt : now;
        const termEndsAt = termEnd(termStart, String(plan.billingInterval));
        if (!membership) {
          membership = await transaction.customerPackage.create({
            data: {
              shopId, customerId: customer.id, membershipPlanId: plan.id, remainingVisits: visitsDelta,
              // Automatic billing is not implemented; renewals are recorded by staff.
              status: 'active', startsAt: now, expiresAt: termEndsAt, nextBillingAt: termEndsAt, autoRenew: false,
            },
            include: { membershipPlan: true },
          });
        } else {
          membership = await transaction.customerPackage.update({
            where: { id: membership.id },
            data: {
              remainingVisits: (membership.remainingVisits || 0) + visitsDelta, status: 'active', expiresAt: termEndsAt,
              nextBillingAt: termEndsAt, pausedAt: null, cancelledAt: null,
            },
            include: { membershipPlan: true },
          });
        }
        await transaction.packageUsage.create({ data: {
          customerPackageId: membership.id, transactionId, usageType: 'grant', visitsDelta,
          balanceAfter: membership.remainingVisits || 0, reason: `${action} · ${plan.name}`,
          referenceKey: `membership:${commandHash}:grant`, occurredAt: now,
        } });
      } else {
        if (!membership) throw new Error('This membership action requires an existing membership.');
        if (action === 'pause' && membership.status !== 'active') throw new Error('Only active memberships can be paused.');
        if (action === 'resume' && membership.status !== 'paused') throw new Error('Only paused memberships can be resumed.');
        if (action === 'cancel' && !['active', 'paused'].includes(String(membership.status))) throw new Error('Only active or paused memberships can be cancelled.');
        membership = await transaction.customerPackage.update({
          where: { id: membership.id },
          data: action === 'pause'
            ? { status: 'paused', pausedAt: now, autoRenew: false }
            : action === 'resume'
              ? { status: 'active', pausedAt: null }
              : { status: 'cancelled', cancelledAt: now, autoRenew: false, nextBillingAt: null },
          include: { membershipPlan: true },
        });
      }

      const eventType = membershipEventType(action);
      const event = await transaction.membershipEvent.create({ data: {
        shopId, customerId: customer.id, membershipPlanId: plan.id, customerPackageId: membership.id,
        transactionId, idempotencyKeyHash: commandHash,
        eventType: eventType as never,
        planNameSnapshot: plan.name, amount, visitsDelta, resultingVisits: membership.remainingVisits || 0,
        occurredAt: now, reason: args.reason?.trim() || '',
      } });
      await enqueueLifecycleEvent(transaction, buildLifecycleEnvelope({ actorId: context.session?.itemId,
        eventKey: `membership:${event.id}:${eventType}:v1`, eventType: `membership.${eventType}`,
        aggregateType: 'customer_package', aggregateId: membership.id, shopId, occurredAt: now,
        data: { membership: { id: membership.id, customerId: customer.id, planId: plan.id, action: eventType, amount, visitsDelta, resultingVisits: membership.remainingVisits || 0, status: membership.status, actorId: context.session?.itemId ?? null } },
      }));
      return membership;
    });
    if (!result) throw new Error('Membership evidence is missing its balance.');
    return { success: true, error: null, membership: { id: result.id, status: result.status, remainingVisits: result.remainingVisits, nextBillingAt: result.nextBillingAt?.toISOString() || null, autoRenew: result.autoRenew } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to manage membership.', membership: null };
  }
}
