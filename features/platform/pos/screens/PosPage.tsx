import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { getPosCheckoutData } from '../actions/checkout';
import { PosPageClient } from './PosPageClient';

interface PageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'page' as const, label: 'Platform' },
  { type: 'page' as const, label: 'POS checkout' },
];

const header = (
  <div>
    <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">POS checkout</h1>
    <p className="text-muted-foreground">Take payment for visits, sell and return retail products, and review receipts</p>
  </div>
);

function param(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : '';
}

function page(value: string | string[] | undefined) {
  return Math.max(1, Number.parseInt(param(value) || '1', 10) || 1);
}

export default async function PosPage({ searchParams }: PageProps) {
  const resolved = searchParams ? await searchParams : {};
  const query = {
    appointmentId: param(resolved.appointment),
    ticketPage: page(resolved.tickets),
    ticketSearch: param(resolved.ticketQ),
    salePage: page(resolved.sales),
    saleSearch: param(resolved.saleQ),
    receiptPage: page(resolved.receipts),
    receiptId: param(resolved.receipt),
  };
  const response = await getPosCheckoutData(query);

  return (
    <PageContainer title="POS checkout" header={header} breadcrumbs={breadcrumbs}>
      {response.success ? (
        <PosPageClient data={response.data} query={query} />
      ) : (
        <div className="px-4 md:px-6">
          <Alert variant="destructive">
            <AlertDescription>
              {response.kind === 'forbidden'
                ? 'You do not have access to POS checkout for the active shop. Ask a shop owner or manager to review your access.'
                : `POS checkout could not be loaded: ${response.error}`}
            </AlertDescription>
          </Alert>
        </div>
      )}
    </PageContainer>
  );
}
