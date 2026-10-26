import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import type { PublicBookingEligibility } from '@/features/shared/public-booking-eligibility';
import { DataTable, Empty, PageHeader, PillLink, Restricted, Section, StatusCell, Td, type Tone } from '@/features/platform/lib/ui';

type ServiceItem = { id: string; name: string; status: string; durationMinutes?: number; price?: number; depositAmount?: number | null };
type Data = {
  categories: Array<{ id: string; name: string; status: string; services: ServiceItem[] }>;
  uncategorizedServices: ServiceItem[];
  // null when the operator lacks membership authority for this shop.
  packages: Array<{ id: string; name: string; status: string; price?: number }> | null;
  memberships: Array<{ id: string; name: string; status: string; price?: number; includedVisits?: number }> | null;
  membershipsAccess?: 'granted' | 'restricted';
  products: Array<{ id: string; name: string; sku: string; status: string; price?: number }>;
  bookingEligibility?: { success: boolean; error?: string | null; data?: PublicBookingEligibility | null };
  metrics: { services: number; packages: number | null; memberships: number | null; products: number };
};

const money = (value?: number | null) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((value || 0) / 100);
const edit = (path: string, id: string) => `/dashboard/platform/services/${path}${encodeURIComponent(id)}`;
const num = 'text-right tabular-nums whitespace-nowrap';

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'page' as const, label: 'Platform' },
  { type: 'page' as const, label: 'Services & packages' },
];

const statusTone = (status?: string | null): Tone => (status === 'active' ? 'live' : status === 'draft' || status === 'paused' ? 'wait' : 'off');
const STATUS: Record<string, string> = { active: 'On the menu', hidden: 'Hidden', archived: 'Archived', draft: 'Draft', paused: 'Paused' };
const SALE: Record<string, string> = { active: 'For sale', hidden: 'Hidden', archived: 'Archived', draft: 'Draft', paused: 'Paused' };

function header(tone?: Tone, meta?: string) {
  return (
    <PageHeader
      title="Services & packages"
      tone={tone}
      meta={meta}
      actions={<div className="flex flex-wrap items-center gap-1.5"><PillLink href="/dashboard/platform/services/categories">Categories</PillLink><PillLink variant="primary" href="/dashboard/platform/services/new"><Plus /> Service</PillLink></div>}
    />
  );
}

type Row = ServiceItem & { category: { name: string; status: string } | null };

