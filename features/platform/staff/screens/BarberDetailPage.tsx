import { notFound } from 'next/navigation';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { formatShopDateTime } from '@/features/shared/shop-time';
import { Empty, PageHeader, PillLink, Readouts, Section, StatusDot, Tag, Track, type Tone } from '@/features/platform/lib/ui';
import { getBarberPageAction } from '../actions/barbers';
import { AddCredentialButton, CredentialStatus, EditBarberButton, WeeklyHoursForm } from '../components/BarberDetailControls';
import { WorkforceControls } from './WorkforceControls';

const money = (cents?: number | null) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100);
const credentialTone = (status: string): Tone => (status === 'active' ? 'live' : status === 'suspended' ? 'wait' : 'off');
const label = (value: string) => value.replaceAll('_', ' ');

export default async function BarberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getBarberPageAction(id);
  if (!data) notFound();
  const { barber, shop } = data;
  const tone: Tone = barber.status !== 'active' ? 'off' : barber.bookingEnabled ? 'live' : 'wait';
  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'link' as const, label: 'Barbers & schedules', href: '/dashboard/platform/staff' },
    { type: 'page' as const, label: barber.displayName },
  ];
  const chair = barber.chair?.chairNumber || barber.chairNumber;
  const header = (
    <PageHeader
      title={barber.displayName}
      tone={tone}
      meta={`${chair ? `Chair ${chair}` : 'No chair'} · ${barber.status !== 'active' ? label(barber.status) : barber.bookingEnabled ? 'Books online' : 'Not booking online'}`}
      actions={<Track><PillLink href="/dashboard/platform/staff">All barbers</PillLink><EditBarberButton data={data} /></Track>}
    />
  );
  const activeCredentials = barber.credentials.filter((credential) => credential.status === 'active').length;
  return (
    <PageContainer title={barber.displayName} header={header} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-8 px-4 pb-8 md:px-6">
        <Readouts items={[
          { label: 'Working days', value: barber.schedules.filter((row) => row.isWorking).length },
          { label: 'Services', value: barber.specialties.length },
          { label: 'Commission', value: `${((barber.serviceCommissionRateBps ?? 0) / 100).toFixed(1).replace(/\.0$/, '')}%` },
          { label: 'Active credentials', value: activeCredentials, tone: activeCredentials ? 'live' : undefined },
        ]} />

        <div className="flex flex-wrap gap-1.5">{barber.specialties.map((service) => <Tag key={service.id}>{service.name}</Tag>)}{!barber.specialties.length ? <span className="text-xs text-muted-foreground">Offers every service</span> : null}</div>

        <Section id="barber-hours" title="Weekly hours">
          <WeeklyHoursForm data={data} />
        </Section>

        <Section id="barber-credentials" title="Practitioner credentials" count={barber.credentials.length} actions={<Track><AddCredentialButton data={data} /></Track>}>
          {!barber.credentials.length ? <Empty>No credentials. Only services marked licensed need one.</Empty> : (
            <ul>
              {barber.credentials.map((credential) => (
                <li key={credential.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0">
                  <div className="min-w-0">
                    <p className="font-medium"><StatusDot tone={credentialTone(credential.status)} />{credential.service?.name || 'Service'} <span className="ml-1 font-mono text-xs text-muted-foreground">{credential.credentialNumber}</span></p>
                    <p className="text-xs capitalize text-muted-foreground">{label(credential.credentialType)} · {credential.issuingAuthority} · {credential.jurisdictionCode} · {label(credential.status)} · until {formatShopDateTime(credential.expiresAt, shop.timezone)}{credential.supervisionRequired ? ` · supervised by ${credential.supervisor?.displayName || '—'}` : ''}</p>
                  </div>
                  <CredentialStatus barberId={barber.id} credentialId={credential.id} status={credential.status} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="barber-shifts" title="Shifts and time off">
          <WorkforceControls timeZone={shop.timezone} barberId={barber.id} chairId={barber.chair?.id} shifts={barber.shifts} exceptions={barber.scheduleExceptions} />
        </Section>

        <Section id="barber-visits" title="Recent visits" count={barber.appointments.length}>
          {!barber.appointments.length ? <Empty>No visits yet.</Empty> : (
            <ul>
              {barber.appointments.map((visit) => (
                <li key={visit.id} className="flex items-baseline justify-between gap-3 border-b py-2.5 text-sm last:border-b-0">
                  <span className="min-w-0 truncate"><span className="font-medium">{visit.serviceTitleSnapshot || 'Visit'}</span> <span className="text-muted-foreground">· {[visit.customer?.firstName, visit.customer?.lastName].filter(Boolean).join(' ') || 'Guest'} · {label(visit.status)}</span></span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{formatShopDateTime(visit.startsAt, shop.timezone)} · {money(visit.price)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </PageContainer>
  );
}
