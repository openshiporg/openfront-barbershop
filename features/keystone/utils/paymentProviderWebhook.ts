import { getPaymentProviderRegistration } from '../../integrations/payment';
import type { PaymentProviderRecord } from './defaultPaymentProvider';
import { handleWebhook } from './paymentProviderAdapter';
import {
  parseSignedJsonWebhook,
  paymentWebhookPayloadHash,
  paymentWebhookReplayKey,
} from './paymentWebhookSecurity';

type PaymentProviderQueryApi = {
  // Provider codes are unique only within a shop, so lookups must use findMany.
  findMany(args: { where: Record<string, unknown>; take: number; query: string }): Promise<PaymentProviderRecord[]>;
};

type PaymentWebhookEventRecord = {
  id: string;
  providerCode?: string | null;
  providerEventId?: string | null;
  eventType?: string | null;
  payloadHash?: string | null;
};

export type PaymentWebhookEventQueryApi = {
  findOne(args: { where: { replayKey: string }; query?: string }): Promise<PaymentWebhookEventRecord | null>;
  createOne(args: { data: Record<string, unknown>; query?: string }): Promise<PaymentWebhookEventRecord>;
  deleteOne(args: { where: { id: string }; query?: string }): Promise<unknown>;
};

export type PaymentProviderWebhookContext = {
  sudo(): {
    query: {
      PaymentProvider: PaymentProviderQueryApi;
      PaymentWebhookEvent: PaymentWebhookEventQueryApi;
    };
  };
};

export type PaymentProviderWebhookResult = {
  success: boolean;
  error: string | null;
  provider: PaymentProviderRecord | null;
  eventType: string | null;
  isValid: boolean;
  replayed: boolean;
  resource: unknown | null;
};

const PAYMENT_PROVIDER_SELECTION = `
  id
  name
  code
  isInstalled
  metadata
  createPaymentFunction
  capturePaymentFunction
  refundPaymentFunction
  getPaymentStatusFunction
  generatePaymentLinkFunction
  handleWebhookFunction
`;

export function normalizePaymentProviderCode(providerCode: string) {
  const code = providerCode.trim().toLowerCase();
  return code.startsWith('pp_') ? code : `pp_${code}`;
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function headerValue(headers: Record<string, unknown>, name: string) {
  const expected = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === expected && typeof value === 'string') return value;
  }
  return '';
}

function errorResult(error: string, provider: PaymentProviderRecord | null = null): PaymentProviderWebhookResult {
  return {
    success: false,
    error,
    provider,
    eventType: null,
    isValid: false,
    replayed: false,
    resource: null,
  };
}

function isUniqueConstraintError(error: unknown) {
  return asRecord(error).code === 'P2002';
}

export async function claimPaymentWebhookEvent(
  events: PaymentWebhookEventQueryApi,
  input: {
    replayKey: string;
    providerCode: string;
    providerEventId: string;
    eventType: string;
    payloadHash: string;
  }
): Promise<{ outcome: 'claimed'; id: string } | { outcome: 'replayed' } | { outcome: 'conflict' }> {
  const select = 'id providerCode providerEventId eventType payloadHash';
  const compare = (existing: PaymentWebhookEventRecord) => (
    existing.payloadHash === input.payloadHash && existing.eventType === input.eventType
      ? { outcome: 'replayed' as const }
      : { outcome: 'conflict' as const }
  );
  const existing = await events.findOne({ where: { replayKey: input.replayKey }, query: select });
  if (existing) return compare(existing);

  try {
    const created = await events.createOne({
      data: { ...input, processedAt: new Date().toISOString() },
      query: 'id',
    });
    return { outcome: 'claimed', id: created.id };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const winner = await events.findOne({ where: { replayKey: input.replayKey }, query: select });
    if (!winner) throw error;
    return compare(winner);
  }
}

// A claim whose handler did not complete is released so the provider's retry is
// processed again instead of being acknowledged as already handled.
async function releasePaymentWebhookClaim(events: PaymentWebhookEventQueryApi, id: string) {
  try {
    await events.deleteOne({ where: { id }, query: 'id' });
  } catch {
    // The original failure is what the caller reports.
  }
}

