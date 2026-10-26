import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { formatShopDateTime } from '@/features/shared/shop-time';
import { DataTable, Empty, Notice, PageHeader, PillLink, Readouts, Section, StatusCell, StatusDot, Td, Track, type Tone } from '@/features/platform/lib/ui';
import { ReconciliationControls } from '@/features/platform/barbershop/screens/OperationsControls';
import { getPaymentsAction } from '../actions/payments';
import { ProviderInstall, SetUpManualPayments, SetUpStripe } from '../components/PaymentControls';

const breadcrumbs = [
  { type: 'link' as const, label: 'Dashboard', href: basePath },
  { type: 'page' as const, label: 'Platform' },
  { type: 'page' as const, label: 'Payments' },
];
const money = (cents?: number | null) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100);
const TENDER: Record<string, string> = { cash: 'Cash', card: 'Card terminal', package: 'Package visit', gift_card: 'Gift card', other: 'Other' };
const label = (value: string) => value.replaceAll('_', ' ');

/** Provider codes are internal; show the operator what each one does. */
const PROVIDER_ROLE: Record<string, string> = { pp_manual: 'Cash and card terminal at the counter', pp_stripe: 'Online card payments and booking deposits' };

function SetupRow({ title, tone, status, detail, action }: { title: string; tone: Tone; status: string; detail?: string; action?: ReactNode }) {
  return (
    <li className="flex flex-col gap-2 border-b py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <StatusCell tone={tone}>{status}</StatusCell>
        {action}
      </div>
    </li>
  );
}

