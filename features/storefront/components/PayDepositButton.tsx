'use client';

import { useState, useTransition } from 'react';
import { payDepositAction } from '../lib/data/deposits';

export function PayDepositButton({ appointmentId, label }: { appointmentId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-2">
      <div className="sf-actions">
        <button type="button" className="sf-btn is-accent" disabled={pending} onClick={() => { setError(null); startTransition(async () => { const result = await payDepositAction(appointmentId); if (result?.error) setError(result.error); }); }}>{pending ? 'Opening checkout…' : label}</button>
      </div>
      {error ? <p role="alert" className="sf-notice is-error">{error}</p> : null}
    </div>
  );
}
