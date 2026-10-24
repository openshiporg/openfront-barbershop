import Link from 'next/link';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { Empty, Notice, PageHeader, PillLink, Section, StatusDot, Track, type Tone } from '@/features/platform/lib/ui';
import { getChairsAction } from '../actions/chairs';
import { ChairActions, NewChairButton } from '../components/ChairControls';

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'link' as const, label: 'Barbers & schedules', href: '/dashboard/platform/staff' },
  { type: 'page' as const, label: 'Chairs' },
];
const tone = (status: string): Tone => (status === 'active' ? 'live' : status === 'maintenance' ? 'wait' : 'off');
const statusText: Record<string, string> = { active: 'In service', maintenance: 'Maintenance', reserved: 'Reserved' };

export default async function ChairsPage() {
  const data = await getChairsAction();
  const header = <PageHeader title="Chairs" meta={data ? `${data.chairs.filter((chair) => chair.status === 'active').length} of ${data.chairs.length} in service` : undefined} actions={<Track><PillLink href="/dashboard/platform/staff">Barbers</PillLink>{data ? <NewChairButton /> : null}</Track>} />;
  return (
    <PageContainer title="Chairs" header={header} breadcrumbs={breadcrumbs}>
      <div className="px-4 pb-8 md:px-6">
        {!data ? <Notice tone="alert">Select an active shop first.</Notice> : (
          <Section title="Chairs" count={data.chairs.length}>
            {!data.chairs.length ? <Empty>No chairs yet.</Empty> : (
              <ul>
                {data.chairs.map((chair) => (
                  <li key={chair.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0">
                    <div className="min-w-0">
                      <p className="font-medium"><StatusDot tone={tone(chair.status)} />Chair <span className="font-mono">{chair.chairNumber}</span>{chair.stationName ? <span className="ml-1.5 font-normal text-muted-foreground">{chair.stationName}</span> : null}</p>
                      <p className="text-xs text-muted-foreground">{statusText[chair.status] || chair.status} · {chair.assignedBarbers.length ? chair.assignedBarbers.map((barber, index) => <span key={barber.id}>{index ? ', ' : ''}<Link className="hover:underline" href={`/dashboard/platform/staff/${barber.id}`}>{barber.displayName}</Link></span>) : 'Unassigned'} · {chair.upcoming} upcoming</p>
                    </div>
                    <ChairActions chair={chair} />
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
