import type { Prisma } from '@prisma/client';

export function serializePaymentSession<T extends Record<string, unknown> | null>(session: T): T {
  if (!session) return session;
  const dateFields = ['expiresAt', 'capturedAt', 'cancelledAt', 'createdAt', 'updatedAt'] as const;
  const serialized: Record<string, unknown> = { ...session };
  for (const field of dateFields) {
    const value = serialized[field];
    if (value instanceof Date) serialized[field] = value.toISOString();
  }
  return serialized as T;
}

/** Sessions that still hold (or may still hold) part of the appointment's payable amount. */
export const OPEN_PAYMENT_SESSION_STATUSES = ['pending', 'authorized', 'captured', 'partially_refunded'] as const;

/**
 * Serializes every money writer for one appointment. Uses the same lock namespace
 * as cash checkout so a session command and a checkout cannot interleave.
 */
export async function lockAppointmentMoney(transaction: Prisma.TransactionClient, appointmentId: string | null | undefined) {
  if (!appointmentId) return;
  await transaction.$executeRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
    'barbershop-checkout',
    appointmentId
  );
}

export function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Appointment payment states that must never be overwritten by a session writer. */
export function appointmentSettledElsewhere(paymentStatus: unknown) {
  return ['paid', 'refunded'].includes(String(paymentStatus || ''));
}
