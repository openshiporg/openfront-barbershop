/**
 * Staff-side "possible duplicate" detection. Guests are never matched to an
 * existing record at booking time (contact details are not authentication), so
 * repeat guests become separate records; staff see a hint and decide.
 *
 * Phones compare on their last 10 digits so "(718) 555-0199" and "7185550199"
 * match; numbers under 7 digits are ignored. Emails compare trimmed, lowercase.
 */
export type ContactRow = { id: string; phone?: string | null; email?: string | null };

export function phoneKey(phone?: string | null) {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length >= 7 ? digits.slice(-10) : '';
}

export function emailKey(email?: string | null) {
  return (email || '').trim().toLowerCase();
}

export type DuplicateHint = { count: number; matchedOn: 'phone' | 'email' | 'phone and email'; search: string };

/** Other records sharing this customer's phone or email, or null. */
export function duplicateHint(customer: ContactRow, others: ContactRow[]): DuplicateHint | null {
  const phone = phoneKey(customer.phone);
  const email = emailKey(customer.email);
  if (!phone && !email) return null;
  let byPhone = false;
  let byEmail = false;
  const ids = new Set<string>();
  for (const other of others) {
    if (other.id === customer.id) continue;
    const samePhone = Boolean(phone) && phoneKey(other.phone) === phone;
    const sameEmail = Boolean(email) && emailKey(other.email) === email;
    if (samePhone) byPhone = true;
    if (sameEmail) byEmail = true;
    if (samePhone || sameEmail) ids.add(other.id);
  }
  if (!ids.size) return null;
  return {
    count: ids.size,
    matchedOn: byPhone && byEmail ? 'phone and email' : byPhone ? 'phone' : 'email',
    // Search by what matched so the directory lists both records for the merge.
    search: byPhone ? (customer.phone || '').trim() : (customer.email || '').trim(),
  };
}

/** Narrow candidate query (same last 4 phone digits, or same email); duplicateHint makes the exact match. */
export function duplicateCandidateWhere(customer: ContactRow) {
  const phone = phoneKey(customer.phone);
  const email = emailKey(customer.email);
  const or: Array<Record<string, unknown>> = [];
  if (phone) or.push({ phone: { contains: phone.slice(-4) } });
  if (email) or.push({ email: { equals: email, mode: 'insensitive' } });
  return or.length ? { id: { not: { equals: customer.id } }, OR: or } : null;
}
