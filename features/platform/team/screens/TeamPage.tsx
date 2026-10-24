import Link from 'next/link';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { StatusTabs } from '@/features/platform/lib/forms';
import { Empty, Notice, PageHeader, Readouts, Section, StatusDot, Track, type Tone } from '@/features/platform/lib/ui';
import { getTeamAction } from '../actions/team';
import { AddMemberButton, MemberActions } from '../components/TeamControls';
import { ROLE_LABELS } from '../lib/roles';

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'page' as const, label: 'Platform' },
  { type: 'page' as const, label: 'Team' },
];
const tone = (status: string): Tone => (status === 'active' ? 'live' : status === 'suspended' || status === 'invited' ? 'wait' : 'off');

export default async function TeamPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const status = typeof params.status === 'string' ? params.status : '';
  const team = await getTeamAction();
  const header = <PageHeader title="Team" tone={team.ok ? 'live' : 'alert'} actions={team.ok ? <Track><AddMemberButton /></Track> : undefined} />;
  if (!team.ok) {
    return <PageContainer title="Team" header={header} breadcrumbs={breadcrumbs}><div className="px-4 pb-8 md:px-6"><Notice tone="alert">{team.error}</Notice></div></PageContainer>;
  }
  const all = team.data.memberships;
  const count = (value: string) => all.filter((member) => member.status === value).length;
  const shown = status ? all.filter((member) => member.status === status) : all;
  return (
    <PageContainer title="Team" header={header} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-6 px-4 pb-8 md:px-6">
        <Readouts items={[
          { label: 'Active', value: count('active'), tone: 'live' },
          { label: 'Owners', value: all.filter((member) => member.status === 'active' && member.membershipRole === 'owner').length },
          { label: 'Suspended', value: count('suspended'), tone: count('suspended') ? 'wait' : undefined },
          { label: 'Removed', value: count('revoked') },
        ]} />
        <StatusTabs current={status} hrefFor={(value) => (value ? `?status=${value}` : '?')} tabs={[
          { value: '', label: 'All', count: all.length },
          { value: 'active', label: 'Active', count: count('active'), tone: 'live' },
          { value: 'suspended', label: 'Suspended', count: count('suspended'), tone: 'wait' },
          { value: 'revoked', label: 'Removed', count: count('revoked'), tone: 'off' },
        ]} />
        <Section title="Members" count={shown.length}>
          {!shown.length ? <Empty>No members here.</Empty> : (
            <ul>
              {shown.map((member) => {
                const self = member.user?.id === team.data.selfId;
                return (
                  <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0">
                    <div className="min-w-0">
                      <p className="font-medium"><StatusDot tone={tone(member.status)} />{member.user?.name || 'Unnamed account'}{self ? <span className="ml-2 text-xs font-normal text-muted-foreground">You</span> : null}</p>
                      <p className="truncate text-xs text-muted-foreground">{member.user?.email || '—'} · {ROLE_LABELS[member.membershipRole] || member.membershipRole} · {member.status === 'revoked' ? 'removed' : member.status} · since {new Date(member.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' })}{member.user?.barberProfile ? <> · <Link className="hover:underline" href={`/dashboard/platform/staff/${member.user.barberProfile.id}`}>{member.user.barberProfile.displayName}</Link></> : null}</p>
                    </div>
                    <MemberActions member={member} self={self} />
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </PageContainer>
  );
}
