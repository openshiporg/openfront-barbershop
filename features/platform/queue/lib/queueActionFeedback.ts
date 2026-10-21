import { queueStatusLabels, type QueueStatus } from './queueTypes';

export type QueueActionResult = {
  success: boolean;
  error?: string | null;
  queueEntry?: { id?: string | null; status?: string | null } | null;
  seated?: { queueEntryId?: string | null; appointmentId?: string | null; status?: string | null } | null;
};

export const interruptedQueueStatusMessage =
  'Connection interrupted. The status change may have completed. Refresh the queue to verify before retrying.';

export const interruptedQueueSeatMessage =
  'Connection interrupted. Seating may have completed. Refresh the queue and booking board to check whether an appointment was created before trying again.';

function statusLabel(status: string) {
  return queueStatusLabels[status as QueueStatus] || status.replace(/_/g, ' ');
}

export function queueStatusFeedback(result: QueueActionResult, queueEntryId: string, targetStatus: QueueStatus) {
  if (!result.success) return result.error || 'Unable to update the queue entry.';

  const queueEntry = result.queueEntry;
  if (queueEntry?.id !== queueEntryId || !queueEntry.status) {
    return 'The status command reported success, but this queue entry could not be verified. Refresh the queue before taking another action.';
  }

  const expected = statusLabel(targetStatus);
  if (queueEntry.status !== targetStatus) {
    return `Queue entry is currently ${statusLabel(queueEntry.status)}, not ${expected}. Refresh the queue before taking another action.`;
  }

  if (targetStatus === 'texted') return 'Manual contact marked. No SMS was sent.';
  return `Queue status verified: ${expected}.`;
}

export function queueSeatFeedback(result: QueueActionResult, queueEntryId: string) {
  if (!result.success) return result.error || 'Unable to seat this walk-in.';

  const seated = result.seated;
  if (seated?.queueEntryId !== queueEntryId || !seated.appointmentId) {
    return 'The seating result could not be matched to this queue entry and appointment. Refresh the queue and booking board before taking another action.';
  }
  if (seated.status !== 'in_chair') {
    return `The seating result reports ${seated.status ? statusLabel(seated.status) : 'an unknown status'}, not In chair. Refresh the queue and booking board before taking another action.`;
  }

  return `Walk-in seated; appointment ${seated.appointmentId} created. Complete checkout through POS.`;
}
