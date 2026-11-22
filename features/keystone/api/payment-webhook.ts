import { boundedRequestBytes, BoundedBodyError } from '@/features/keystone/security/bounded-body'
import { keystoneContext } from '@/features/keystone/context'
import {
  processPaymentProviderWebhook,
  type PaymentProviderWebhookContext,
} from '@/features/keystone/utils/paymentProviderWebhook'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ providerCode: string }>
}

// The Stripe test account is shared by many sites, so this endpoint can receive events meant for another
// site. They are acknowledged (200) and ignored; this shop settles its own payments by reading them back
// from Stripe (utils/settleOpenPayments.ts), so nothing depends on a webhook arriving here.
function responseStatus(_success: boolean) {
  return 200
}

function publicError(success: boolean) {
  return success ? null : 'Webhook was not accepted.'
}

const MAX_WEBHOOK_BYTES = 1_000_000

export async function POST(request: Request, { params }: RouteContext) {
  const { providerCode } = await params
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > MAX_WEBHOOK_BYTES) {
    return Response.json({ success: false, error: 'Webhook was not accepted.' }, { status: 413, headers: { Connection: 'close' } })
  }

  let rawBody: Uint8Array
  try { rawBody = await boundedRequestBytes(request, MAX_WEBHOOK_BYTES) }
  catch (error) { return Response.json({ success: false, error: 'Webhook was not accepted.' }, { status: error instanceof BoundedBodyError ? error.status : 400, headers: { Connection: 'close' } }) }
  if (!rawBody.byteLength) {
    return Response.json({ success: false, error: 'Webhook was not accepted.' }, { status: 400 })
  }

  const webhookContext = keystoneContext as unknown as PaymentProviderWebhookContext
  const result = await processPaymentProviderWebhook(webhookContext, {
    providerCode,
    rawBody,
    headers: Object.fromEntries(request.headers.entries()),
  })

  return Response.json(
    {
      success: result.success,
      error: publicError(result.success),
    },
    { status: responseStatus(result.success) }
  )
}
