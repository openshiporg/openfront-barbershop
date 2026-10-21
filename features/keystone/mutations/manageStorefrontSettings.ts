import type { Session } from '../access';
import { requireCurrentShopPermission } from '../utils/currentAuthorization';
import {
  parseStorefrontSettingsInput,
  type StorefrontSettingsInput,
} from '../utils/storefrontSettingsInput';

// Same bounded storefront DTO the screen and action already consume.
const STOREFRONT_SETTINGS_SELECTION = 'id name tagline address phone timezone currencyCode hours brandColor logoIcon logoColor isPublic isDemo updatedAt';

type ShopQueryApi = {
  findOne(args: { where: { id: string }; query: string }): Promise<Record<string, unknown> | null>;
  updateOne(args: { where: { id: string }; data: ReturnType<typeof parseStorefrontSettingsInput>; query: string }): Promise<Record<string, unknown> | null>;
};

// Trusted, session-bound Keystone resolver context. The Query API runs the Shop
// List access, field access and hooks; there is deliberately no sudo here.
type SettingsPrisma = {
  $transaction<T>(operation: (tx: SettingsTransaction) => Promise<T>, options?: { isolationLevel?: 'Serializable' }): Promise<T>;
};
type SettingsTransaction = {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  shop: { update(args: { where: { id: string }; data: ReturnType<typeof parseStorefrontSettingsInput> }): Promise<unknown> };
};
type SettingsContext = { session?: Session; query: { Shop: ShopQueryApi }; prisma: SettingsPrisma };

class SettingsConflict extends Error {}

type UpdateArgs = StorefrontSettingsInput & { expectedShopId?: string | null; expectedVersion?: string | null };

export async function getActiveShopStorefrontSettings(
  _root: unknown,
  _args: unknown,
  context: SettingsContext,
) {
  const shopId = await requireCurrentShopPermission(context.session, 'canManageOnboarding');
  return context.query.Shop.findOne({
    where: { id: shopId },
    query: STOREFRONT_SETTINGS_SELECTION,
  });
}

export async function updateActiveShopStorefrontSettings(
  _root: unknown,
  args: UpdateArgs,
  context: SettingsContext,
) {
  try {
    const shopId = await requireCurrentShopPermission(context.session, 'canManageOnboarding');
    const { expectedShopId, expectedVersion, ...input } = args;
    const data = parseStorefrontSettingsInput(input);
    if (expectedShopId || expectedVersion) {
      // The settings the operator loaded are checked and written in one locked
      // transaction, so a stale form can never overwrite a newer save or another shop.
      if (expectedShopId && expectedShopId !== shopId) throw new SettingsConflict('Your active shop changed since this form was loaded. Your changes were not saved. Reload to edit the current shop.');
      await context.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRawUnsafe<Array<{ updatedAt: Date | null }>>('SELECT "updatedAt" FROM "Shop" WHERE id = $1 FOR UPDATE', shopId);
        if (!rows[0]) throw new SettingsConflict('This shop could not be found. Reload and try again.');
        const currentVersion = rows[0].updatedAt ? new Date(rows[0].updatedAt).toISOString() : '';
        if (expectedVersion && currentVersion !== new Date(expectedVersion).toISOString()) {
          throw new SettingsConflict('These settings were changed elsewhere since you loaded them. Your changes were not saved. Reload to see the latest settings.');
        }
        // Input was validated and sanitized by parseStorefrontSettingsInput (same rules as the Shop field hooks).
        await tx.shop.update({ where: { id: shopId }, data });
      }, { isolationLevel: 'Serializable' });
      const shop = await context.query.Shop.findOne({ where: { id: shopId }, query: STOREFRONT_SETTINGS_SELECTION });
      return { success: true, error: null, conflict: false, data: shop };
    }
    const shop = await context.query.Shop.updateOne({
      where: { id: shopId },
      data,
      query: STOREFRONT_SETTINGS_SELECTION,
    });
    return { success: true, error: null, conflict: false, data: shop };
  } catch (error) {
    return {
      success: false,
      conflict: error instanceof SettingsConflict,
      error: error instanceof Error && !error.message.includes('Invalid `') ? error.message : 'Unable to update storefront settings.',
      data: null,
    };
  }
}
