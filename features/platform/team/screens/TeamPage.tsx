import Link from 'next/link';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { DataTable, Empty, Notice, PageHeader, StatusCell, StatusTabs, Td, type Tone } from '@/features/platform/lib/ui';
import { getTeamAction } from '../actions/team';
import { AddMemberButton, MemberMenu, MemberRole } from '../components/TeamControls';

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'page' as const, label: 'Platform' },
  { type: 'page' as const, label: 'Team' },
];
const tone = (status: string): Tone => (status === 'active' ? 'live' : status === 'suspended' || status === 'invited' ? 'wait' : 'off');
const STATUS: Record<string, string> = { active: 'Has access', suspended: 'Suspended', invited: 'Invited', revoked: 'Removed' };
const since = (value: string) => new Date(value).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

export default async function TeamPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const status = typeof params.status === 'string' ? params.status : '';
  const team = await getTeamAction();
  if (!team.ok) {
    const header = <PageHeader title="Team" tone="alert" meta="Team couldn’t load" />;
    return <PageContainer title="Team" header={header} breadcrumbs={breadcrumbs}><div className="px-4 pb-8 md:px-6"><Notice tone="alert">{team.error}</Notice></div></PageContainer>;
  }
  const all = team.data.memberships;
  const count = (value: string) => all.filter((member) => member.status === value).length;
  const owners = all.filter((member) => member.status === 'active' && member.membershipRole === 'owner').length;
  const shown = status ? all.filter((member) => member.status === status) : all;
  const header = <PageHeader title="Team" meta={`${count('active')} with access · ${owners} ${owners === 1 ? 'owner' : 'owners'}`} actions={<AddMemberButton />} />;
  return (
    <PageContainer title="Team" header={header} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-4 px-4 pb-24 md:px-6">
        <StatusTabs label="Access" current={status} hrefFor={(value) => (value ? `?status=${value}` : '?')} tabs={[
          { value: '', label: 'All', count: all.length },
          { value: 'active', label: 'Has access', count: count('active') },
          { value: 'suspended', label: 'Suspended', count: count('suspended') },
          { value: 'revoked', label: 'Removed', count: count('revoked') },
        ]} />
        {!shown.length ? <Empty>No members here.</Empty> : (
          <DataTable label="Team members" className="relative" head={[
            { label: 'Member' },
            { label: 'Role' },
            { label: 'Access' },
            { label: 'Barber profile', className: 'hidden md:table-cell' },
            { label: 'Since', className: 'hidden md:table-cell' },
            { label: <span className="sr-only">Actions</span>, className: 'w-12' },
          ]}>
            {shown.map((member) => {
              const self = member.user?.id === team.data.selfId;
              return (
                <tr key={member.id} className="hover:bg-muted/30">
                  <Td className="min-w-0 align-middle">
                    <span className="block truncate font-medium">{member.user?.name || 'Unnamed account'}{self ? <span className="ml-2 text-xs font-normal text-muted-foreground">You</span> : null}</span>
                    <span className="block max-w-[14rem] truncate text-xs text-muted-foreground sm:max-w-none">{member.user?.email || 'No email'}</span>
                  </Td>
                  <Td className="align-middle"><MemberRole member={member} /></Td>
                  <Td className="align-middle"><StatusCell tone={tone(member.status)}>{STATUS[member.status] || member.status}</StatusCell></Td>
                  <Td className="hidden align-middle md:table-cell">{member.user?.barberProfile ? <Link className="underline-offset-4 hover:underline" href={`/dashboard/platform/staff/${member.user.barberProfile.id}`}>{member.user.barberProfile.displayName}</Link> : <span className="text-muted-foreground">—</span>}</Td>
                  <Td className="hidden whitespace-nowrap align-middle tabular-nums text-muted-foreground md:table-cell">{since(member.createdAt)}</Td>
                  <Td className="align-middle text-right"><MemberMenu member={member} self={self} /></Td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </div>
    </PageContainer>
  );
}
