'use server';

import { revalidatePath } from 'next/cache';
import { activeShop } from '@/features/platform/lib/activeShop';
import { platformRequest } from '@/features/platform/lib/platformRequest';

export type ProviderRow = { id: string; name: string; code: string; isInstalled: boolean; paymentSessionsCount: number };
export type SessionRow = { id: string; status: string; amount: number; currencyCode: string; createdAt: string; paymentProvider: { name: string | null } | null; appointment: { id: string; serviceTitleSnapshot: string | null } | null };
export type ReceiptRow = { id: string; status: string; paymentMethod: string; total: number | null; tipAmount: number | null; completedAt: string | null; paymentSession: { refundedAmount: number | null } | null; cashRefund: { amount: number | null } | null; customer: { firstName: string; lastName: string | null } | null };
export type ReconciliationRow = { id: string; localStatusBefore: string; remoteStatus: string; localStatusAfter: string; changed: boolean; amount: number; observedAt: string };
export type GiftCardRow = { id: string; code: string; status: string; initialValue: number; balance: number; purchaserName: string | null; recipientName: string | null; activatedAt: string | null; createdAt: string; paymentSession: { id: string; status: string } | null };
export type PaymentsData = { shopName: string; timezone: string; providers: ProviderRow[]; sessions: SessionRow[]; receipts: ReceiptRow[]; reconciliations: ReconciliationRow[]; giftCards: GiftCardRow[]; stripeKeyConfigured: boolean };

export async function getPaymentsAction(): Promise<PaymentsData | null> {
  const shop = await activeShop();
  if (!shop) return null;
  // Unpaid card pages past their lifetime close on their own before the list is read.
  await platformRequest('mutation { expireStalePaymentSessions { success } }').catch(() => null);
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const result = await platformRequest<{ shop: { timezone: string | null } | null; paymentProviders: ProviderRow[]; paymentSessions: SessionRow[]; checkoutTransactions: ReceiptRow[]; paymentReconciliations: ReconciliationRow[]; giftCards: GiftCardRow[] }>(`
    query Payments($shop: ID!, $since: DateTime!) {
      shop(where: { id: $shop }) { timezone }
      paymentProviders(where: { shop: { id: { equals: $shop } } }, orderBy: [{ name: asc }]) { id name code isInstalled paymentSessionsCount }
      paymentSessions(where: { shop: { id: { equals: $shop } }, status: { in: [pending, authorized] } }, orderBy: [{ createdAt: desc }], take: 50) { id status amount currencyCode createdAt paymentProvider { name } appointment { id serviceTitleSnapshot } }
      checkoutTransactions(where: { shop: { id: { equals: $shop } }, completedAt: { gte: $since } }, orderBy: [{ completedAt: desc }], take: 500) { id status paymentMethod total tipAmount completedAt paymentSession { refundedAmount } cashRefund { amount } customer { firstName lastName } }
      paymentReconciliations(where: { shop: { id: { equals: $shop } } }, orderBy: [{ observedAt: desc }], take: 20) { id localStatusBefore remoteStatus localStatusAfter changed amount observedAt }
      giftCards(where: { shop: { id: { equals: $shop } }, status: { not: { equals: pending } } }, orderBy: [{ createdAt: desc }], take: 20) { id code status initialValue balance purchaserName recipientName activatedAt createdAt paymentSession { id status } }
    }`, { shop: shop.id, since });
  if (!result.ok) return null;
  // Only whether the key exists is read; its value never leaves the server.
  return { shopName: shop.name, timezone: result.data.shop?.timezone || 'UTC', providers: result.data.paymentProviders, sessions: result.data.paymentSessions, receipts: result.data.checkoutTransactions, reconciliations: result.data.paymentReconciliations, giftCards: result.data.giftCards, stripeKeyConfigured: Boolean(process.env.STRIPE_SECRET_KEY) };
}

const refresh = () => { revalidatePath('/dashboard/platform/payments'); revalidatePath('/dashboard/platform/pos'); };

export async function ensureManualProviderAction() {
  const result = await platformRequest<{ ensureDefaultPaymentProvider: { success: boolean; error: string | null } }>('mutation { ensureDefaultPaymentProvider { success error } }');
  if (!result.ok) return { success: false, error: result.error };
  if (!result.data.ensureDefaultPaymentProvider.success) return { success: false, error: result.data.ensureDefaultPaymentProvider.error || 'Unable to set up manual payments.' };
  refresh();
  return { success: true };
}

export async function setProviderInstalledAction(id: string, installed: boolean) {
  const result = await platformRequest(`mutation($id: ID!, $installed: Boolean) { updatePaymentProvider(where: { id: $id }, data: { isInstalled: $installed }) { id } }`, { id, installed });
  if (!result.ok) return { success: false, error: result.error };
  refresh();
  return { success: true };
}

/** Adds Stripe as the shop's online card provider (used for deposits at booking). */
export async function setUpStripeAction() {
  const shop = await activeShop();
  if (!shop) return { success: false, error: 'Select an active shop first.' };
  if (!process.env.STRIPE_SECRET_KEY) return { success: false, error: 'Stripe needs STRIPE_SECRET_KEY set on the server first.' };
  const existing = await platformRequest<{ paymentProviders: Array<{ id: string }> }>(`query($shop: ID!) { paymentProviders(where: { shop: { id: { equals: $shop } }, code: { equals: "pp_stripe" } }) { id } }`, { shop: shop.id });
  if (!existing.ok) return { success: false, error: existing.error };
  const result = existing.data.paymentProviders[0]
    ? await platformRequest(`mutation($id: ID!) { updatePaymentProvider(where: { id: $id }, data: { isInstalled: true }) { id } }`, { id: existing.data.paymentProviders[0].id })
    : await platformRequest(`mutation($data: PaymentProviderCreateInput!) { createPaymentProvider(data: $data) { id } }`, { data: {
      shop: { connect: { id: shop.id } }, name: 'Stripe', code: 'pp_stripe', isInstalled: true,
      createPaymentFunction: 'stripe', capturePaymentFunction: 'stripe', refundPaymentFunction: 'stripe', getPaymentStatusFunction: 'stripe', generatePaymentLinkFunction: 'stripe', handleWebhookFunction: 'stripe',
    } });
  if (!result.ok) return { success: false, error: result.error };
  refresh();
  revalidatePath('/book');
  return { success: true };
}

/** Refunds an unused online gift card back to the buyer's card and cancels it. */
export async function refundGiftCardAction(paymentSessionId: string, idempotencyKey: string) {
  if (!paymentSessionId || !idempotencyKey) return { success: false, error: 'Request key is missing. Reload and try again.' };
  const result = await platformRequest<{ refundAppointmentPaymentSession: { success: boolean; error: string | null } }>(`mutation($id: ID!, $key: String!) { refundAppointmentPaymentSession(paymentSessionId: $id, idempotencyKey: $key) { success error } }`, { id: paymentSessionId, key: idempotencyKey });
  if (!result.ok) return { success: false, error: result.error };
  if (!result.data.refundAppointmentPaymentSession.success) return { success: false, error: result.data.refundAppointmentPaymentSession.error || 'The refund did not go through.' };
  refresh();
  return { success: true };
}
