'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import type { BarbershopSeedMode, SeedStats } from '../scripts/seedBarbershopDemo';

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'dismissed';

export async function updateOnboardingStatus(status: OnboardingStatus) {
  const currentUser = await keystoneClient<{
    authenticatedItem?: { id?: string | null; role?: { canManageOnboarding?: boolean | null } | null } | null;
  }>(`
    query CurrentOnboardingUser {
      authenticatedItem {
        ... on User {
          id
          role { canManageOnboarding }
        }
      }
    }
  `);

  if (!currentUser.success || !currentUser.data.authenticatedItem?.id) {
    return { success: false as const, error: 'A signed-in dashboard user is required.' };
  }

  if (!currentUser.data.authenticatedItem.role?.canManageOnboarding) {
    return { success: false as const, error: 'Not authorized to manage onboarding.' };
  }

  const response = await keystoneClient<{
    updateUser?: { id: string; onboardingStatus?: OnboardingStatus | null } | null;
  }>(`
    mutation UpdateOnboardingStatus($id: ID!, $data: UserUpdateInput!) {
      updateUser(where: { id: $id }, data: $data) {
        id
        onboardingStatus
      }
    }
  `, {
    id: currentUser.data.authenticatedItem.id,
    data: { onboardingStatus: status },
  });

  if (!response.success) {
    return { success: false as const, error: response.error };
  }

  revalidatePath('/dashboard', 'layout');
  return { success: true as const, data: response.data.updateUser ?? null };
}

export type OnboardingShopInput = { shopName: string; shopAddress: string; shopPhone: string; shopTimezone: string };

export async function runOnboardingSeed(mode: BarbershopSeedMode, shop?: OnboardingShopInput) {
  try {
    const response = await keystoneClient<{
      runBarbershopOnboarding: {
        success: boolean;
        error?: string | null;
        result?: {
          mode: BarbershopSeedMode;
          dryRun: boolean;
          stats: { listKey: string; created: number; reused: number; skipped: number }[];
        } | null;
      };
    }>(`
      mutation RunBarbershopOnboarding($mode: String!, $shopName: String, $shopAddress: String, $shopPhone: String, $shopTimezone: String) {
        runBarbershopOnboarding(mode: $mode, shopName: $shopName, shopAddress: $shopAddress, shopPhone: $shopPhone, shopTimezone: $shopTimezone) {
          success
          error
          result {
            mode
            dryRun
            stats { listKey created reused skipped }
          }
        }
      }
    `, { mode, ...shop });

    if (!response.success) {
      return { success: false as const, error: response.error };
    }

    const operation = response.data.runBarbershopOnboarding;
    if (!operation.success || !operation.result) {
      return { success: false as const, error: operation.error || 'Unable to save shop setup.' };
    }

    const stats: SeedStats = Object.fromEntries(
      operation.result.stats.map((stat) => [
        stat.listKey,
        { created: stat.created, reused: stat.reused, skipped: stat.skipped },
      ])
    );
    // No infrastructure identity (host/port/database) is returned to the browser.
    const result = {
      mode: operation.result.mode,
      stats,
      dryRun: operation.result.dryRun,
    };
    revalidatePath('/dashboard', 'layout');
    revalidatePath('/dashboard/platform/store-settings');
    revalidatePath('/', 'layout');
    return { success: true as const, data: result };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Unable to save shop setup.',
    };
  }
}

export async function dismissOnboarding() {
  return updateOnboardingStatus('dismissed');
}

export async function startOnboarding() {
  return updateOnboardingStatus('in_progress');
}

export async function completeOnboarding() {
  return updateOnboardingStatus('completed');
}
