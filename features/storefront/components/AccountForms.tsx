'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { signInAccount, signUpAccount } from '../lib/data/account';

export function AccountForms() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [state, action, pending] = useActionState(mode === 'signin' ? signInAccount : signUpAccount, { error: null });
  return <section className="sf-panel mx-auto w-full max-w-lg p-6">
    <div className="mb-6 flex rounded-lg bg-black/5 p-1" role="group" aria-label="Account access">
      {(['signin', 'signup'] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={`min-h-11 flex-1 rounded-md px-4 ${mode === value ? 'bg-white shadow-sm' : ''}`}>{value === 'signin' ? 'Sign in' : 'Create account'}</button>)}
    </div>
    <form action={action} className="space-y-4">
      {mode === 'signup' ? <label className="block">Name<input className="sf-input mt-2 w-full" name="name" required maxLength={120} autoComplete="name" /></label> : null}
      <label className="block">Email<input className="sf-input mt-2 w-full" name="email" type="email" required maxLength={254} autoComplete="email" /></label>
      <label className="block">Password<input className="sf-input mt-2 w-full" name="password" type="password" required minLength={mode === 'signup' ? 10 : undefined} maxLength={1000} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></label>
      {mode === 'signin' ? <Link href="/account/reset" className="sf-link inline-flex min-h-11 items-center text-[var(--text-small)]">Forgot your password?</Link> : null}
      {state.error ? <p role="alert" className="break-words">{state.error}</p> : null}
      <button className="sf-btn sf-btn-primary w-full" disabled={pending}>{pending ? 'Saving…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
    </form>
  </section>;
}
