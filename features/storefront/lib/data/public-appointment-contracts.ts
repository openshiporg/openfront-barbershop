import { gql } from 'graphql-request';
import type { PublicBookingEligibility } from '../../../shared/public-booking-eligibility';

export type StorefrontBookedAppointment = {
  id: string;
  bookingEligibility?: PublicBookingEligibility | null;
  bookingTimezone?: string | null;
  startsAt?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
  depositAmount?: number | null;
  service?: { id: string; name?: string | null; durationMinutes?: number | null; price?: number | null } | null;
  barber?: { id: string; displayName?: string | null; chairNumber?: string | null } | null;
};

export type CreateBookingResult = {
  success: boolean;
  disposition?: 'accepted' | 'closed' | 'unresolved' | 'rejected';
  error?: string | null;
  accessToken?: string | null;
  appointment?: StorefrontBookedAppointment | null;
};

const GUEST_BOOKING_RESULT_FIELDS = `
  success disposition error accessToken
  appointment {
    bookingEligibility bookingTimezone id startsAt status paymentStatus depositAmount
    service { id name durationMinutes price }
    barber { id displayName chairNumber }
  }
`;

export const CREATE_STOREFRONT_BOOKING_MUTATION = gql`
  mutation CreateOnlineBooking($requestKey: String!, $guestProof: String!, $requestBody: String!) {
    createOnlineBooking(requestKey: $requestKey, guestProof: $guestProof, requestBody: $requestBody) { ${GUEST_BOOKING_RESULT_FIELDS} }
  }
`;

export const RECOVER_GUEST_BOOKING_MUTATION = gql`
  mutation RecoverGuestBooking($requestKey: String!, $guestProof: String!, $requestBody: String!, $closeIfAbsent: Boolean) {
    recoverGuestBooking(requestKey: $requestKey, guestProof: $guestProof, requestBody: $requestBody, closeIfAbsent: $closeIfAbsent) { ${GUEST_BOOKING_RESULT_FIELDS} }
  }
`;

export const PUBLIC_APPOINTMENT_QUERY = gql`
  query PublicAppointment($appointmentId: ID!, $accessToken: String) {
    getPublicAppointment(appointmentId: $appointmentId, accessToken: $accessToken) {
      id
      startsAt
      endsAt
      durationMinutes
      status
      source
      paymentStatus
      price
      depositAmount
      customerNotes
      bookingEligibility
      bookingTimezone
      waiverRequired
      waiverTemplateKey
      waiverTemplateVersion
      waiverTemplateText
      waiverTemplateHash
      waiverSigned
      customer {
        id
        firstName
        lastName
        packageBalances { id remainingVisits status expiresAt servicePackageName membershipPlanName }
      }
      barber { id displayName imagePath chairNumber }
      service { id name description imagePath durationMinutes price depositRequired depositAmount }
      lineItems { id title price durationMinutes imagePath modifiers barberName barberChairNumber packageBalanceId packageName packageVisitsConsumed }
      transaction { id status total formattedTotal paymentMethod completedAt refundedAmount formattedRefundedAmount refundedAt }
    }
  }
`;

export const MANAGE_PUBLIC_APPOINTMENT_MUTATION = gql`
  mutation ManagePublicAppointment($appointmentId: ID!, $accessToken: String, $action: String!, $startsAt: String, $reason: String!, $idempotencyKey: String!, $preview: Boolean, $acceptedFeeAmount: Int) {
    managePublicAppointment(appointmentId: $appointmentId, accessToken: $accessToken, action: $action, startsAt: $startsAt, reason: $reason, idempotencyKey: $idempotencyKey, preview: $preview, acceptedFeeAmount: $acceptedFeeAmount) { success error data }
  }
`;

export const SIGN_PUBLIC_WAIVER_MUTATION = gql`
  mutation SignPublicWaiver($appointmentId: ID!, $accessToken: String, $signerName: String!, $signerRole: String!, $guardianName: String, $affirmation: Boolean!, $idempotencyKey: String!) {
    signPublicWaiver(appointmentId: $appointmentId, accessToken: $accessToken, signerName: $signerName, signerRole: $signerRole, guardianName: $guardianName, affirmation: $affirmation, idempotencyKey: $idempotencyKey) { success error data }
  }
`;

export function normalizeCreateBookingResult(result: CreateBookingResult) {
  if (!result.success) {
    const disposition = result.disposition === 'closed' || result.disposition === 'rejected' ? result.disposition : 'unresolved' as const;
    return { success: false as const, disposition, error: result.error || 'We couldn’t confirm whether your booking request went through. Check again before booking another time.' };
  }
  if (!result.appointment?.id || !result.accessToken) {
    return { success: false as const, disposition: 'unresolved' as const, error: 'We couldn’t confirm whether your booking request went through. Check again before booking another time.' };
  }
  return { success: true as const, disposition: 'accepted' as const, appointment: result.appointment, accessToken: result.accessToken };
}