export default async function ServicesPage() {
  const [response, staff] = await Promise.all([
    keystoneClient<{ platformServices: { success: boolean; error?: string; data?: Data } }>(`
      query ServicesProjection { platformServices { success error data } }
    `, {}, { cache: 'no-store' }),
    // Who performs each service comes from the staff roster (barber specialties).
    keystoneClient<{ platformStaff: { success: boolean; data?: { barbers: Array<{ id: string; displayName: string; status: string; specialties: Array<{ id: string }> }> } | null } }>(`query StaffForServices { platformStaff { success data } }`, {}, { cache: 'no-store' }).catch(() => null),
  ]);
  const result = response.data?.platformServices;

  if (!response.success || !result?.success || !result.data) {
    return (
      <PageContainer title="Services & packages" header={header('alert')} breadcrumbs={breadcrumbs}>
        <div className="px-4 pb-8 md:px-6">
          <Alert variant="destructive"><AlertDescription>{result?.error || response.error || 'The service catalog is temporarily unavailable. Refresh to try again.'}</AlertDescription></Alert>
        </div>
      </PageContainer>
    );
  }

  const data = result.data;
  const roster = staff?.data?.platformStaff?.success ? staff.data.platformStaff.data?.barbers || null : null;
  const barbersFor = (serviceId: string) => roster?.filter((barber) => barber.specialties.some((service) => service.id === serviceId)).map((barber) => barber.displayName) || [];
  const rows: Row[] = [
    ...data.categories.flatMap((category) => category.services.map((service) => ({ ...service, category: { name: category.name, status: category.status } }))),
    ...data.uncategorizedServices.map((service) => ({ ...service, category: null })),
  ];
  const restrictedMemberships = data.membershipsAccess === 'restricted' || data.packages === null || data.memberships === null;
  const packages = data.packages || [];
  const memberships = data.memberships || [];
  const eligibility = data.bookingEligibility?.data || null;
  // Mirrors the booking policy: active services, and under "active catalog" only those in an active category.
  const online = (row: Row) => row.status === 'active' && (!eligibility ? null : eligibility.publicServiceEligibility === 'legacy_active_service' || row.category?.status === 'active');
  const onlineCount = rows.filter((row) => online(row)).length;
  const meta = eligibility ? `${onlineCount} of ${rows.length} bookable online · ${eligibility.description.toLowerCase()}` : `Online booking status unavailable${data.bookingEligibility?.error ? `: ${data.bookingEligibility.error}` : ''}`;

  return (
    <PageContainer title="Services & packages" header={header(eligibility ? undefined : 'alert', meta)} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-8 px-4 pb-24 md:px-6">
        <Section id="svc-menu" title="Service menu" count={rows.length} actions={<Link className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href="/dashboard/platform/policies">Booking policy</Link>}>
          {!rows.length ? <Empty>No services yet. <Link className="underline" href="/dashboard/platform/services/new">Add a service</Link></Empty> : (
            <DataTable label="Service menu" className="relative" head={[
              { label: 'Service' },
              { label: 'Category', className: 'hidden md:table-cell' },
              { label: 'Time', className: 'hidden text-right sm:table-cell' },
              { label: 'Price', className: 'text-right' },
              { label: 'Barbers', className: 'hidden lg:table-cell' },
              { label: 'Online', className: 'hidden sm:table-cell' },
              { label: 'Status', className: 'hidden md:table-cell' },
              { label: <span className="sr-only">Actions</span>, className: 'w-px' },
            ]}>
              {rows.map((row) => {
                const isOnline = online(row);
                const barbers = barbersFor(row.id);
                return (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <Td className="align-middle">
                      <Link href={edit('', row.id)} className="font-medium underline-offset-4 hover:underline">{row.name}</Link>
                      <span className="block text-xs text-muted-foreground md:hidden">{row.category?.name || 'No category'} · <span className="tabular-nums">{row.durationMinutes || 30} min</span></span>
                    </Td>
                    <Td className="hidden align-middle md:table-cell">{row.category ? <>{row.category.name}{row.category.status !== 'active' ? <span className="block text-xs text-muted-foreground">Category hidden</span> : null}</> : <span className="text-muted-foreground">None</span>}</Td>
                    <Td className={`${num} hidden align-middle sm:table-cell`}>{row.durationMinutes || 30} min</Td>
                    <Td className={`${num} align-middle font-medium`}>{money(row.price)}</Td>
                    <Td className="hidden max-w-56 align-middle lg:table-cell">{roster === null ? <span className="text-muted-foreground">—</span> : barbers.length ? <span className="line-clamp-2">{barbers.join(', ')}</span> : <span className="text-muted-foreground">Any barber</span>}</Td>
                    <Td className="hidden align-middle sm:table-cell">
                      {isOnline === null ? <span className="text-muted-foreground">—</span> : <StatusCell tone={isOnline ? 'live' : 'off'}>{isOnline ? 'Online' : 'Staff only'}</StatusCell>}
                      {row.depositAmount ? <span className="block text-xs tabular-nums text-muted-foreground">Deposit {money(row.depositAmount)}</span> : null}
                    </Td>
                    <Td className="hidden align-middle md:table-cell"><StatusCell tone={statusTone(row.status)}>{STATUS[row.status] || row.status}</StatusCell></Td>
                    <Td className="align-middle text-right"><PillLink size="sm" href={edit('', row.id)}>Edit</PillLink></Td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </Section>

        <div className="grid min-w-0 gap-8 xl:grid-cols-2">
          <Section
            id="svc-plans"
            title="Packages & memberships"
            count={restrictedMemberships ? undefined : packages.length + memberships.length}
            actions={!restrictedMemberships ? <div className="flex items-center gap-1.5"><PillLink size="sm" href="/dashboard/platform/services/packages/new"><Plus /> Package</PillLink><PillLink size="sm" href="/dashboard/platform/services/plans/new"><Plus /> Plan</PillLink></div> : undefined}
          >
            {restrictedMemberships
              ? <Restricted>Packages and memberships restricted for your role.</Restricted>
              : !packages.length && !memberships.length
                ? <Empty>No packages or memberships.</Empty>
                : (
                  <DataTable label="Packages and memberships" className="relative" head={[
                    { label: 'Name' },
                    { label: 'Type', className: 'hidden sm:table-cell' },
                    { label: 'Price', className: 'text-right' },
                    { label: 'Status', className: 'hidden sm:table-cell' },
                  ]}>
                    {packages.map((pkg) => (
                      <tr key={pkg.id} className="hover:bg-muted/30">
                        <Td className="align-middle"><Link className="font-medium underline-offset-4 hover:underline" href={edit('packages/', pkg.id)}>{pkg.name}</Link></Td>
                        <Td className="hidden align-middle text-muted-foreground sm:table-cell">Package</Td>
                        <Td className={`${num} align-middle`}>{money(pkg.price)}</Td>
                        <Td className="hidden align-middle sm:table-cell"><StatusCell tone={statusTone(pkg.status)}>{SALE[pkg.status] || pkg.status}</StatusCell></Td>
                      </tr>
                    ))}
                    {memberships.map((plan) => (
                      <tr key={plan.id} className="hover:bg-muted/30">
                        <Td className="align-middle"><Link className="font-medium underline-offset-4 hover:underline" href={edit('plans/', plan.id)}>{plan.name}</Link></Td>
                        <Td className="hidden align-middle text-muted-foreground sm:table-cell">Membership · {plan.includedVisits ?? 0} {(plan.includedVisits ?? 0) === 1 ? 'visit' : 'visits'}</Td>
                        <Td className={`${num} align-middle`}>{money(plan.price)}</Td>
                        <Td className="hidden align-middle sm:table-cell"><StatusCell tone={statusTone(plan.status)}>{SALE[plan.status] || plan.status}</StatusCell></Td>
                      </tr>
                    ))}
                  </DataTable>
                )}
          </Section>

          <Section id="svc-retail" title="Retail" count={data.products.length} actions={<PillLink size="sm" href="/dashboard/platform/services/new-product"><Plus /> Product</PillLink>}>
            {!data.products.length ? <Empty>No retail products.</Empty> : (
              <DataTable label="Retail products" className="relative" head={[
                { label: 'Product' },
                { label: 'SKU', className: 'hidden sm:table-cell' },
                { label: 'Price', className: 'text-right' },
                { label: 'Status', className: 'hidden sm:table-cell' },
              ]}>
                {data.products.map((product) => (
                  <tr key={product.id} className="hover:bg-muted/30">
                    <Td className="align-middle"><Link className="font-medium underline-offset-4 hover:underline" href={`/dashboard/platform/inventory/${product.id}`}>{product.name}</Link></Td>
                    <Td className="hidden align-middle font-mono text-xs text-muted-foreground sm:table-cell">{product.sku || '—'}</Td>
                    <Td className={`${num} align-middle`}>{money(product.price)}</Td>
                    <Td className="hidden align-middle sm:table-cell"><StatusCell tone={statusTone(product.status)}>{SALE[product.status] || product.status}</StatusCell></Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Section>
        </div>
      </div>
    </PageContainer>
  );
}
