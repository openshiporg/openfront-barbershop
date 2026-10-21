import { cookies } from 'next/headers';
import { accessCookieName, type AccessKind } from './access-cookie-names';

export async function readAccess(kind: AccessKind, id: string) {
  const name = accessCookieName(kind, id);
  return name ? (await cookies()).get(name)?.value || '' : '';
}
