import Link from 'next/link';
import { Plus, ShoppingBag } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import type { PublicBookingEligibility } from '@/features/shared/public-booking-eligibility';
import { Empty, PageHeader, PillLink, Readouts, Restricted, Section, StatusDot, Track, type Tone } from '@/features/platform/lib/ui';

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

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'page' as const, label: 'Platform' },
  { type: 'page' as const, label: 'Services & packages' },
];

const statusTone = (status?: string | null): Tone => (status === 'active' ? 'live' : status === 'draft' ? 'wait' : 'off');

function header(tone?: Tone) {
  return (
    <PageHeader
      title="Services & packages"
      tone={tone}
      actions={<Track><PillLink variant="primary" href="/dashboard/platform/services/new"><Plus /> Service</PillLink><PillLink href="/dashboard/platform/services/categories">Categories</PillLink></Track>}
    />
  );
}

function ServiceRows({ services }: { services: ServiceItem[] }) {
  return (
    <ul>
      {services.map((service) => (
        <li key={service.id}>
          <Link href={edit('', service.id)} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-b py-2.5 last:border-b-0 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="min-w-0 truncate font-medium"><StatusDot tone={statusTone(service.status)} />{service.name}</span>
            <span className="font-mono text-sm tabular-nums">{money(service.price)}</span>
            <span className="col-span-2 pl-4 text-xs text-muted-foreground"><span className="font-mono">{service.durationMinutes || 30} min</span> · {service.status}{service.depositAmount ? ` · deposit ${money(service.depositAmount)}` : ''}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PriceRow({ href, name, sub, price, status }: { href: string; name: string; sub: string; price?: number; status: string }) {
  return (
    <li>
      <Link href={href} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-b py-2.5 last:border-b-0 hover:bg-muted/40">
        <span className="min-w-0 truncate font-medium"><StatusDot tone={statusTone(status)} />{name}</span>
        <span className="font-mono text-sm tabular-nums">{money(price)}</span>
        <span className="col-span-2 pl-4 text-xs text-muted-foreground">{sub}</span>
      </Link>
    </li>
  );
}

export default async function ServicesPage() {
  const response = await keystoneClient<{ platformServices: { success: boolean; error?: string; data?: Data } }>(`
    query ServicesProjection { platformServices { success error data } }
  `, {}, { cache: 'no-store' });
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
  const hasServices = data.categories.some((category) => category.services.length > 0) || data.uncategorizedServices.length > 0;
  const restrictedMemberships = data.membershipsAccess === 'restricted' || data.packages === null || data.memberships === null;
  const packages = data.packages || [];
  const memberships = data.memberships || [];
  const eligibility = data.bookingEligibility;

  return (
    <PageContainer title="Services & packages" header={header()} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-8 px-4 pb-8 md:px-6">
        <Readouts items={[
          { label: 'Services', value: data.metrics.services },
          { label: 'Packages', value: data.metrics.packages ?? '—' },
          { label: 'Memberships', value: data.metrics.memberships ?? '—' },
          { label: 'Retail products', value: data.metrics.products },
        ]} />

        <Section
          id="svc-eligibility"
          title="Online booking"
          tone={eligibility?.data ? 'live' : 'alert'}
          actions={<Track><PillLink size="sm" href="/dashboard/platform/policies">Policies</PillLink></Track>}
        >
          <p className="text-sm">{eligibility?.data?.description || eligibility?.error || 'Booking eligibility could not be loaded.'}</p>
          {data.uncategorizedServices.length > 0 && <p className="mt-2 text-xs text-muted-foreground"><StatusDot tone="off" />Uncategorized services: staff booking only.</p>}
        </Section>

        <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
          <Section id="svc-menu" title="Service menu" count={data.metrics.services}>
            {!hasServices && !data.categories.length && <Empty>No services yet. <Link className="underline" href="/dashboard/platform/services/new">Add a service</Link></Empty>}
            <div className="space-y-6">
              {data.categories.map((category) => (
                <div key={category.id}>
                  <h3 className="flex items-baseline justify-between gap-2 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <Link className="hover:text-foreground hover:underline" href="/dashboard/platform/services/categories"><StatusDot tone={statusTone(category.status)} />{category.name}</Link>
                    <span className="font-mono tabular-nums">{category.services.length}</span>
                  </h3>
                  {category.services.length ? <ServiceRows services={category.services} /> : <Empty>No services in this category.</Empty>}
                </div>
              ))}
              {data.uncategorizedServices.length > 0 && (
                <div>
                  <h3 className="pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"><StatusDot tone="off" />No category</h3>
                  <ServiceRows services={data.uncategorizedServices} />
                </div>
              )}
            </div>
          </Section>

          <div className="grid min-w-0 content-start gap-8">
            <Section
              id="svc-plans"
              title="Packages & memberships"
              count={restrictedMemberships ? undefined : packages.length + memberships.length}
              actions={!restrictedMemberships ? <Track><PillLink size="sm" href="/dashboard/platform/services/packages/new">Package</PillLink><PillLink size="sm" href="/dashboard/platform/services/plans/new">Plan</PillLink></Track> : undefined}
            >
              {restrictedMemberships
                ? <Restricted>Packages and memberships restricted for your role.</Restricted>
                : !packages.length && !memberships.length
                  ? <Empty>No packages or memberships.</Empty>
                  : <ul>
                      {packages.map((pkg) => <PriceRow key={pkg.id} href={edit('packages/', pkg.id)} name={pkg.name} sub={`Package · ${pkg.status}`} price={pkg.price} status={pkg.status} />)}
                      {memberships.map((plan) => <PriceRow key={plan.id} href={edit('plans/', plan.id)} name={plan.name} sub={`Membership · ${plan.includedVisits ?? 0} ${(plan.includedVisits ?? 0) === 1 ? 'visit' : 'visits'} · ${plan.status}`} price={plan.price} status={plan.status} />)}
                    </ul>}
            </Section>
            <Section id="svc-retail" title="Retail" count={data.products.length} actions={<Track><PillLink size="sm" href="/dashboard/platform/services/new-product"><ShoppingBag /> Product</PillLink></Track>}>
              {!data.products.length && <Empty>No retail products.</Empty>}
              <ul>{data.products.map((product) => <PriceRow key={product.id} href={`/dashboard/platform/inventory/${product.id}`} name={product.name} sub={`${product.sku} · ${product.status}`} price={product.price} status={product.status} />)}</ul>
            </Section>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
