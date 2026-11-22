'use client';

import { useActionState } from 'react';
import { updateAccountDetails } from '../lib/data/account';

/** Saved details on the account page: name and phone fill in bookings; the password change is optional. */
export function AccountDetails({ name, phone, email }: { name: string; phone: string; email: string }) {
  const [state, action, pending] = useActionState(updateAccountDetails, { error: null, success: null });
  return (
    <form action={action} className="sf-form">
      <label className="sf-field"><span>Name</span><input className="sf-input" name="name" required maxLength={120} autoComplete="name" defaultValue={name} /></label>
      <label className="sf-field"><span>Phone</span><input className="sf-input" name="phone" type="tel" inputMode="tel" required maxLength={40} autoComplete="tel" defaultValue={phone} /></label>
      <label className="sf-field"><span>Email</span><input className="sf-input" type="email" value={email} readOnly aria-describedby="account-email-note" /></label>
      <p id="account-email-note" className="sf-small sf-muted">Your email is your sign-in. To change it, contact the shop.</p>
      <details className="sf-account-password">
        <summary>Change password</summary>
        <div className="sf-form pt-3">
          <label className="sf-field"><span>Current password</span><input className="sf-input" name="currentPassword" type="password" maxLength={1000} autoComplete="current-password" /></label>
          <label className="sf-field"><span>New password</span><input className="sf-input" name="newPassword" type="password" minLength={10} maxLength={1000} autoComplete="new-password" /></label>
        </div>
      </details>
      {state.error ? <p role="alert" className="sf-notice is-error">{state.error}</p> : null}
      {state.success ? <p role="status" className="sf-notice">{state.success}</p> : null}
      <div className="sf-actions"><button className="sf-btn is-primary" disabled={pending}>{pending ? 'Saving…' : 'Save details'}</button></div>
    </form>
  );
}
