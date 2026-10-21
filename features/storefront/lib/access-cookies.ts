'use server';

import { cookies } from 'next/headers';
import { ACCESS_TOKEN_PATTERN, accessCookieName, accessCookieOptions, type AccessKind } from './access-cookie-names';

/** Store the access token for a booking or queue entry this browser just created. */
export async function rememberAccess(kind: AccessKind, id: string, token: string) {
  const name = accessCookieName(kind, id);
  if (!name || !ACCESS_TOKEN_PATTERN.test(token)) return false;
  (await cookies()).set(name, token, accessCookieOptions(kind));
  return true;
}