export async function processPaymentProviderWebhook(
  context: PaymentProviderWebhookContext,
  input: { providerCode: string; rawBody: Uint8Array; headers?: unknown }
): Promise<PaymentProviderWebhookResult> {
  const providerCode = normalizePaymentProviderCode(input.providerCode || '');
  if (!providerCode || providerCode === 'pp_') return errorResult('Payment provider code is required.');

  try {
    const sudo = context.sudo();
    const providers = await sudo.query.PaymentProvider.findMany({
      where: { code: { equals: providerCode }, isInstalled: { equals: true } },
      take: 2,
      query: PAYMENT_PROVIDER_SELECTION,
    });
    if (providers.length > 1) {
      return errorResult(`Payment provider ${providerCode} is installed in more than one shop; webhook cannot be routed.`);
    }
    const provider = providers[0];
    if (!provider) return errorResult(`Installed payment provider ${providerCode} was not found.`);

    const adapterCode = provider.code.replace(/^pp_/, '');
    const registration = getPaymentProviderRegistration(adapterCode);
    if (!registration) return errorResult(`Payment adapter ${adapterCode} is not registered.`, provider);
    if (!registration.allowsPublicSettlement || !registration.webhook) {
      return errorResult(`Payment provider ${providerCode} does not accept public webhooks.`, provider);
    }

    const secret = process.env[registration.webhook.secretEnv];
    if (!secret) return errorResult(`Payment webhook secret ${registration.webhook.secretEnv} is not configured.`, provider);

    const headers = asRecord(input.headers);
    const signature = headerValue(headers, registration.webhook.signatureHeader);
    let event: unknown;
    let rawText: string;
    try {
      rawText = new TextDecoder('utf-8', { fatal: true }).decode(input.rawBody);
      event = parseSignedJsonWebhook({ rawBody: input.rawBody, signature, secret });
    } catch {
      return errorResult('Payment provider webhook signature is invalid.', provider);
    }

    const eventRecord = asRecord(event);
    const providerEventId = typeof eventRecord.id === 'string' ? eventRecord.id : '';
    const eventType = typeof eventRecord.type === 'string' ? eventRecord.type : '';
    if (!providerEventId || !eventType) {
      return errorResult('Payment provider webhook is missing a stable event id or type.', provider);
    }

    const replayKey = paymentWebhookReplayKey(providerCode, providerEventId);
    const claim = await claimPaymentWebhookEvent(sudo.query.PaymentWebhookEvent, {
      replayKey,
      providerCode,
      providerEventId,
      eventType,
      payloadHash: paymentWebhookPayloadHash(input.rawBody),
    });
    if (claim.outcome === 'conflict') {
      return errorResult('Payment provider webhook event id was reused with a different payload.', provider);
    }
    if (claim.outcome === 'replayed') {
      return {
        success: true,
        error: null,
        provider,
        eventType,
        isValid: true,
        replayed: true,
        resource: null,
      };
    }

    // The durable replay claim is written before adapter domain handling, so a
    // concurrent duplicate can never execute settlement side effects twice.
    let adapterResult: Record<string, unknown>;
    try {
      adapterResult = asRecord(await handleWebhook({ provider, event, headers, rawBody: rawText }));
    } catch (error) {
      await releasePaymentWebhookClaim(sudo.query.PaymentWebhookEvent, claim.id);
      throw error;
    }
    if (adapterResult.isValid === false) {
      await releasePaymentWebhookClaim(sudo.query.PaymentWebhookEvent, claim.id);
      return errorResult('Payment provider webhook failed adapter validation.', provider);
    }

    return {
      success: true,
      error: null,
      provider,
      eventType,
      isValid: true,
      replayed: false,
      resource: adapterResult.resource ?? adapterResult.data ?? adapterResult,
    };
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'Unable to handle payment provider webhook.');
  }
}
