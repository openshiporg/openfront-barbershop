import {
  getPaymentProviderRegistration,
  type PaymentProviderAdapterCode,
} from '../../integrations/payment';
import type {
  PaymentAdapterArgs,
  PaymentAdapterFunctionName,
  PaymentProviderConfig,
} from '../../integrations/payment/types';

interface ExecuteAdapterFunctionInput {
  provider: PaymentProviderConfig;
  functionName: PaymentAdapterFunctionName;
  args: PaymentAdapterArgs;
}

function adapterCodeForProvider(provider: PaymentProviderConfig): PaymentProviderAdapterCode {
  const code = provider.code.replace(/^pp_/, '');
  const registration = getPaymentProviderRegistration(code);
  if (!registration) {
    throw new Error(`Payment adapter ${code || provider.code} is not registered.`);
  }
  return code as PaymentProviderAdapterCode;
}

/**
 * Settlement mode comes from the code-owned registry, never from database JSON.
 * Unknown codes are treated as offline so they can never claim processor settlement.
 */
export function paymentProviderSettlement(provider: { code: string }): 'offline' | 'processor' {
  const registration = getPaymentProviderRegistration(provider.code.replace(/^pp_/, ''));
  return registration?.settlement === 'processor' ? 'processor' : 'offline';
}

export function isOfflinePaymentProvider(provider: { code: string }) {
  return paymentProviderSettlement(provider) === 'offline';
}

export async function executeAdapterFunction({ provider, functionName, args }: ExecuteAdapterFunctionInput) {
  const adapterCode = adapterCodeForProvider(provider);
  const configuredSelector = provider[functionName];
  if (typeof configuredSelector === 'string' && configuredSelector !== adapterCode) {
    throw new Error(`Payment adapter selector for ${functionName} is not registered for ${adapterCode}.`);
  }

  const registration = getPaymentProviderRegistration(adapterCode);
  if (!registration) throw new Error(`Payment adapter ${adapterCode} is not registered.`);

  const adapter = await registration.load();
  const fn = adapter[functionName];
  if (!fn) {
    throw new Error(`Function ${functionName} is not available in payment adapter ${adapterCode}.`);
  }

  try {
    // Deliberately pass only the code-owned provider identity. Adapter secrets come
    // from registry-declared environment variables, never database JSON.
    return await fn({ provider: { code: provider.code }, ...args });
  } catch (error) {
    throw new Error(
      `Error executing ${functionName} for payment adapter ${adapterCode}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function createPayment({ provider, ...args }: PaymentAdapterArgs & { provider: PaymentProviderConfig }) {
  return executeAdapterFunction({ provider, functionName: 'createPaymentFunction', args });
}

export async function capturePayment({ provider, ...args }: PaymentAdapterArgs & { provider: PaymentProviderConfig }) {
  return executeAdapterFunction({ provider, functionName: 'capturePaymentFunction', args });
}

export async function refundPayment({ provider, ...args }: PaymentAdapterArgs & { provider: PaymentProviderConfig }) {
  return executeAdapterFunction({ provider, functionName: 'refundPaymentFunction', args });
}

export async function getPaymentStatus({ provider, ...args }: PaymentAdapterArgs & { provider: PaymentProviderConfig }) {
  return executeAdapterFunction({ provider, functionName: 'getPaymentStatusFunction', args });
}

export async function generatePaymentLink({ provider, ...args }: PaymentAdapterArgs & { provider: PaymentProviderConfig }) {
  return executeAdapterFunction({ provider, functionName: 'generatePaymentLinkFunction', args });
}

export async function handleWebhook({ provider, ...args }: PaymentAdapterArgs & { provider: PaymentProviderConfig }) {
  return executeAdapterFunction({ provider, functionName: 'handleWebhookFunction', args });
}
