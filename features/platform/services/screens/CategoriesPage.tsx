import Link from 'next/link';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { Empty, Notice, PageHeader, PillLink, Section, StatusDot, Track } from '@/features/platform/lib/ui';
import { getCategoriesAction } from '../actions/categories';
import { CategoryActions, NewCategoryButton } from '../components/CategoryControls';

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'link' as const, label: 'Services & packages', href: '/dashboard/platform/services' },
  { type: 'page' as const, label: 'Categories' },
];

export default async function CategoriesPage() {
  const data = await getCategoriesAction();
  const header = <PageHeader title="Menu categories" meta={data?.shopName} actions={<Track><PillLink href="/dashboard/platform/services">Services</PillLink>{data ? <NewCategoryButton /> : null}</Track>} />;
  return (
    <PageContainer title="Menu categories" header={header} breadcrumbs={breadcrumbs}>
      <div className="px-4 pb-8 md:px-6">
        {!data ? <Notice tone="alert">Select an active shop first.</Notice> : (
          <Section title="Categories" count={data.categories.length}>
            {!data.categories.length ? <Empty>No categories yet.</Empty> : (
              <ul>
                {data.categories.map((category) => (
                  <li key={category.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0">
                    <div className="min-w-0">
                      <p className="font-medium"><StatusDot tone={category.status === 'active' ? 'live' : 'off'} />{category.name}<span className="ml-2 font-mono text-xs text-muted-foreground">#{category.displayOrder ?? 0}</span></p>
                      <p className="text-xs text-muted-foreground">{category.status === 'active' ? 'On the menu' : 'Hidden'} · <Link className="underline-offset-4 hover:underline" href="/dashboard/platform/services">{category.servicesCount} {category.servicesCount === 1 ? 'service' : 'services'}</Link>{category.description ? ` · ${category.description}` : ''}</p>
                    </div>
                    <CategoryActions category={category} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}
      </div>
    </PageContainer>
  );
}
