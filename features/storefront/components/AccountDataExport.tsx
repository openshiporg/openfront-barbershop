'use client';

import { useState } from 'react';
import { exportStorefrontAccountData } from '../lib/data/account';

export function AccountDataExport() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function download() {
    setPending(true); setMessage('');
    try {
      const result = await exportStorefrontAccountData();
      if (!result.success) { setMessage(result.error); return; }
      const url = URL.createObjectURL(new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'my-account-data.json'; link.click();
      URL.revokeObjectURL(url);
      setMessage('Your data was downloaded.');
    } catch { setMessage('Your data couldn’t be exported right now. Try again later.'); }
    finally { setPending(false); }
  }
  return <div>
    <button type="button" className="sf-btn sf-btn-ghost" disabled={pending} onClick={download}>{pending ? 'Preparing…' : 'Download my data'}</button>
    {message ? <p role="status" className="mt-2 text-[var(--text-small)]">{message}</p> : null}
  </div>;
}
