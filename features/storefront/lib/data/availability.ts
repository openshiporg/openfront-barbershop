'use server';

import { gql } from 'graphql-request';
import { storefrontClient } from '../config';

export type StorefrontAvailabilitySlot = {
  time: string;
  startsAt?: string | null;
  available: boolean;
  barberId?: string | null;
  barberName?: string | null;
  blockedReason?: string | null;
};

/** A bookable start: the exact instant is the identity, the label is for display. */
export type StorefrontTimeSlot = { startsAt: string; label: string };

export type StorefrontAvailabilityResult = {
  slots: StorefrontTimeSlot[];
  error: string | null;
};

export async function getAvailableTimeSlots(
  barberId: string,
  date: string,
  serviceDuration: number,
  serviceId = ''
): Promise<StorefrontAvailabilityResult> {
  const query = gql`
    query CheckBarberAvailability($barberId: ID!, $date: String!, $serviceDuration: Int!, $serviceId: ID) {
      checkBarberAvailability(barberId: $barberId, date: $date, serviceDuration: $serviceDuration, serviceId: $serviceId) {
        time
        startsAt
        available
      }
    }
  `;

  try {
    const data = await storefrontClient.request<{ checkBarberAvailability: StorefrontAvailabilitySlot[] }>(query, {
      barberId,
      date,
      serviceDuration,
      serviceId,
    });

    return {
      slots: (data.checkBarberAvailability || [])
        .filter((slot): slot is StorefrontAvailabilitySlot & { startsAt: string } => slot.available && typeof slot.startsAt === 'string')
        .map((slot) => ({ startsAt: slot.startsAt, label: slot.time })),
      error: null,
    };
  } catch {
    return {
      slots: [],
      error: 'Availability could not be loaded. Try again or call the shop.',
    };
  }
}