export default async function PaymentsPage() {
  const data = await getPaymentsAction();
  const counterOn = Boolean(data?.providers.some((provider) => provider.code !== 'pp_stripe' && provider.isInstalled));
  const stripeOn = Boolean(data?.stripeKeyConfigured && data.providers.some((provider) => provider.code === 'pp_stripe' && provider.isInstalled));
  const header = (
    <PageHeader
      title="Payments"
      tone={data ? (counterOn || stripeOn ? 'live' : 'wait') : 'alert'}
      meta={data ? `${data.shopName} · ${stripeOn ? 'Card payments connected' : 'Card payments not connected'}` : undefined}
      actions={<Track><PillLink href="/dashboard/platform/pos">POS checkout</PillLink></Track>}
    />
  );
  if (!data) return <PageContainer title="Payments" header={header} breadcrumbs={breadcrumbs}><div className="px-4 pb-24 md:px-6"><Notice tone="alert">Payments couldn’t load. Your role may not include payments.</Notice></div></PageContainer>;

  const stripeProvider = data.providers.find((provider) => provider.code === 'pp_stripe');
  const settled = data.receipts.filter((receipt) => ['paid', 'partially_refunded', 'refunded'].includes(receipt.status));
  const byTender = new Map<string, { count: number; total: number }>();
  for (const receipt of settled) {
    const entry = byTender.get(receipt.paymentMethod) || { count: 0, total: 0 };
    entry.count += 1;
    entry.total += receipt.total || 0;
    byTender.set(receipt.paymentMethod, entry);
  }

  const cardStatus = stripeOn ? 'Connected' : data.stripeKeyConfigured ? (stripeProvider ? 'Turned off' : 'Ready to connect') : 'Not connected';
  const cardDetail = stripeOn
    ? 'Customers can pay deposits when they book'
    : data.stripeKeyConfigured ? 'Deposit services ask customers to call' : 'Deposit services ask customers to call · needs a Stripe key on the server';

  return (
    <PageContainer title="Payments" header={header} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-8 px-4 pb-24 md:px-6">
        <Readouts items={[
          { label: 'Taken, 30 days', value: money(settled.reduce((sum, receipt) => sum + (receipt.total || 0), 0)) },
          { label: 'Receipts', value: settled.length },
          { label: 'Tips', value: money(settled.reduce((sum, receipt) => sum + (receipt.tipAmount || 0), 0)) },
          { label: 'Open card payments', value: data.sessions.length, tone: data.sessions.length ? 'wait' : undefined },
        ]} />

        <Section id="payments-setup" title="Payment setup">
          <ul className="rounded-[6px] border px-3">
            <SetupRow
              title="Counter payments"
              detail="Cash and card terminal at checkout"
              tone={counterOn ? 'live' : 'wait'}
              status={counterOn ? 'On' : data.providers.length ? 'Turned off' : 'Not set up'}
              action={!data.providers.length ? <SetUpManualPayments /> : null}
            />
            <SetupRow
              title="Card payments online"
              detail={cardDetail}
              tone={stripeOn ? 'live' : 'off'}
              status={cardStatus}
              action={data.stripeKeyConfigured && !stripeOn ? <SetUpStripe /> : null}
            />
          </ul>
          <details className="group mt-3 text-sm">
            <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-[6px] px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <ChevronRight aria-hidden="true" className="size-3.5 transition-transform duration-150 group-open:rotate-90" />
              Configuration details
            </summary>
            <div className="mt-2 space-y-3">
              <p className="text-xs text-muted-foreground">
                <StatusDot tone={data.stripeKeyConfigured ? 'live' : 'off'} />
                Stripe secret key on the server: {data.stripeKeyConfigured ? 'set' : <>not set (<code className="text-[11px]">STRIPE_SECRET_KEY</code>)</>}
              </p>
              {!data.providers.length ? <Empty>No payment providers yet.</Empty> : (
                <DataTable label="Payment providers" head={[{ label: 'Provider' }, { label: 'Used for', className: 'max-sm:hidden' }, { label: 'Status' }, { label: 'Payments', className: 'text-right' }, { label: <span className="sr-only">Actions</span>, className: 'text-right' }]} className="relative">
                  {data.providers.map((provider) => (
                    <tr key={provider.id}>
                      <Td>
                        <p className="font-medium">{provider.name}</p>
                        <p className="text-[11px] text-muted-foreground"><code>{provider.code}</code></p>
                      </Td>
                      <Td className="text-muted-foreground max-sm:hidden">{PROVIDER_ROLE[provider.code] || 'Other payments'}</Td>
                      <Td><StatusCell tone={provider.isInstalled ? 'live' : 'off'}>{provider.isInstalled ? 'On' : 'Off'}</StatusCell></Td>
                      <Td className="text-right tabular-nums">{provider.paymentSessionsCount}</Td>
                      <Td className="text-right"><ProviderInstall id={provider.id} installed={provider.isInstalled} /></Td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </div>
          </details>
        </Section>

        {data.sessions.length > 0 ? (
          <Section id="payments-sessions" title="Open card payments" tone="wait" count={data.sessions.length}>
            <ReconciliationControls sessions={data.sessions} />
          </Section>
        ) : null}

        <div className="grid min-w-0 items-start gap-8 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <Section id="payments-tenders" title="By tender, 30 days" count={byTender.size}>
            {!byTender.size ? <Empty>No payments in the last 30 days.</Empty> : (
              <ul>{[...byTender.entries()].map(([method, entry]) => <li key={method} className="flex justify-between gap-3 border-b py-2.5 text-sm last:border-b-0"><span>{TENDER[method] || label(method)} <span className="text-xs tabular-nums text-muted-foreground">· {entry.count}</span></span><span className="tabular-nums">{money(entry.total)}</span></li>)}</ul>
            )}
          </Section>
          <Section id="payments-receipts" title="Recent receipts" count={Math.min(15, data.receipts.length)} actions={<Link href="/dashboard/platform/pos" className="text-xs font-medium underline-offset-4 hover:underline">All in POS</Link>}>
            {!data.receipts.length ? <Empty>No receipts yet.</Empty> : (
              <DataTable label="Recent receipts" className="relative" head={[{ label: 'Customer' }, { label: 'Tender', className: 'max-sm:hidden' }, { label: 'When', className: 'max-md:hidden' }, { label: 'Status' }, { label: 'Total', className: 'text-right' }]}>
                {data.receipts.slice(0, 15).map((receipt) => (
                  <tr key={receipt.id}>
                    <Td><Link className="font-medium underline-offset-4 hover:underline" href={`/dashboard/platform/pos?receipt=${encodeURIComponent(receipt.id)}`}>{[receipt.customer?.firstName, receipt.customer?.lastName].filter(Boolean).join(' ') || 'Walk-in sale'}</Link></Td>
                    <Td className="text-muted-foreground max-sm:hidden">{TENDER[receipt.paymentMethod] || label(receipt.paymentMethod)}</Td>
                    <Td className="whitespace-nowrap tabular-nums text-muted-foreground max-md:hidden">{receipt.completedAt ? formatShopDateTime(receipt.completedAt, data.timezone) : '—'}</Td>
                    <Td><StatusCell tone={receipt.status === 'paid' ? 'live' : receipt.status === 'voided' ? 'off' : 'wait'}><span className="capitalize">{label(receipt.status)}</span></StatusCell></Td>
                    <Td className="text-right font-medium tabular-nums">{money(receipt.total)}</Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Section>
        </div>

        {data.reconciliations.length > 0 ? (
          <Section id="payments-checks" title="Processor checks" count={data.reconciliations.length}>
            <ul>{data.reconciliations.map((check) => <li key={check.id} className="flex justify-between gap-3 border-b py-2.5 text-sm last:border-b-0"><span>{check.changed ? <StatusDot tone="wait" /> : null}{formatShopDateTime(check.observedAt, data.timezone)} <span className="text-xs text-muted-foreground">· {label(check.localStatusBefore)} → {label(check.localStatusAfter)} (processor {label(check.remoteStatus)})</span></span><span className="tabular-nums">{money(check.amount)}</span></li>)}</ul>
          </Section>
        ) : null}
      </div>
    </PageContainer>
  );
}
