import { formatPhone } from '../../lib/phone';

export type MergeCandidate = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  visits?: number | null;
  lastVisitAt?: string | null;
  createdAt?: string | null;
};

function day(value: string | null | undefined, timeZone: string) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric' }).format(date) : null;
}

/**
 * What tells one record apart from the others with the same name: visit count,
 * last visit (or created date when never visited), and the email when emails
 * differ across the choices. The phone is shown only when phones differ.
 */
export function candidateDetail(candidate: MergeCandidate, all: MergeCandidate[], timeZone: string) {
  const parts: string[] = [];
  const emails = new Set(all.map((other) => other.email || ''));
  const phones = new Set(all.map((other) => formatPhone(other.phone)));
  if (phones.size > 1 && candidate.phone) parts.push(formatPhone(candidate.phone));
  if (emails.size > 1 && candidate.email) parts.push(candidate.email);
  if (typeof candidate.visits === 'number') parts.push(`${candidate.visits} ${candidate.visits === 1 ? 'visit' : 'visits'}`);
  const last = day(candidate.lastVisitAt, timeZone);
  const created = day(candidate.createdAt, timeZone);
  if (last) parts.push(`last visit ${last}`);
  else if (created) parts.push(`added ${created}`);
  if (!parts.length && candidate.phone) parts.push(formatPhone(candidate.phone));
  return parts.join(' · ');
}
