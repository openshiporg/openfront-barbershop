'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import type { PosCommandResult, PosLoadResult, PosProjectionData } from '../lib/posTypes';

export type CheckoutInput = {
  appointmentId: string;
  paymentMethod: string;
  packageBalanceId?: string;
  tipAmount?: number;
  discountAmount?: number;
  taxAmount?: number;
  notes?: string;
  giftCardCode?: string;
  // Created in the browser for this ticket's checkout intent and reused on retry.
  idempotencyKey: string;
};

export type PosQuery = {
  appointmentId?: string;
  ticketPage?: number;
  ticketSearch?: string;
  salePage?: number;
  saleSearch?: string;
  receiptPage?: number;
  receiptId?: string;
};

function isForbidden(message?: string | null) {
  return /not authorized|permission|revoked|active shop|select exactly one/i.test(message || '');
}

const interrupted = 'Connection interrupted. The action may have completed; retry to confirm with the same request.';

export async function getPosCheckoutData(input: PosQuery = {}): Promise<PosLoadResult> {
  const response = await keystoneClient<{ platformPos: { success: boolean; error?: string | null; data?: PosProjectionData | null } }>(`
    query PosProjection($appointmentId: ID, $ticketPage: Int, $ticketSearch: String, $salePage: Int, $saleSearch: String, $receiptPage: Int, $receiptId: ID) {
      platformPos(appointmentId: $appointmentId, ticketPage: $ticketPage, ticketSearch: $ticketSearch, salePage: $salePage, saleSearch: $saleSearch, receiptPage: $receiptPage, receiptId: $receiptId) { success error data }
    }
  `, {
    appointmentId: input.appointmentId || null,
    ticketPage: input.ticketPage || 1,
    ticketSearch: input.ticketSearch || null,
    salePage: input.salePage || 1,
    saleSearch: input.saleSearch || null,
    receiptPage: input.receiptPage || 1,
    receiptId: input.receiptId || null,
  }, { cache: 'no-store' });
  const result = response.data?.platformPos;
  if (!response.success || !result?.success || !result.data) {
    const error = result?.error || response.error || 'POS data is unavailable.';
    return { success: false, kind: isForbidden(error) ? 'forbidden' : 'unavailable', error };
  }
  return { success: true, data: result.data };
}

// Domain outcome is the resolver's own success/error, never transport success alone.
async function runCommand<T>(operation: string, query: string, variables: Record<string, unknown>): Promise<PosCommandResult<T>> {
  const response = await keystoneClient<Record<string, { success: boolean; error?: string | null; data?: T | null }>>(query, variables);
  const result = response.data?.[operation];
  if (!response.success || !result) return { success: false, error: response.error || interrupted, data: null };
  if (!result.success) return { success: false, error: result.error || 'The action was not recorded.', data: null };
  revalidatePath('/dashboard/platform/pos');
  return { success: true, error: null, data: result.data ?? null };
}

export async function recordProductSaleAction(input: { productId: string; quantity: number; paymentMethod: string; taxRateBps: number; idempotencyKey: string }) {
  return runCommand<{ id?: string; transactionId?: string; productName?: string; quantity?: number; subtotal?: number; taxAmount?: number; total?: number }>('recordProductSale', `
    mutation RecordProductSale($productId: ID!, $quantity: Int!, $paymentMethod: String!, $taxRateBps: Int, $key: String!) {
      recordProductSale(productId: $productId, quantity: $quantity, paymentMethod: $paymentMethod, taxRateBps: $taxRateBps, idempotencyKey: $key) { success error data }
    }
  `, { productId: input.productId, quantity: input.quantity, paymentMethod: input.paymentMethod, taxRateBps: input.taxRateBps, key: input.idempotencyKey });
}

export async function returnProductSaleAction(input: { saleLineId: string; quantity: number; reason: string; cashReturned: boolean; restock: boolean; idempotencyKey: string }) {
  return runCommand<{ id?: string; originalLineId?: string; quantity?: number; total?: number }>('returnProductSaleLine', `
    mutation ReturnProductSale($saleLineId: ID!, $quantity: Int!, $reason: String!, $cashReturned: Boolean!, $restock: Boolean!, $key: String!) {
      returnProductSaleLine(saleLineId: $saleLineId, quantity: $quantity, reason: $reason, cashReturned: $cashReturned, restock: $restock, idempotencyKey: $key) { success error data }
    }
  `, { saleLineId: input.saleLineId, quantity: input.quantity, reason: input.reason, cashReturned: input.cashReturned, restock: input.restock, key: input.idempotencyKey });
}

export async function refundCashCheckoutAction(input: { transactionId: string; reason: string; cashReturned: boolean; idempotencyKey: string }) {
  const result = await runCommand<{ id?: string; amount?: number; replayed?: boolean }>('refundCashCheckout', `
    mutation RefundCashCheckout($transactionId: ID!, $reason: String!, $cashReturned: Boolean!, $key: String!) {
      refundCashCheckout(transactionId: $transactionId, reason: $reason, cashReturned: $cashReturned, idempotencyKey: $key) { success error data }
    }
  `, { transactionId: input.transactionId, reason: input.reason, cashReturned: input.cashReturned, key: input.idempotencyKey });
  if (result.success) {
    revalidatePath('/dashboard/platform/reports');
    revalidatePath('/dashboard/platform/customers');
  }
  return result;
}

