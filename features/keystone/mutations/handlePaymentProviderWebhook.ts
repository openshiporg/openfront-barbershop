import { permissions } from '../access';

// Webhook ingress must preserve the raw body for signature verification, which a
// parsed GraphQL JSON argument cannot do. This legacy resolver is intentionally
// not registered; signed webhooks use /api/payment-webhooks/[providerCode].
export default async function handlePaymentProviderWebhook(
  _root: unknown,
  _args: unknown,
  context: { session?: Parameters<typeof permissions.canManagePayments>[0]['session'] }
) {
  if (!permissions.canManagePayments({ session: context.session })) {
    return { success: false, error: 'Not authorized to handle payment provider webhooks.' };
  }
  return {
    success: false,
    error: 'GraphQL webhook handling is disabled. Use the signed raw-body webhook endpoint.',
  };
}
