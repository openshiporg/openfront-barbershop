import Link from 'next/link';
import { PackageOpen, Plus, ShoppingBag } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import type { PublicBookingEligibility } from '@/features/shared/public-booking-eligibility';

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
const item = (slug: string, id: string) => `${basePath}/${slug}/${id}`;
const create = (slug: string) => `${basePath}/${slug}/create`;

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'page' as const, label: 'Platform' },
  { type: 'page' as const, label: 'Services & packages' },
];

function header() {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Services & packages</h1>
        <p className="text-muted-foreground">Services, prices, deposits, packages, memberships, and retail products.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm"><Link href={create('services')}><Plus className="size-4" /> New service</Link></Button>
        <Button asChild size="sm" variant="outline"><Link href={create('service-categories')}>New category</Link></Button>
      </div>
    </div>
  );
}

function SectionEmpty({ title, description, href, label }: { title: string; description: string; href: string; label: string }) {
  return (
    <div className="rounded-lg border border-dashed">
      <EmptyState title={title} description={description} icons={[PackageOpen]} className="p-8" />
      <div className="-mt-4 pb-6 text-center"><Button asChild size="sm" variant="outline"><Link href={href}>{label}</Link></Button></div>
    </div>
  );
}

function ServiceList({ services }: { services: ServiceItem[] }) {
  return <div className="grid gap-2 md:grid-cols-2">{services.map((service) => <Link key={service.id} href={item('services', service.id)} className="rounded-lg border p-3 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="flex justify-between gap-3"><strong>{service.name}</strong><span>{money(service.price)}</span></div><p className="text-sm text-muted-foreground">{service.durationMinutes || 30} min · {service.status}{service.depositAmount ? ` · deposit ${money(service.depositAmount)}` : ''}</p><span className="text-xs text-primary">Edit service</span></Link>)}</div>;
}

export default async function ServicesPage() {
  const response = await keystoneClient<{ platformServices: { success: boolean; error?: string; data?: Data } }>(`
    query ServicesProjection { platformServices { success error data } }
  `, {}, { cache: 'no-store' });
  const result = response.data?.platformServices;

  if (!response.success || !result?.success || !result.data) {
    return (
      <PageContainer title="Services & packages" header={header()} breadcrumbs={breadcrumbs}>
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

  return (
    <PageContainer title="Services & packages" header={header()} breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-6 px-4 pb-8 md:px-6">
        <Card>
          <CardHeader><CardTitle>Online booking eligibility</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{data.bookingEligibility?.data?.description || data.bookingEligibility?.error || 'Booking eligibility could not be loaded.'}</p>
            {data.bookingEligibility?.data && <p className="text-muted-foreground">Policy version {data.bookingEligibility.data.version} · {data.bookingEligibility.data.publicServiceEligibility}</p>}
            <p className="text-muted-foreground">Services without a category stay bookable by staff but are not listed on the storefront. Change eligibility by adding a new booking policy; existing appointments keep the policy they were booked under.</p>
            <Button asChild size="sm" variant="outline"><Link href={`${basePath}/booking-policies`}>Booking policies</Link></Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader><div className="flex items-center justify-between gap-2"><CardTitle>Service menu</CardTitle><Badge variant="secondary">{data.metrics.services} services</Badge></div></CardHeader>
            <CardContent className="space-y-4">
              {!hasServices && !data.categories.length && <SectionEmpty title="No services yet" description="Add the services customers can book." href={create('services')} label="Add a service" />}
              {data.categories.map((category) => (
                <section key={category.id}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 className="font-semibold"><Link className="hover:underline" href={item('service-categories', category.id)}>{category.name}</Link></h2>
                    <Badge variant="secondary">{category.status}</Badge>
                  </div>
                  {category.services.length ? <ServiceList services={category.services} /> : <p className="text-sm text-muted-foreground">No services in this category.</p>}
                </section>
              ))}
              {data.uncategorizedServices.length > 0 && <section><div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Services without a category</h2><Badge variant="outline">No category</Badge></div><ServiceList services={data.uncategorizedServices} /></section>}
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>Packages & memberships</CardTitle>
                  {!restrictedMemberships && <div className="flex gap-1"><Button asChild size="sm" variant="outline"><Link href={create('service-packages')}>New package</Link></Button><Button asChild size="sm" variant="outline"><Link href={create('membership-plans')}>New plan</Link></Button></div>}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {restrictedMemberships
                  ? <p role="status" className="text-sm text-muted-foreground">Packages and memberships restricted. Your role does not include membership access for this shop.</p>
                  : !packages.length && !memberships.length
                    ? <SectionEmpty title="No packages or memberships" description="Sell prepaid visits or recurring plans." href={create('service-packages')} label="Add a package" />
                    : <>
                        {packages.map((pkg) => <Link key={pkg.id} href={item('service-packages', pkg.id)} className="flex justify-between rounded-lg border p-3 hover:bg-muted/50"><span>{pkg.name}<small className="block text-muted-foreground">Package · {pkg.status}</small></span><strong>{money(pkg.price)}</strong></Link>)}
                        {memberships.map((plan) => <Link key={plan.id} href={item('membership-plans', plan.id)} className="flex justify-between rounded-lg border p-3 hover:bg-muted/50"><span>{plan.name}<small className="block text-muted-foreground">Membership · {plan.includedVisits ?? 0} visits · {plan.status}</small></span><strong>{money(plan.price)}</strong></Link>)}
                      </>}
                <p className="text-xs text-muted-foreground">Price changes apply to new sales only; balances customers already bought keep their original terms.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><div className="flex items-center justify-between gap-2"><CardTitle>Retail products</CardTitle><Button asChild size="sm" variant="outline"><Link href={create('products')}><ShoppingBag className="size-4" /> New product</Link></Button></div></CardHeader>
              <CardContent className="space-y-2">
                {!data.products.length && <SectionEmpty title="No retail products" description="Add products to sell at checkout." href={create('products')} label="Add a product" />}
                {data.products.map((product) => <Link key={product.id} href={item('products', product.id)} className="flex justify-between rounded-lg border p-3 hover:bg-muted/50"><span>{product.name}<small className="block text-muted-foreground">{product.sku} · {product.status}</small></span><strong>{money(product.price)}</strong></Link>)}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
