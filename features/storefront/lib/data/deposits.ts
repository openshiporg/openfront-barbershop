'use server';

import { redirect } from 'next/navigation';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { storefrontClient } from '../config';
import { readAccess } from '../access-cookie-read';

export async function getOnlineDepositsEnabled(): Promise<boolean> {
  try {
    const data = await storefrontClient.request<{ getPublicPaymentOptions: { onlineDeposits: boolean } }>('query { getPublicPaymentOptions { onlineDeposits } }');
    return data.getPublicPaymentOptions.onlineDeposits;
  } catch { return false; }
}

type Command = { success: boolean; error: string | null; data: Record<string, unknown> | null };

/** Sends the customer to Stripe Checkout for the visit's deposit. */
export async function payDepositAction(appointmentId: string): Promise<{ error: string }> {
  const accessToken = await readAccess('appointment', appointmentId);
  const result = await keystoneClient<{ startDepositCheckout: Command }>('mutation($id: ID!, $token: String) { startDepositCheckout(appointmentId: $id, accessToken: $token) { success error data } }', { id: appointmentId, token: accessToken || null });
  const outcome = result.success ? result.data.startDepositCheckout : null;
  const url = typeof outcome?.data?.url === 'string' ? outcome.data.url : '';
  if (!outcome?.success || !url.startsWith('https://checkout.stripe.com/')) return { error: outcome?.error || 'The deposit checkout couldn’t open. Try again or pay in the shop.' };
  redirect(url);
}

/** After returning from Stripe: records the deposit if Stripe says it was paid. */
export async function confirmDeposit(appointmentId: string): Promise<boolean | null> {
  const accessToken = await readAccess('appointment', appointmentId);
  const result = await keystoneClient<{ confirmDepositCheckout: Command }>('mutation($id: ID!, $token: String) { confirmDepositCheckout(appointmentId: $id, accessToken: $token) { success error data } }', { id: appointmentId, token: accessToken || null });
  const outcome = result.success ? result.data.confirmDepositCheckout : null;
  return outcome?.success ? Boolean(outcome.data?.paid) : null;
}
