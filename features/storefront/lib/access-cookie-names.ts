// Booking and queue access tokens live in HttpOnly cookies, so status links
// carry only the record id: nothing secret ends up in history or shared URLs.
export const ACCESS_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
export const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,200}$/;
export const ACCESS_KINDS = {
  appointment: { prefix: 'sf_appt_', maxAge: 60 * 60 * 24 * 180 },
  queue: { prefix: 'sf_queue_', maxAge: 60 * 60 * 24 * 2 },
} as const;
export type AccessKind = keyof typeof ACCESS_KINDS;

export function accessCookieName(kind: AccessKind, id: string) {
  return ACCESS_ID_PATTERN.test(id) ? `${ACCESS_KINDS[kind].prefix}${id}` : null;
}

export function accessCookieOptions(kind: AccessKind) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: ACCESS_KINDS[kind].maxAge };
}
