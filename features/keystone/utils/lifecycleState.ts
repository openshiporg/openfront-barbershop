const APPOINTMENT_TRANSITIONS: Record<string, readonly string[]> = {
  requested: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['in_chair', 'cancelled', 'no_show'],
  in_chair: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
};

const QUEUE_TRANSITIONS: Record<string, readonly string[]> = {
  waiting: ['texted', 'left'],
  texted: ['waiting', 'left'],
  in_chair: ['served', 'left'],
  served: [],
  left: [],
};

export function assertAppointmentTransition(
  currentStatus: string,
  nextStatus: string,
  context: { paymentStatus?: string | null; startsAt?: Date | null; now?: Date } = {}
) {
  if (currentStatus === nextStatus) return;
  const allowed = APPOINTMENT_TRANSITIONS[currentStatus];
  if (!allowed) throw new Error('Appointment status is invalid.');
  if (allowed.length === 0) throw new Error('Terminal appointments cannot transition.');
  if (!allowed.includes(nextStatus)) throw new Error(`Appointment cannot transition from ${currentStatus} to ${nextStatus}.`);
  if (nextStatus === 'completed' && context.paymentStatus !== 'paid') {
    throw new Error('Appointments are completed by paid checkout, not by a raw status change.');
  }
  if (nextStatus === 'no_show' && context.startsAt && (context.now || new Date()) < context.startsAt) {
    throw new Error('An appointment cannot be marked no-show before its start time.');
  }
}

export function assertQueueTransition(currentStatus: string, nextStatus: string) {
  if (currentStatus === nextStatus) return;
  const allowed = QUEUE_TRANSITIONS[currentStatus];
  if (!allowed) throw new Error('Queue status is invalid.');
  if (allowed.length === 0) throw new Error('Terminal queue entries cannot transition.');
  if (nextStatus === 'in_chair') throw new Error('Use the seat walk-in command to enter a chair.');
  if (!allowed.includes(nextStatus)) throw new Error(`Queue entry cannot transition from ${currentStatus} to ${nextStatus}.`);
}
