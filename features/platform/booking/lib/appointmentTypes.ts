import type { PublicBookingEligibility } from '@/features/shared/public-booking-eligibility';

export type AppointmentStatus =
  | 'requested'
  | 'confirmed'
  | 'checked_in'
  | 'in_chair'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type AppointmentBoardCustomer = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
};

export type AppointmentBoardBarber = {
  id: string;
  workingDay?: boolean;
  dayStartMinute?: number | null;
  dayEndMinute?: number | null;
  displayName?: string | null;
  chairNumber?: string | null;
  bookingEnabled?: boolean | null;
};

export type AppointmentBoardService = {
  id: string;
  name?: string | null;
  durationMinutes?: number | null;
  price?: number | null;
  color?: string | null;
};

export type BookingServiceOption = {
  id: string;
  name?: string | null;
  durationMinutes?: number | null;
  price?: number | null;
  depositRequired?: boolean | null;
  specialistIds: string[];
};

export type AppointmentBoardItem = {
  id: string;
  bookingEligibility?: PublicBookingEligibility | null;
  startsAt?: string | null;
  endsAt?: string | null;
  durationMinutes?: number | null;
  status?: AppointmentStatus | null;
  source?: string | null;
  paymentStatus?: string | null;
  price?: number | null;
  depositAmount?: number | null;
  customerNotes?: string | null;
  internalNotes?: string | null;
  serviceTitleSnapshot?: string | null;
  barberNameSnapshot?: string | null;
  barberChairNumberSnapshot?: string | null;
  customer?: AppointmentBoardCustomer | null;
  barber?: AppointmentBoardBarber | null;
  service?: AppointmentBoardService | null;
};

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  requested: 'Requested',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  in_chair: 'In chair',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};
