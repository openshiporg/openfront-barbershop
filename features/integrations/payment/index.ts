import type { PaymentAdapterModule } from './types';

export type PaymentWebhookRegistration = {
  secretEnv: string;
  signatureHeader: string;
};

export type PaymentAdapterRegistration = {
  load: () => Promise<PaymentAdapterModule>;
  /**
   * `offline` providers (pay in person) have no processor: they can open a pending
   * payment session, but capture, refund and status checks never run through them.
   * Money collected in person is recorded by staff at checkout.
   */
  settlement: 'offline' | 'processor';
  allowsPublicSettlement: boolean;
  webhook: PaymentWebhookRegistration | null;
};

// Provider execution is code-owned. Database values may select only one of these keys;
// they can never supply an import path, URL, or secret.
export const paymentProviderAdapters = {
  manual: {
    load: () => import('./manual') as Promise<PaymentAdapterModule>,
    settlement: 'offline',
    allowsPublicSettlement: false,
    webhook: null,
  },
} as const satisfies Record<string, PaymentAdapterRegistration>;

export type PaymentProviderAdapterCode = keyof typeof paymentProviderAdapters;

export function isPaymentProviderAdapterCode(value: string): value is PaymentProviderAdapterCode {
  return Object.prototype.hasOwnProperty.call(paymentProviderAdapters, value);
}

export function getPaymentProviderRegistration(code: string): PaymentAdapterRegistration | null {
  return isPaymentProviderAdapterCode(code) ? paymentProviderAdapters[code] : null;
}
