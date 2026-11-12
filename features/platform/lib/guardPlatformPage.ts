import { notFound } from 'next/navigation';
import { getAuthenticatedUser } from '@/features/dashboard/actions/auth';
import { canUsePlatformPage, type PageAccessUser } from './pageAccess';

/** A platform page the signed-in role cannot use is a 404, the same as a page that does not exist. */
export async function guardPlatformPage(slug: string) {
  const response = await getAuthenticatedUser();
  const user = (response.success ? response.data?.authenticatedItem : null) as PageAccessUser;
  if (user && !canUsePlatformPage(user, slug)) notFound();
}
