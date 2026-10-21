'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { redeemAccountPasswordReset, requestAccountPasswordReset } from '../lib/data/account';

/** Customer password recovery: request a link, or set a new password from one. */
export function AccountPasswordReset({ token }: { token: string }) {
  const [state, action, pending] = useActionState(token ? redeemAccountPasswordReset : requestAccountPasswordReset, { error: null, success: null });
  return <section className="sf-panel mx-auto w-full max-w-lg p-6">
    <h2 className="sf-display text-2xl">{token ? 'Choose a new password' : 'Reset your password'}</h2>
    <p className="mt-2 text-[var(--text-small)] text-[var(--color-ink-muted)]">{token ? 'Enter your account email and a new password.' : 'Enter your account email and we’ll send you a link to choose a new password.'}</p>
    {state.success ? <div className="mt-6 space-y-4" role="status"><p>{state.success}</p>{token ? <Link href="/account" className="sf-btn sf-btn-primary w-full">Sign in</Link> : null}</div> : <form action={action} className="mt-6 space-y-4">
      {token ? <input type="hidden" name="token" value={token} /> : null}
      <label className="block">Email<input className="sf-input mt-2 w-full" name="email" type="email" required maxLength={254} autoComplete="email" /></label>
      {token ? <label className="block">New password<input className="sf-input mt-2 w-full" name="password" type="password" required minLength={10} maxLength={1000} autoComplete="new-password" /></label> : null}
      {state.error ? <p role="alert" className="break-words">{state.error}</p> : null}
      <button className="sf-btn sf-btn-primary w-full" disabled={pending}>{pending ? 'Sending…' : token ? 'Set new password' : 'Send reset link'}</button>
    </form>}
    <Link href="/account" className="sf-link mt-4 inline-flex min-h-11 items-center text-[var(--text-small)]">Back to sign in</Link>
  </section>;
}
