'use client';

import { runOnboardingSeed } from '../actions/onboarding';
import type { BarbershopSeedMode } from '../scripts/seedBarbershopDemo';

/** The authenticated Keystone mutation owns ordered, rerunnable seed execution. */
export function useOnboardingApi() {
  return {
    runOnboarding: (mode: BarbershopSeedMode) => runOnboardingSeed(mode),
  };
}
