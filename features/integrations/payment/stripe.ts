import type { PaymentAdapterArgs } from './types'

// Stripe Checkout through Stripe's REST API. Like E-commerce, the secret key
// comes from STRIPE_SECRET_KEY; without it the adapter is unavailable and the
// shop keeps taking deposits in person. Money is confirmed by reading the
// Checkout Session back from Stripe, never from the browser.

const API = 'https://api.stripe.com/v1'

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

function secretKey() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Online card payments are not set up.')
  return key
}

function form(values: Record<string, string | number | undefined>) {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== '') body.append(key, String(value))
  return body
}

async function stripe<T>(path: string, init: { method?: 'GET' | 'POST'; body?: URLSearchParams; idempotencyKey?: string } = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: init.method || 'GET',
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      ...(init.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(init.idempotencyKey ? { 'Idempotency-Key': init.idempotencyKey } : {}),
    },
    body: init.body,
    redirect: 'error',
  })
  const json = await response.json().catch(() => ({})) as { error?: { message?: string } } & T
  if (!response.ok) throw new Error(json.error?.message || `Stripe request failed (${response.status}).`)
  return json
}

type CheckoutSession = { id: string; url: string | null; status: string; payment_status: string; amount_total: number | null; currency: string | null; payment_intent: string | null }

function sessionStatus(session: CheckoutSession) {
  if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') return 'captured'
  if (session.status === 'expired') return 'expired'
  return 'pending'
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export async function createPaymentFunction({ amount, currency, successUrl, cancelUrl, description, idempotencyKey, metadata }: PaymentAdapterArgs) {
  const cents = Math.round(Number(amount))
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error('Payment amount must be greater than zero.')
  const meta = (metadata && typeof metadata === 'object' ? metadata : {}) as Record<string, unknown>
  const session = await stripe<CheckoutSession>('/checkout/sessions', {
    method: 'POST',
    idempotencyKey: asString(idempotencyKey) || undefined,
    body: form({
      mode: 'payment',
      success_url: asString(successUrl),
      cancel_url: asString(cancelUrl),
      'line_items[0][quantity]': 1,
      'line_items[0][price_data][currency]': asString(currency || 'usd').toLowerCase(),
      'line_items[0][price_data][unit_amount]': cents,
      'line_items[0][price_data][product_data][name]': asString(description) || 'Deposit',
      ...Object.fromEntries(Object.entries(meta).map(([key, value]) => [`metadata[${key}]`, asString(value)])),
    }),
  })
  return { status: sessionStatus(session), id: session.id, url: session.url, data: { id: session.id, url: session.url, status: session.status, amount: session.amount_total, provider: 'stripe' } }
}

export const generatePaymentLinkFunction = createPaymentFunction

export async function getPaymentStatusFunction({ paymentId }: PaymentAdapterArgs) {
  const session = await stripe<CheckoutSession>(`/checkout/sessions/${encodeURIComponent(asString(paymentId))}`)
  return { status: sessionStatus(session), amount: session.amount_total, data: { id: session.id, status: session.status, paymentStatus: session.payment_status, paymentIntent: session.payment_intent, amount: session.amount_total } }
}

/** Checkout captures on payment; capture reports the session's settled state. */
export async function capturePaymentFunction(args: PaymentAdapterArgs) {
  return getPaymentStatusFunction(args)
}

export async function refundPaymentFunction({ paymentId, amount, idempotencyKey }: PaymentAdapterArgs) {
  const session = await stripe<CheckoutSession>(`/checkout/sessions/${encodeURIComponent(asString(paymentId))}`)
  if (!session.payment_intent) throw new Error('This payment has nothing to refund.')
  const refund = await stripe<{ id: string; status: string; amount: number }>('/refunds', {
    method: 'POST',
    idempotencyKey: asString(idempotencyKey) || undefined,
    body: form({ payment_intent: session.payment_intent, amount: amount == null ? undefined : Math.round(Number(amount)) }),
  })
  return { status: refund.status === 'succeeded' ? 'refunded' : refund.status, amount: refund.amount, data: refund }
}

export async function handleWebhookFunction() {
  throw new Error('Stripe payments are confirmed from the Checkout Session, not by webhook.')
}
