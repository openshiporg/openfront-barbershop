import { permissions } from '../access';
import { assertCurrentRolePermission } from '../utils/currentAuthorization';
import {
  runBarbershopSeed,
  type BarbershopSeedMode,
  type BarbershopSeedResult,
} from '../../platform/onboarding/scripts/seedBarbershopDemo';

type Args = {
  mode?: string | null;
};

type OnboardingMutationResult = {
  success: boolean;
  error: string | null;
  result: BarbershopSeedResult | null;
};

type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'dismissed';

type OnboardingMutationContext = {
  session?: Parameters<typeof permissions.canManageOnboarding>[0]['session'] & {
    itemId?: string;
    data?: { onboardingStatus?: OnboardingStatus | null };
  };
  sudo(): ReturnType<import('../../platform/onboarding/scripts/seedBarbershopDemo').BarbershopSeedContext['sudo']> & {
    db: Record<string, { updateOne(args: Record<string, unknown>): Promise<unknown> }> & {
      User: { updateOne(args: Record<string, unknown>): Promise<unknown> };
    };
  };
  prisma?: import('../../platform/onboarding/scripts/seedBarbershopDemo').BarbershopSeedContext['prisma'];
};

function normalizeMode(value?: string | null): BarbershopSeedMode | null {
  if (value === 'minimal' || value === 'full') return value;
  return null;
}

export default async function runBarbershopOnboarding(
  _root: unknown,
  args: Args,
  context: OnboardingMutationContext
): Promise<OnboardingMutationResult> {
  if (!permissions.canManageOnboarding({ session: context.session })) {
    return { success: false, error: 'Not authorized to run onboarding.', result: null };
  }

  const mode = normalizeMode(args.mode);
  if (!mode) {
    return { success: false, error: 'Onboarding mode must be minimal or full.', result: null };
  }

  const userId = context.session?.itemId;
  if (!userId) {
    return { success: false, error: 'A signed-in dashboard user is required.', result: null };
  }

  const sudo = context.sudo();
  try { await assertCurrentRolePermission(context.session as never, 'canManageOnboarding'); }
  catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Not authorized to run onboarding.', result: null }; }
  // Restore from the durable status at run start, not a possibly stale cookie.
  const [currentUser] = await sudo.query.User.findMany({ where: { id: { equals: userId } }, take: 1, query: 'id onboardingStatus' });
  const previousStatus = (currentUser?.onboardingStatus as OnboardingStatus | null | undefined) || 'not_started';
  try {
    await sudo.db.User.updateOne({
      where: { id: userId },
      data: { onboardingStatus: 'in_progress' },
    });
    const result = await runBarbershopSeed({ mode, apply: true, context });
    await sudo.db.User.updateOne({
      where: { id: userId },
      data: { onboardingStatus: 'completed' },
    });
    return { success: true, error: null, result };
  } catch (error) {
    await sudo.db.User.updateOne({
      where: { id: userId },
      data: { onboardingStatus: previousStatus === 'in_progress' ? 'not_started' : previousStatus },
    }).catch(() => undefined);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to save shop setup.',
      result: null,
    };
  }
}
