import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { PageHeader, PillLink, Track } from '@/features/platform/lib/ui';
import { getCustomerHistoryData } from '../actions/customers';
import { CustomersPageClient } from './CustomersPageClient';

interface PageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'page' as const, label: 'Platform' },
  { type: 'page' as const, label: 'Customers' },
];

const customersHeader = (
  <PageHeader title="Customers" actions={<Track><PillLink variant="primary" href="/dashboard/platform/customers/new">New customer</PillLink></Track>} />
);

function param(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : '';
}

export default async function CustomersPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const search = param(resolvedSearchParams.q);
  const page = Math.max(1, Number.parseInt(param(resolvedSearchParams.page) || '1', 10) || 1);
  const customerId = param(resolvedSearchParams.customer);
  const planSearch = param(resolvedSearchParams.plans);
  const response = await getCustomerHistoryData({ search, page, customerId, planSearch });

  if (!response.success) {
    return (
      <PageContainer title="Customers" header={customersHeader} breadcrumbs={breadcrumbs}>
        <div className="px-4 md:px-6">
          <Alert variant="destructive">
            <AlertDescription>
              {response.kind === 'forbidden'
                ? 'You do not have access to customer records for the active shop. Ask a shop owner or manager to review your access.'
                : `Customer records could not be loaded: ${response.error}`}
            </AlertDescription>
          </Alert>
        </div>
      </PageContainer>
    );
  }

  const data = response.data;
  return (
    <PageContainer title="Customers" header={customersHeader} breadcrumbs={breadcrumbs}>
      <CustomersPageClient
        data={data}
        search={search}
        planSearch={planSearch}
        initialCustomerId={data.requestedCustomerId || (customerId && data.customers.some((customer) => customer.id === customerId) ? customerId : data.customers[0]?.id || '')}
      />
    </PageContainer>
  );
}
