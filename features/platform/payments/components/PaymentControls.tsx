'use client';

import { useState, useTransition } from 'react';
import { TransitionPills } from '@/features/platform/lib/forms';
import { Pill, Track } from '@/features/platform/lib/ui';
import { ensureManualProviderAction, setProviderInstalledAction, refundGiftCardAction, setUpStripeAction } from '../actions/payments';

export function SetUpManualPayments() {
  return <TransitionPills label="Payment setup" current="" options={[{ value: 'manual', label: 'Set up in-shop payments' }]} run={() => ensureManualProviderAction()} />;
}

export function ProviderInstall({ id, installed }: { id: string; installed: boolean }) {
  return <TransitionPills label="Provider" current={installed ? 'on' : 'off'} options={[{ value: 'on', label: 'Turn on' }, { value: 'off', label: 'Turn off' }]} run={(value) => setProviderInstalledAction(id, value === 'on')} />;
}

export function SetUpStripe() {
  return <TransitionPills label="Online payments" current="" options={[{ value: 'stripe', label: 'Set up Stripe' }]} run={() => setUpStripeAction()} />;
}

/** Two-step refund for an unused gift card; one request key per opened confirm, so a retry replays. */
export function RefundGiftCard({ paymentSessionId, amountLabel }: { paymentSessionId: string; amountLabel: string }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = () => start(async () => {
    const result = await refundGiftCardAction(paymentSessionId, key);
    if (!result.success) setError(result.error || 'The refund did not go through.'); else setKey('');
  });
  return (
    <div className="grid justify-items-end gap-1">
      <Track wrap>
        {key ? <>
          <Pill size="sm" variant="danger" disabled={pending} onClick={run}>{pending ? 'Refunding…' : `Refund ${amountLabel}`}</Pill>
          <Pill size="sm" variant="flat" disabled={pending} onClick={() => setKey('')}>Keep</Pill>
        </> : <Pill size="sm" onClick={() => { setError(null); setKey(crypto.randomUUID()); }}>Refund</Pill>}
      </Track>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
