import type { Prisma } from '@prisma/client';

import { applyPackageDelta } from './balanceLedgers';
import { runSerializableTransaction } from './serializableTransaction';

type ConsumePackageVisitArgs = {
  customerPackageId: string;
  appointmentId: string;
  transactionId: string;
};

type RedeemableBalance = {
  status?: string | null;
  startsAt?: Date | null;
  expiresAt?: Date | null;
  servicePackageId?: string | null;
  servicePackage?: { items?: Array<{ serviceId: string | null }> } | null;
};

/** A balance can pay for a visit only while its term is current and, for a
 * prepaid service package, only for a service the package actually includes. */
export function assertPackageRedeemableForService(balance: RedeemableBalance, serviceId: string | null | undefined, at: Date) {
  if (balance.status !== 'active') throw new Error('Selected package balance is not active.');
  if (balance.startsAt && balance.startsAt > at) throw new Error('Selected package balance has not started yet.');
  if (balance.expiresAt && balance.expiresAt <= at) throw new Error('Selected package balance has expired.');
  if (balance.servicePackageId) {
    const included = (balance.servicePackage?.items ?? []).some((item) => item.serviceId && item.serviceId === serviceId);
    if (!included) throw new Error('This package does not include the service being checked out.');
  }
}

export async function consumePackageVisitInTransaction(
  transaction: Prisma.TransactionClient,
  { customerPackageId, appointmentId, transactionId }: ConsumePackageVisitArgs
) {
  const referenceKey = `checkout:${transactionId}:package:${customerPackageId}`;
    await transaction.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
      'barbershop-package',
      `package:${customerPackageId}`
    );
    const replay = await transaction.packageUsage.findUnique({ where: { referenceKey } });
    if (replay) return replay;

    const [balance, appointment] = await Promise.all([
      transaction.customerPackage.findUnique({ where: { id: customerPackageId }, include: { servicePackage: { include: { items: { select: { serviceId: true } } } } } }),
      transaction.appointment.findUnique({ where: { id: appointmentId }, select: { serviceId: true } }),
    ]);
    if (!balance) throw new Error('Selected package balance is not active.');
    assertPackageRedeemableForService(balance, appointment?.serviceId, new Date());
    const next = applyPackageDelta(balance.remainingVisits || 0, -1);
    const usage = await transaction.packageUsage.create({
      data: {
        customerPackageId,
        appointmentId,
        transactionId,
        usageType: 'consume',
        visitsDelta: -1,
        balanceAfter: next.after,
        reason: 'Appointment checkout',
        referenceKey,
        occurredAt: new Date(),
      },
    });
    const finalizedAt = new Date();
    await transaction.customerPackage.update({
      where: { id: customerPackageId },
      data: {
        remainingVisits: next.after,
        status: next.after === 0 ? 'used_up' : 'active',
        lastUsedAt: finalizedAt,
      },
    });
    await transaction.checkoutTransaction.update({
      where: { id: transactionId },
      data: { status: 'paid', completedAt: finalizedAt },
    });
    await transaction.appointment.update({
      where: { id: appointmentId },
      data: { status: 'completed', paymentStatus: 'paid', transactionId },
    });
  return usage;
}

/** `prisma` must be the trusted Keystone `context.prisma`; there is no default client. */
export async function consumePackageVisit(prisma: Parameters<typeof runSerializableTransaction>[0], args: ConsumePackageVisitArgs) {
  return runSerializableTransaction(prisma, async (client) =>
    consumePackageVisitInTransaction(client as Prisma.TransactionClient, args)
  );
}
