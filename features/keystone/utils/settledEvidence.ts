type MutationOperation = 'update' | 'delete';

export function settledAppointmentMutationError(
  existingItem: { paymentStatus?: unknown },
  resolvedData: Record<string, unknown>,
  operation: MutationOperation
) {
  const status = String(existingItem.paymentStatus || '');
  if (!['paid', 'refunded'].includes(status)) return null;
  if (operation === 'delete') return 'Settled appointments cannot be deleted.';

  const changedKeys = Object.keys(resolvedData).filter((key) => key !== 'updatedAt');
  const isPaidToRefunded = status === 'paid'
    && changedKeys.length === 1
    && changedKeys[0] === 'paymentStatus'
    && resolvedData.paymentStatus === 'refunded';
  return isPaidToRefunded ? null : 'Settled appointment evidence is immutable.';
}

export function settledCommissionMutationError(
  existingItem: { status?: unknown },
  operation: MutationOperation
) {
  if (existingItem.status !== 'paid') return null;
  return operation === 'delete'
    ? 'Paid commission evidence cannot be deleted.'
    : 'Paid commission evidence is immutable.';
}
