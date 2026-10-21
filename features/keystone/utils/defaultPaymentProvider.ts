import type { Prisma, PrismaClient } from '@prisma/client';

import type { PaymentProviderConfig } from '../../integrations/payment/types';
import { runSerializableTransaction } from './serializableTransaction';

export const DEFAULT_MANUAL_PAYMENT_PROVIDER_CODE = 'pp_manual';

export type PaymentProviderSeedInput = PaymentProviderConfig & {
  name: string;
  isInstalled: boolean;
  credentials: Record<string, unknown>;
  metadata: Record<string, unknown>;
  shop?: { connect: { id: string } };
};

export type PaymentProviderRecord = PaymentProviderConfig & {
  id: string;
  name: string;
  isInstalled: boolean;
  credentials?: unknown;
  metadata?: unknown;
  shop?: { id: string } | null;
};

interface PaymentProviderQueryApi {
  findMany(args: Record<string, unknown>): Promise<PaymentProviderRecord[]>;
}

interface PaymentProviderContext {
  sudo(): { query: { PaymentProvider: PaymentProviderQueryApi } };
  prisma: PrismaClient;
}

export const defaultManualPaymentProviderInput: PaymentProviderSeedInput = {
  name: 'Manual Payments',
  code: DEFAULT_MANUAL_PAYMENT_PROVIDER_CODE,
  isInstalled: true,
  credentials: {},
  metadata: {
    adapter: 'manual',
    settlement: 'offline',
    description: 'Pay in person. Staff record cash and prepaid payments at checkout; nothing is charged online.',
  },
  createPaymentFunction: 'manual',
  capturePaymentFunction: 'manual',
  refundPaymentFunction: 'manual',
  getPaymentStatusFunction: 'manual',
  generatePaymentLinkFunction: 'manual',
  handleWebhookFunction: 'manual',
};

const PAYMENT_PROVIDER_SELECTION = `
  id
  shop { id }
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

export async function getInstalledPaymentProvider(context: PaymentProviderContext, shopId: string) {
  const providers = await context.sudo().query.PaymentProvider.findMany({
    where: { shop: { id: { equals: shopId } }, isInstalled: { equals: true } },
    orderBy: [{ createdAt: 'asc' }],
    take: 1,
    query: PAYMENT_PROVIDER_SELECTION,
  });
  return providers[0] ?? null;
}

/**
 * Returns the shop's manual provider, creating it once. A per-shop advisory lock
 * makes concurrent callers converge on one provider; existing duplicates resolve
 * to the oldest row so selection is deterministic.
 */
export async function ensureDefaultManualPaymentProvider(context: PaymentProviderContext, shopId: string) {
  return runSerializableTransaction(context.prisma, async (client) => {
    const transaction = client as Prisma.TransactionClient;
    await transaction.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
      'barbershop-payment-provider',
      shopId
    );
    const existing = await transaction.paymentProvider.findFirst({
      where: { shopId, code: DEFAULT_MANUAL_PAYMENT_PROVIDER_CODE },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    if (existing) return existing;
    const { shop: _shop, ...data } = defaultManualPaymentProviderInput;
    return transaction.paymentProvider.create({
      data: {
        ...data,
        credentials: data.credentials as Prisma.InputJsonValue,
        metadata: data.metadata as Prisma.InputJsonValue,
        shopId,
      },
    });
  });
}

export async function getOrCreateDefaultPaymentProvider(context: PaymentProviderContext, shopId: string) {
  return (await getInstalledPaymentProvider(context, shopId)) ?? ensureDefaultManualPaymentProvider(context, shopId);
}
