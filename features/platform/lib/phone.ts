/**
 * One display format for phone numbers across admin. US numbers (10 digits, or
 * 11 with a leading 1) read as (718) 555-0199; anything else is shown as typed,
 * trimmed, so international or partial numbers are never mangled. Display only:
 * stored values and tel: links keep the raw number.
 */
export function formatPhone(value?: string | null): string {
  const raw = value?.trim() || '';
  if (!raw) return '';
  if (/[a-z]/i.test(raw.replace(/\b(ext|x)\.?\s*\d+$/i, ''))) return raw;
  const digits = raw.replace(/\D/g, '');
  const us = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (us.length !== 10 || (raw.startsWith('+') && !raw.startsWith('+1'))) return raw;
  return `(${us.slice(0, 3)}) ${us.slice(3, 6)}-${us.slice(6)}`;
}
