'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { signInAccount, signUpAccount } from '../lib/data/account';

export function AccountForms() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [state, action, pending] = useActionState(mode === 'signin' ? signInAccount : signUpAccount, { error: null });
  return (
    <section className="grid gap-6">
      <div className="sf-track is-block" role="group" aria-label="Account access">
        {(['signin', 'signup'] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className="sf-pill is-flat">{value === 'signin' ? 'Sign in' : 'Create account'}</button>)}
      </div>
      <form action={action} className="sf-form">
        {mode === 'signup' ? <label className="sf-field"><span>Name</span><input className="sf-input" name="name" required maxLength={120} autoComplete="name" /></label> : null}
        <label className="sf-field"><span>Email</span><input className="sf-input" name="email" type="email" required maxLength={254} autoComplete="email" /></label>
        {mode === 'signup' ? <label className="sf-field"><span>Phone</span><input className="sf-input" name="phone" type="tel" inputMode="tel" required maxLength={40} autoComplete="tel" /></label> : null}
        <label className="sf-field"><span>Password</span><input className="sf-input" name="password" type="password" required minLength={mode === 'signup' ? 10 : undefined} maxLength={1000} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></label>
        {mode === 'signin' ? <Link href="/account/reset" className="sf-link sf-small inline-flex min-h-11 items-center justify-self-start">Forgot password</Link> : null}
        {state.error ? <p role="alert" className="sf-notice is-error">{state.error}</p> : null}
        <div className="sf-track is-block"><button className="sf-pill is-primary" disabled={pending}>{pending ? 'Saving…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button></div>
      </form>
    </section>
  );
}
