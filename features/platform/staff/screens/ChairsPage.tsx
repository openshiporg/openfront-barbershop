import Link from 'next/link';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { DataTable, Empty, Notice, PageHeader, PillLink, StatusCell, Td, type Tone } from '@/features/platform/lib/ui';
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
  const header = <PageHeader title="Chairs" meta={data ? `${data.chairs.filter((chair) => chair.status === 'active').length} of ${data.chairs.length} in service` : undefined} actions={<div className="flex flex-wrap items-center gap-1.5"><PillLink href="/dashboard/platform/staff">Barbers</PillLink>{data ? <NewChairButton /> : null}</div>} />;
  return (
    <PageContainer title="Chairs" header={header} breadcrumbs={breadcrumbs}>
      <div className="px-4 pb-24 md:px-6">
        {!data ? <Notice tone="alert">Select an active shop first.</Notice> : !data.chairs.length ? <Empty>No chairs yet.</Empty> : (
          <DataTable label="Chairs" className="relative" head={[
            { label: 'Chair' },
            { label: 'Barbers' },
            { label: 'Upcoming', className: 'hidden text-right sm:table-cell' },
            { label: 'Status', className: 'hidden sm:table-cell' },
            { label: <span className="sr-only">Actions</span>, className: 'w-px' },
          ]}>
            {data.chairs.map((chair) => (
              <tr key={chair.id} className="hover:bg-muted/30">
                <Td className="align-middle"><span className="font-medium">Chair <span className="tabular-nums">{chair.chairNumber}</span></span>{chair.stationName ? <span className="block text-xs text-muted-foreground">{chair.stationName}</span> : null}</Td>
                <Td className="align-middle">{chair.assignedBarbers.length ? chair.assignedBarbers.map((barber, index) => <span key={barber.id}>{index ? ', ' : ''}<Link className="underline-offset-4 hover:underline" href={`/dashboard/platform/staff/${barber.id}`}>{barber.displayName}</Link></span>) : <span className="text-muted-foreground">Unassigned</span>}</Td>
                <Td className="hidden align-middle text-right tabular-nums sm:table-cell">{chair.upcoming}</Td>
                <Td className="hidden align-middle sm:table-cell"><StatusCell tone={tone(chair.status)}>{statusText[chair.status] || chair.status}</StatusCell></Td>
                <Td className="align-middle text-right"><ChairActions chair={chair} /></Td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </PageContainer>
  );
}
