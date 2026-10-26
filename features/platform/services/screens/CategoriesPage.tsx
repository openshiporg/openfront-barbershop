import Link from 'next/link';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { DataTable, Empty, Notice, PageHeader, PillLink, StatusCell, Td } from '@/features/platform/lib/ui';
import { getCategoriesAction } from '../actions/categories';
import { CategoryActions, NewCategoryButton } from '../components/CategoryControls';

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'link' as const, label: 'Services & packages', href: '/dashboard/platform/services' },
  { type: 'page' as const, label: 'Categories' },
];

export default async function CategoriesPage() {
  const data = await getCategoriesAction();
  const header = <PageHeader title="Menu categories" meta={data?.shopName} actions={<div className="flex flex-wrap items-center gap-1.5"><PillLink href="/dashboard/platform/services">Services</PillLink>{data ? <NewCategoryButton /> : null}</div>} />;
  return (
    <PageContainer title="Menu categories" header={header} breadcrumbs={breadcrumbs}>
      <div className="px-4 pb-24 md:px-6">
        {!data ? <Notice tone="alert">Select an active shop first.</Notice> : !data.categories.length ? <Empty>No categories yet.</Empty> : (
          <DataTable label="Menu categories" className="relative" head={[
            { label: 'Order', className: 'w-16 text-right' },
            { label: 'Category' },
            { label: 'Services', className: 'text-right' },
            { label: 'Menu', className: 'hidden sm:table-cell' },
            { label: <span className="sr-only">Actions</span>, className: 'w-px' },
          ]}>
            {data.categories.map((category) => (
              <tr key={category.id} className="hover:bg-muted/30">
                <Td className="align-middle text-right tabular-nums text-muted-foreground">{category.displayOrder ?? 0}</Td>
                <Td className="align-middle"><span className="font-medium">{category.name}</span>{category.description ? <span className="block max-w-md truncate text-xs text-muted-foreground">{category.description}</span> : null}</Td>
                <Td className="align-middle text-right tabular-nums"><Link className="underline-offset-4 hover:underline" href="/dashboard/platform/services">{category.servicesCount}</Link></Td>
                <Td className="hidden align-middle sm:table-cell"><StatusCell tone={category.status === 'active' ? 'live' : 'off'}>{category.status === 'active' ? 'On the menu' : 'Hidden'}</StatusCell></Td>
                <Td className="align-middle text-right"><CategoryActions category={category} /></Td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </PageContainer>
  );
}
