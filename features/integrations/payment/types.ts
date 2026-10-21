export type PaymentAdapterFunctionName =
  | 'createPaymentFunction'
  | 'capturePaymentFunction'
  | 'refundPaymentFunction'
  | 'getPaymentStatusFunction'
  | 'generatePaymentLinkFunction'
  | 'handleWebhookFunction'

export interface PaymentProviderConfig {
  code: string
  createPaymentFunction?: string
  capturePaymentFunction?: string
  refundPaymentFunction?: string
  getPaymentStatusFunction?: string
  generatePaymentLinkFunction?: string
  handleWebhookFunction?: string
  [key: string]: unknown
}

export type PaymentAdapterArgs = Record<string, unknown>

export type PaymentAdapterFunction = (
  args: PaymentAdapterArgs & { provider: PaymentProviderConfig }
) => Promise<unknown>

export type PaymentAdapterModule = Record<PaymentAdapterFunctionName, PaymentAdapterFunction>
