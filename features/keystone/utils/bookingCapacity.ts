import { runSerializableTransaction } from './serializableTransaction';

export type BookingCapacityResources = {
  serviceId: string;
  barberId: string;
  chairNumber?: string | null;
};

type AdvisoryLockTransaction = {
  $executeRawUnsafe(query: string, namespace: string, resource: string): Promise<unknown>;
};

export const MAX_BOOKING_CAPACITY_CANDIDATES = 100;

export function shopDayAppointmentCandidateFilter(start: Date, end: Date, occupiedBufferMinutes: number) {
  const bufferMinutes = Number.isFinite(occupiedBufferMinutes) ? Math.max(0, occupiedBufferMinutes) : 0;
  const earliestPriorEnd = new Date(start.getTime() - bufferMinutes * 60_000);
  // A nullable legacy end has no safe duration bound; retain it for the evaluator.
  return {
    startsAt: { lt: end },
    AND: [{
      OR: [
        { startsAt: { gte: start } },
        { endsAt: { gt: earliestPriorEnd } },
        { endsAt: null },
        // A guest still in the chair occupies it until completed.
        { status: 'in_chair' as const },
      ],
    }],
  };
}

export function assertAppointmentCandidateSetComplete(candidates: readonly unknown[]) {
  if (candidates.length > MAX_BOOKING_CAPACITY_CANDIDATES) {
    throw new Error('Availability could not be verified safely because too many appointments match this barber or chair. Try another date or contact the shop.');
  }
}

export function bookingResourceKeys(resources: BookingCapacityResources) {
  return [
    `service:${resources.serviceId}`,
    `staff:${resources.barberId}`,
    resources.chairNumber ? `chair:${resources.chairNumber}` : null,
  ].filter((value): value is string => Boolean(value)).sort();
}

export async function lockBookingResources(
  transaction: AdvisoryLockTransaction,
  resources: BookingCapacityResources
) {
  for (const resource of bookingResourceKeys(resources)) {
    await transaction.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
      'barbershop-booking',
      resource
    );
  }
}

export const runSerializableBookingTransaction = runSerializableTransaction;
