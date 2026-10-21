import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { getQueueData } from '../actions/queue';
import { QueuePageClient } from './QueuePageClient';

interface PageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'page' as const, label: 'Platform' },
  { type: 'page' as const, label: 'Walk-in queue' },
];

export default async function QueuePage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const search = typeof params.q === 'string' ? params.q : '';
  const page = typeof params.page === 'string' ? Number(params.page) || 1 : 1;
  const response = await getQueueData({ search, page });
  if (!response.success) {
    return (
      <PageContainer title="Walk-in queue" breadcrumbs={breadcrumbs} header={<div><h1 className="text-2xl font-semibold">Walk-in queue</h1><p className="text-muted-foreground">Walk-ins, quoted waits, and seating</p></div>}>
        <div className="px-4 md:px-6">
          <Alert variant="destructive">
            <AlertTitle>{response.kind === 'forbidden' ? 'Queue access restricted' : 'Queue unavailable'}</AlertTitle>
            <AlertDescription>
              {response.kind === 'forbidden'
                ? 'You do not have access to the active shop queue. Ask a shop owner or manager to review your access.'
                : 'The queue is temporarily unavailable. Refresh the page to try again.'}
            </AlertDescription>
          </Alert>
        </div>
      </PageContainer>
    );
  }
  return <QueuePageClient data={response.data} breadcrumbs={breadcrumbs} />;
}
