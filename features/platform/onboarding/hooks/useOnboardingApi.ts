'use client';

import { runOnboardingSeed, type OnboardingShopInput } from '../actions/onboarding';
import type { BarbershopSeedMode } from '../scripts/seedBarbershopDemo';

/** The authenticated Keystone mutation owns ordered, rerunnable seed execution. */
export function useOnboardingApi() {
  return {
    runOnboarding: (mode: BarbershopSeedMode, shop?: OnboardingShopInput) => runOnboardingSeed(mode, shop),
  };
}
