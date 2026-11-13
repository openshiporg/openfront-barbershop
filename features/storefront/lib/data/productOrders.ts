'use server';

import { redirect } from 'next/navigation';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

type Command = { success: boolean; error: string | null; data: Record<string, unknown> | null };
export type ProductOrder = { status: string; name: string; amount: number; buyerEmail: string };

/** Sends the buyer to Stripe Checkout; the sale is recorded once Stripe confirms. */
export async function buyProductAction(_prev: { error: string } | null, form: FormData): Promise<{ error: string }> {
  const text = (key: string) => String(form.get(key) || '').trim();
  const result = await keystoneClient<{ startProductCheckout: Command }>(
    'mutation($id: ID!, $name: String!, $email: String!) { startProductCheckout(productId: $id, buyerName: $name, buyerEmail: $email) { success error data } }',
    { id: text('productId'), name: text('buyerName'), email: text('buyerEmail') },
  );
  const outcome = result.success ? result.data.startProductCheckout : null;
  const url = typeof outcome?.data?.url === 'string' ? outcome.data.url : '';
  if (!outcome?.success || !url.startsWith('https://checkout.stripe.com/')) return { error: outcome?.error || 'Checkout couldn’t open. Try again in a moment.' };
  redirect(url);
}

export async function confirmProductOrder(orderId: string, token: string): Promise<{ order: ProductOrder | null; error: string | null }> {
  const result = await keystoneClient<{ confirmProductOrder: Command }>('mutation($id: ID!, $token: String!) { confirmProductOrder(orderId: $id, token: $token) { success error data } }', { id: orderId, token }, { cache: 'no-store' });
  const outcome = result.success ? result.data.confirmProductOrder : null;
  if (!outcome?.success || !outcome.data) return { order: null, error: outcome?.error || 'We couldn’t check this order yet.' };
  return { order: outcome.data as unknown as ProductOrder, error: null };
}
