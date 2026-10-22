import { StorefrontShell } from './StorefrontShell';
import { AccountPasswordReset } from '../components/AccountPasswordReset';

export default async function AccountResetPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams || {};
  const token = typeof params.token === 'string' ? params.token.slice(0, 500) : '';
  return (
    <StorefrontShell allowUnavailableChildren>
      <main id="main-content" className="sf-container-narrow pb-[var(--space-3xl)]">
        <section className="sf-page-head">
          <p className="sf-eyebrow">Account</p>
          <h1 className="sf-display">{token ? 'New password' : 'Reset password'}</h1>
        </section>
        <div className="pt-8"><AccountPasswordReset token={token} /></div>
      </main>
    </StorefrontShell>
  );
}
