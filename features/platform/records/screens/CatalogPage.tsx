import { notFound } from 'next/navigation';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { Notice, PageHeader } from '@/features/platform/lib/ui';
import { getCatalogOptionsAction, getCatalogRecordAction, type CatalogKind } from '../actions/catalog';
import { CatalogForm } from './CatalogForm';

const NOUN: Record<CatalogKind, string> = { service: 'service', product: 'product', package: 'package', plan: 'membership plan' };

export async function CatalogPage({ kind, params }: { kind: CatalogKind; params?: Promise<{ id?: string }> }) {
  const id = params ? (await params).id : undefined;
  const [options, record] = await Promise.all([getCatalogOptionsAction(), id ? getCatalogRecordAction(kind, id) : Promise.resolve(null)]);
  if (id && !record) notFound();
  const title = record ? record.name : `New ${NOUN[kind]}`;
  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    kind === 'product' ? { type: 'link' as const, label: 'Inventory', href: '/dashboard/platform/inventory' } : { type: 'link' as const, label: 'Services & packages', href: '/dashboard/platform/services' },
    { type: 'page' as const, label: title },
  ];
  return (
    <PageContainer title={title} header={<PageHeader title={title} tone={record ? (['active'].includes(record.status) ? 'live' : record.status === 'draft' || record.status === 'paused' ? 'wait' : 'off') : undefined} />} breadcrumbs={breadcrumbs}>
      <div className="px-4 pb-24 md:px-6">
        {options ? <CatalogForm kind={kind} record={record} options={options} /> : <Notice tone="alert">Select an active shop first.</Notice>}
      </div>
    </PageContainer>
  );
}
