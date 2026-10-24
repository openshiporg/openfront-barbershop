import Link from 'next/link';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { basePath } from '@/features/dashboard/lib/config';
import { formatShopDateTime } from '@/features/shared/shop-time';
import { Empty, Notice, PageHeader, PillLink, Readouts, Section, StatusDot, Track } from '@/features/platform/lib/ui';
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

export default async function PaymentsPage() {
  const data = await getPaymentsAction();
  const header = <PageHeader title="Payments" tone={data ? (data.providers.some((provider) => provider.isInstalled) ? 'live' : 'wait') : 'alert'} meta={data?.shopName} actions={<Track><PillLink href="/dashboard/platform/pos">POS checkout</PillLink></Track>} />;
  if (!data) return <PageContainer title="Payments" header={header} breadcrumbs={breadcrumbs}><div className="px-4 pb-8 md:px-6"><Notice tone="alert">Payments couldn’t load. Your role may not include payments.</Notice></div></PageContainer>;
  const stripeOn = data.stripeKeyConfigured && data.providers.some((provider) => provider.code === 'pp_stripe' && provider.isInstalled);
  const settled = data.receipts.filter((receipt) => ['paid', 'partially_refunded', 'refunded'].includes(receipt.status));
  const byTender = new Map<string, { count: number; total: number }>();
  for (const receipt of settled) {
    const entry = byTender.get(receipt.paymentMethod) || { count: 0, total: 0 };
    entry.count += 1;
    entry.total += receipt.total || 0;
    byTender.set(receipt.paymentMethod, entry);
  }
  return (
    <PageContainer title="Payments" header={header} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-8 px-4 pb-8 md:px-6">
        <Readouts items={[
          { label: 'Taken, 30 days', value: money(settled.reduce((sum, receipt) => sum + (receipt.total || 0), 0)) },
          { label: 'Receipts', value: settled.length },
          { label: 'Tips', value: money(settled.reduce((sum, receipt) => sum + (receipt.tipAmount || 0), 0)) },
          { label: 'Open card payments', value: data.sessions.length, tone: data.sessions.length ? 'wait' : undefined },
        ]} />

        <Section id="payments-providers" title="Payment methods" count={data.providers.length} actions={<span className="flex flex-wrap gap-2">{!data.providers.length ? <SetUpManualPayments /> : null}{data.stripeKeyConfigured && !data.providers.some((provider) => provider.code === 'pp_stripe' && provider.isInstalled) ? <SetUpStripe /> : null}</span>}>
          <p className="pb-3 text-xs text-muted-foreground"><StatusDot tone={stripeOn ? 'live' : 'off'} />{stripeOn ? 'Online deposits on (Stripe)' : data.stripeKeyConfigured ? 'Online deposits off' : 'Online deposits off · STRIPE_SECRET_KEY not set on the server'}</p>
          {!data.providers.length ? <Empty>No payment method set up.</Empty> : (
            <ul>
              {data.providers.map((provider) => (
                <li key={provider.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0">
                  <span><span className="font-medium"><StatusDot tone={provider.isInstalled ? 'live' : 'off'} />{provider.name}</span><span className="block font-mono text-xs text-muted-foreground">{provider.code} · {provider.isInstalled ? 'on' : 'off'} · {provider.paymentSessionsCount} sessions</span></span>
                  <ProviderInstall id={provider.id} installed={provider.isInstalled} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <div className="grid min-w-0 gap-8 xl:grid-cols-2">
          <Section id="payments-tenders" title="By tender, 30 days" count={byTender.size}>
            {!byTender.size ? <Empty>No payments in the last 30 days.</Empty> : (
              <ul>{[...byTender.entries()].map(([method, entry]) => <li key={method} className="flex justify-between gap-3 border-b py-2.5 text-sm last:border-b-0"><span>{TENDER[method] || label(method)} <span className="text-xs text-muted-foreground">· {entry.count}</span></span><span className="font-mono tabular-nums">{money(entry.total)}</span></li>)}</ul>
            )}
          </Section>
          <Section id="payments-receipts" title="Recent receipts" count={Math.min(15, data.receipts.length)}>
            {!data.receipts.length ? <Empty>No receipts yet.</Empty> : (
              <ul>{data.receipts.slice(0, 15).map((receipt) => <li key={receipt.id} className="flex items-baseline justify-between gap-3 border-b py-2.5 text-sm last:border-b-0"><Link className="min-w-0 truncate hover:underline" href={`/dashboard/platform/pos?receipt=${encodeURIComponent(receipt.id)}`}><StatusDot tone={receipt.status === 'paid' ? 'live' : receipt.status === 'voided' ? 'off' : 'wait'} />{[receipt.customer?.firstName, receipt.customer?.lastName].filter(Boolean).join(' ') || 'Walk-in sale'} <span className="text-xs text-muted-foreground">· {TENDER[receipt.paymentMethod] || label(receipt.paymentMethod)} · {receipt.completedAt ? formatShopDateTime(receipt.completedAt, data.timezone) : label(receipt.status)}</span></Link><span className="font-mono tabular-nums">{money(receipt.total)}</span></li>)}</ul>
            )}
          </Section>
        </div>

        {data.sessions.length > 0 ? (
          <Section id="payments-sessions" title="Open card payments" tone="wait" count={data.sessions.length}>
            <ReconciliationControls sessions={data.sessions} />
          </Section>
        ) : null}

        {data.reconciliations.length > 0 ? (
          <Section id="payments-checks" title="Processor checks" count={data.reconciliations.length}>
            <ul>{data.reconciliations.map((check) => <li key={check.id} className="flex justify-between gap-3 border-b py-2.5 text-sm last:border-b-0"><span>{check.changed ? <StatusDot tone="wait" /> : null}{formatShopDateTime(check.observedAt, data.timezone)} <span className="text-xs text-muted-foreground">· {label(check.localStatusBefore)} → {label(check.localStatusAfter)} (processor {label(check.remoteStatus)})</span></span><span className="font-mono tabular-nums">{money(check.amount)}</span></li>)}</ul>
          </Section>
        ) : null}
      </div>
    </PageContainer>
  );
}
