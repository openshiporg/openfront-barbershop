import { StorefrontShell } from './StorefrontShell';
import { AccountPasswordReset } from '../components/AccountPasswordReset';

export default async function AccountResetPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams || {};
  const token = typeof params.token === 'string' ? params.token.slice(0, 500) : '';
  return <StorefrontShell allowUnavailableChildren><main id="main-content" className="sf-container py-10">
    <h1 className="sf-display mb-8 text-4xl">Account</h1>
    <AccountPasswordReset token={token} />
  </main></StorefrontShell>;
}
