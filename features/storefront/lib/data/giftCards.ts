'use server';

import { redirect } from 'next/navigation';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { storefrontClient } from '../config';

type Command = { success: boolean; error: string | null; data: Record<string, unknown> | null };
export type GiftCardOrder = { status: string; amount: number; recipientEmail: string | null; recipientName: string | null; code: string | null; expiresAt: string | null };

export async function getGiftCardOptions(): Promise<{ online: boolean; amounts: number[] }> {
  try {
    const data = await storefrontClient.request<{ giftCardOptions: { online: boolean; amounts: number[] } | null }>('query { giftCardOptions }');
    return data.giftCardOptions || { online: false, amounts: [] };
  } catch { return { online: false, amounts: [] }; }
}

/** Sends the buyer to Stripe Checkout; the card activates once Stripe confirms. */
export async function buyGiftCardAction(_prev: { error: string } | null, form: FormData): Promise<{ error: string }> {
  const text = (key: string) => String(form.get(key) || '').trim();
  const result = await keystoneClient<{ startGiftCardCheckout: Command }>(
    'mutation($amount: Int!, $name: String!, $email: String!, $toName: String, $toEmail: String, $message: String) { startGiftCardCheckout(amount: $amount, purchaserName: $name, purchaserEmail: $email, recipientName: $toName, recipientEmail: $toEmail, message: $message) { success error data } }',
    { amount: Number(text('amount')), name: text('purchaserName'), email: text('purchaserEmail'), toName: text('recipientName') || null, toEmail: text('recipientEmail') || null, message: text('message') || null },
  );
  const outcome = result.success ? result.data.startGiftCardCheckout : null;
  const url = typeof outcome?.data?.url === 'string' ? outcome.data.url : '';
  if (!outcome?.success || !url.startsWith('https://checkout.stripe.com/')) return { error: outcome?.error || 'Checkout couldn’t open. Try again in a moment.' };
  redirect(url);
}

export async function confirmGiftCardOrder(giftCardId: string, token: string): Promise<{ order: GiftCardOrder | null; error: string | null }> {
  const result = await keystoneClient<{ confirmGiftCardOrder: Command }>('mutation($id: ID!, $token: String!) { confirmGiftCardOrder(giftCardId: $id, token: $token) { success error data } }', { id: giftCardId, token }, { cache: 'no-store' });
  const outcome = result.success ? result.data.confirmGiftCardOrder : null;
  if (!outcome?.success || !outcome.data) return { order: null, error: outcome?.error || 'We couldn’t check this order yet.' };
  return { order: outcome.data as unknown as GiftCardOrder, error: null };
}
