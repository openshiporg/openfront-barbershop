import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { Notice, PageHeader } from '@/features/platform/lib/ui';
import { getRecordOptionsAction } from '../actions/records';
import { NewRecordForm } from './NewRecordForm';
import { RECORD_RETURN, type RecordKind } from '../lib/recordKinds';

const TITLES: Record<RecordKind, { title: string; parent: string }> = {
  service: { title: 'New service', parent: 'Services & packages' },
  barber: { title: 'New barber', parent: 'Barbers & schedules' },
  customer: { title: 'New customer', parent: 'Customers' },
  product: { title: 'New product', parent: 'Services & packages' },
};

export async function NewRecordPage({ kind }: { kind: RecordKind }) {
  const options = await getRecordOptionsAction();
  const { title, parent } = TITLES[kind];
  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'link' as const, label: parent, href: RECORD_RETURN[kind] },
    { type: 'page' as const, label: title },
  ];
  return (
    <PageContainer title={title} header={<PageHeader title={title} />} breadcrumbs={breadcrumbs}>
      <div className="px-4 pb-24 md:px-6">
        {options ? <NewRecordForm kind={kind} options={options} /> : <Notice tone="alert">Select an active shop first.</Notice>}
      </div>
    </PageContainer>
  );
}