type CheckoutResult = {
  success: boolean;
  error?: string | null;
  transaction?: { id: string; status?: string | null; total?: number | null; formattedTotal?: string | null; paymentMethod?: string | null } | null;
  appointment?: { id: string; status?: string | null; paymentStatus?: string | null } | null;
};

// The browser-held key makes a retry of the same checkout replay the original receipt.
export async function checkoutAppointmentAction(input: CheckoutInput): Promise<PosCommandResult<{ transaction: NonNullable<CheckoutResult['transaction']>; appointment: NonNullable<CheckoutResult['appointment']> }>> {
  const response = await keystoneClient<{ checkoutAppointment: CheckoutResult }>(`
    mutation CheckoutAppointment(
      $appointmentId: ID!
      $paymentMethod: String
      $packageBalanceId: ID
      $tipAmount: Int
      $discountAmount: Int
      $taxAmount: Int
      $notes: String
      $giftCardCode: String
      $idempotencyKey: String!
    ) {
      checkoutAppointment(
        appointmentId: $appointmentId
        paymentMethod: $paymentMethod
        packageBalanceId: $packageBalanceId
        tipAmount: $tipAmount
        discountAmount: $discountAmount
        taxAmount: $taxAmount
        notes: $notes
        giftCardCode: $giftCardCode
        idempotencyKey: $idempotencyKey
      ) {
        success
        error
        transaction { id status total formattedTotal paymentMethod completedAt }
        appointment { id status paymentStatus }
      }
    }
  `, input);
  const result = response.data?.checkoutAppointment;
  if (!response.success || !result) return { success: false, error: response.error || interrupted, data: null };
  if (!result.success) return { success: false, error: result.error || 'Checkout was not completed.', data: null };
  if (result.appointment?.id !== input.appointmentId || !result.transaction?.id) {
    return { success: false, error: 'Checkout reported success but the receipt could not be matched to this ticket. Refresh before retrying.', data: null };
  }
  revalidatePath('/dashboard/platform/pos');
  revalidatePath('/dashboard/platform/booking');
  revalidatePath('/dashboard/appointments');
  revalidatePath('/dashboard/checkout-transactions');
  return { success: true, error: null, data: { transaction: result.transaction, appointment: result.appointment } };
}

export type DeskCard = { sessionId: string; url: string | null; amount: number; status: string; recorded: boolean; transactionId?: string | null };
type DeskCardResponse = { success: boolean; error: string | null; data: DeskCard | null };

async function deskCardCommand(name: string, query: string, variables: Record<string, unknown>): Promise<DeskCardResponse> {
  try {
    const response = await keystoneClient<Record<string, DeskCardResponse>>(query, variables, { cache: 'no-store' });
    const result = response.data?.[name];
    if (!response.success || !result) return { success: false, error: response.error || 'Unable to reach card payments.', data: null };
    if (result.data?.recorded) { revalidatePath('/dashboard/platform/pos'); revalidatePath('/dashboard/platform/payments'); }
    return result;
  } catch {
    return { success: false, error: interrupted, data: null };
  }
}

/** Opens a Stripe card page for the ticket's balance (counter screen or texted pay link). */
export async function startDeskCardAction(input: { appointmentId: string; tipAmount: number; discountAmount: number; taxAmount: number; notes: string }) {
  return deskCardCommand('startDeskCardPayment', `mutation StartDeskCard($appointmentId: ID!, $tip: Int, $discount: Int, $tax: Int, $notes: String) { startDeskCardPayment(appointmentId: $appointmentId, tipAmount: $tip, discountAmount: $discount, taxAmount: $tax, notes: $notes) { success error data } }`, { appointmentId: input.appointmentId, tip: input.tipAmount, discount: input.discountAmount, tax: input.taxAmount, notes: input.notes });
}

export async function checkDeskCardAction(paymentSessionId: string) {
  return deskCardCommand('checkDeskCardPayment', `mutation CheckDeskCard($id: ID!) { checkDeskCardPayment(paymentSessionId: $id) { success error data } }`, { id: paymentSessionId });
}

export async function cancelDeskCardAction(paymentSessionId: string) {
  return deskCardCommand('cancelDeskCardPayment', `mutation CancelDeskCard($id: ID!) { cancelDeskCardPayment(paymentSessionId: $id) { success error data } }`, { id: paymentSessionId });
}

export async function openDeskCardAction(appointmentId: string) {
  return deskCardCommand('openDeskCardPayment', `query OpenDeskCard($id: ID!) { openDeskCardPayment(appointmentId: $id) { success error data } }`, { id: appointmentId });
}

export type GiftCardLookup = { id: string; code: string; status: string; balance: number; expiresAt: string | null; recipientName: string | null };
export async function lookupGiftCardAction(code: string): Promise<{ success: boolean; error: string | null; data: GiftCardLookup | null }> {
  try {
    const response = await keystoneClient<{ lookupGiftCard: { success: boolean; error: string | null; data: GiftCardLookup | null } }>(`query LookupGiftCard($code: String!) { lookupGiftCard(code: $code) { success error data } }`, { code }, { cache: 'no-store' });
    return response.data?.lookupGiftCard || { success: false, error: response.error || 'Unable to look up the gift card.', data: null };
  } catch {
    return { success: false, error: interrupted, data: null };
  }
}
