import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { PageHeader } from '@/features/platform/lib/ui';
import { getBookingBoardData } from '../actions/appointments';
import { BookingBoardPageClient } from './BookingBoardPageClient';

interface PageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'page' as const, label: 'Platform' },
  { type: 'page' as const, label: 'Booking board' },
];

export default async function BookingBoardPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const date = typeof params.date === 'string' ? params.date : undefined;
  const status = typeof params.status === 'string' && params.status ? params.status : undefined;
  const page = typeof params.page === 'string' ? Number(params.page) || 1 : 1;
  const response = await getBookingBoardData({ date, status, page });

  if (!response.success) {
    return (
      <PageContainer title="Booking board" breadcrumbs={breadcrumbs} header={<PageHeader title="Booking board" tone="alert" />}>
        <div className="px-4 md:px-6">
          <Alert variant="destructive">
            <AlertTitle>{response.kind === 'forbidden' ? 'Booking access restricted' : 'Booking board unavailable'}</AlertTitle>
            <AlertDescription>
              {response.kind === 'forbidden'
                ? 'Your role or shop membership does not include appointment access for the active shop.'
                : `${response.error} Refresh the page to try again.`}
            </AlertDescription>
          </Alert>
        </div>
      </PageContainer>
    );
  }

  return <BookingBoardPageClient data={response.data} breadcrumbs={breadcrumbs} />;
}
