import type { PaymentAdapterArgs } from './types'

// Pay-in-person provider. There is no processor behind it, so it can only open a
// pending session. It never reports money as captured, refunded or settled:
// staff record in-person payments and cash refunds through checkout.

function asNumber(value: unknown, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

export async function handleWebhookFunction() {
  throw new Error('Pay-in-person payments do not accept webhooks.')
}

export async function createPaymentFunction({ amount, currency }: PaymentAdapterArgs) {
  return {
    status: 'pending',
    data: {
      status: 'pending',
      amount: asNumber(amount),
      currency: asString(currency, 'usd').toLowerCase(),
      provider: 'manual',
      settlement: 'offline',
    },
  }
}

export async function capturePaymentFunction() {
  throw new Error('Pay-in-person payments are not captured by a processor. Record the payment at checkout.')
}

export async function refundPaymentFunction() {
  throw new Error('Pay-in-person payments are not refunded by a processor. Record a cash refund from the checkout receipt.')
}

export async function getPaymentStatusFunction() {
  throw new Error('Pay-in-person payments have no processor status to check.')
}

export async function generatePaymentLinkFunction() {
  return null
}
