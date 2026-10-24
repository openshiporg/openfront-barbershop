import { appointmentStatusLabels, type AppointmentStatus } from './appointmentTypes';

export type AppointmentActionResult = {
  success: boolean;
  error?: string | null;
  appointment?: { id?: string | null; status?: string | null } | null;
  data?: { appointmentId?: string | null } | null;
};

export const interruptedAppointmentActionMessage =
  'Connection interrupted. The action may have completed. Refresh the booking board to verify its status before retrying.';

function statusLabel(status: string) {
  return appointmentStatusLabels[status as AppointmentStatus] || status.replace(/_/g, ' ');
}

export function appointmentStatusFeedback(
  result: AppointmentActionResult,
  appointmentId: string,
  targetStatus: AppointmentStatus,
) {
  if (!result.success) return result.error || 'Unable to update appointment.';

  const appointment = result.appointment;
  if (appointment?.id !== appointmentId || !appointment.status) {
    return 'The transition reported success, but this appointment status could not be verified. Refresh the booking board before taking another action.';
  }

  const expected = statusLabel(targetStatus);
  if (appointment.status !== targetStatus) {
    return `Appointment is currently ${statusLabel(appointment.status)}, not ${expected}. Refresh the booking board before taking another action.`;
  }

  return expected.charAt(0).toUpperCase() + expected.slice(1);
}

export function appointmentNoShowFeedback(result: AppointmentActionResult, appointmentId: string) {
  if (!result.success) return result.error || 'Unable to mark no-show.';
  if (result.data?.appointmentId !== appointmentId) {
    return 'The no-show result could not be matched to this appointment. Refresh the booking board before taking another action.';
  }
  return 'No-show evidence recorded for this appointment.';
}
