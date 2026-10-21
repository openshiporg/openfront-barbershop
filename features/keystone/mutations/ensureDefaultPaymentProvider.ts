import { permissions } from '../access'
import { ensureDefaultManualPaymentProvider } from '../utils/defaultPaymentProvider'
import { requireCurrentShopPermission } from '../utils/currentAuthorization'

type EnsureDefaultPaymentProviderResult = {
  success: boolean
  error: string | null
  provider: unknown | null
}

type PaymentProviderMutationContext = Parameters<typeof ensureDefaultManualPaymentProvider>[0] & {
  session?: Parameters<typeof permissions.canManagePayments>[0]['session']
}

export default async function ensureDefaultPaymentProvider(
  root: unknown,
  args: Record<string, never>,
  context: PaymentProviderMutationContext
): Promise<EnsureDefaultPaymentProviderResult> {
  if (!permissions.canManagePayments({ session: context.session })) {
    return { success: false, error: 'Not authorized to manage payment providers.', provider: null }
  }

  try {
    const shopId = await requireCurrentShopPermission(context.session, 'canManagePayments')
    const provider = await ensureDefaultManualPaymentProvider(context, shopId)
    return { success: true, error: null, provider }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to ensure default payment provider.',
      provider: null,
    }
  }
}
