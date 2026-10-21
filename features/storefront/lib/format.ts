export function formatMoney(cents?: number | null) {
  const value = cents ?? 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100);
}

export function formatDuration(minutes?: number | null) {
  if (!minutes) return '—';
  return `${minutes} min`;
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function statusLabel(status?: string | null) {
  return status?.replace(/_/g, ' ') || 'unknown';
}
