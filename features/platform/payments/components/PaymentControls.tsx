'use client';

import { TransitionPills } from '@/features/platform/lib/forms';
import { ensureManualProviderAction, setProviderInstalledAction, setUpStripeAction } from '../actions/payments';

export function SetUpManualPayments() {
  return <TransitionPills label="Payment setup" current="" options={[{ value: 'manual', label: 'Set up in-shop payments' }]} run={() => ensureManualProviderAction()} />;
}

export function ProviderInstall({ id, installed }: { id: string; installed: boolean }) {
  return <TransitionPills label="Provider" current={installed ? 'on' : 'off'} options={[{ value: 'on', label: 'Turn on' }, { value: 'off', label: 'Turn off' }]} run={(value) => setProviderInstalledAction(id, value === 'on')} />;
}

export function SetUpStripe() {
  return <TransitionPills label="Online payments" current="" options={[{ value: 'stripe', label: 'Set up Stripe' }]} run={() => setUpStripeAction()} />;
}
