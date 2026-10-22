import { PageBreadcrumbs } from '@/features/dashboard/components/PageBreadcrumbs';
import { getActiveShopChoicesAction } from '@/features/platform/barbershop/actions/shop';
import { getActiveShopStorefrontSettingsAction } from '../actions/settings';
import { StoreSettingsPageClient } from './StoreSettingsPageClient';

export default async function StoreSettingsPage() {
  const [response, shopChoices] = await Promise.all([
    getActiveShopStorefrontSettingsAction(),
    getActiveShopChoicesAction(),
  ]);

  return (
    <section className="flex min-w-0 flex-col">
      <PageBreadcrumbs
        items={[
          {
            type: 'link',
            label: 'Dashboard',
            href: '/',
          },
          {
            type: 'page',
            label: 'Platform',
          },
          {
            type: 'page',
            label: 'Store Settings',
          },
        ]}
      />
      <StoreSettingsPageClient
        key={response.data?.id || 'no-shop'}
        initialData={response.success ? response.data : null}
        initialError={response.success ? null : (response.error ?? null)}
        shopChoices={shopChoices}
      />
    </section>
  );
}
