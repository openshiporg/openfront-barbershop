'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { redeemAccountPasswordReset, requestAccountPasswordReset } from '../lib/data/account';

/** Customer password recovery: request a link, or set a new password from one. */
export function AccountPasswordReset({ token }: { token: string }) {
  const [state, action, pending] = useActionState(token ? redeemAccountPasswordReset : requestAccountPasswordReset, { error: null, success: null });
  return (
    <section className="grid gap-6">
      {state.success ? (
        <div className="grid gap-4" role="status">
          <p className="sf-notice">{state.success}</p>
          {token ? <div className="sf-track is-block"><Link href="/account" className="sf-pill is-primary">Sign in</Link></div> : null}
        </div>
      ) : (
        <form action={action} className="sf-form">
          {token ? <input type="hidden" name="token" value={token} /> : null}
          <label className="sf-field"><span>Email</span><input className="sf-input" name="email" type="email" required maxLength={254} autoComplete="email" /></label>
          {token ? <label className="sf-field"><span>New password</span><input className="sf-input" name="password" type="password" required minLength={10} maxLength={1000} autoComplete="new-password" /></label> : null}
          {state.error ? <p role="alert" className="sf-notice is-error">{state.error}</p> : null}
          <div className="sf-track is-block"><button className="sf-pill is-primary" disabled={pending}>{pending ? 'Sending…' : token ? 'Set new password' : 'Send reset link'}</button></div>
        </form>
      )}
      <Link href="/account" className="sf-link sf-small inline-flex min-h-11 items-center justify-self-start">Back to sign in</Link>
    </section>
  );
}
