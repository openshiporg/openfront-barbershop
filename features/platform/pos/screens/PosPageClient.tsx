'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCommandKey } from '@/features/platform/lib/useCommandKey';
import { shopDateKey } from '@/features/shared/shop-time';
import { cn } from '@/lib/utils';
import { Empty, Notice, Pager as KitPager, Pill, PillLink, selectClass, StatusCell, StatusDot, Track, type Tone } from '@/features/platform/lib/ui';
import { LocalTabs, Segmented } from '@/features/platform/booking/components/FloorKit';
import { checkoutAppointmentAction, recordProductSaleAction, refundCashCheckoutAction, returnProductSaleAction, type PosQuery } from '../actions/checkout';
import type { Paging, PosAppointment, PosCustomerSummary, PosProjectionData, PosReceipt, ProductLineSummary } from '../lib/posTypes';

type Feedback = { tone: 'status' | 'alert'; text: string } | null;

const interrupted = 'Connection interrupted. The action may have completed. Retry to confirm; the same request will be reused.';
const checkoutStatuses = ['checked_in', 'in_chair', 'completed'];

function formatMoney(cents?: number | null) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function formatDateTime(value: string | null | undefined, timeZone: string) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(date);
}

function customerName(customer?: PosCustomerSummary | null) {
  if (!customer) return 'Guest';
  return [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Guest';
}

function serviceLabel(appointment: PosAppointment) {
  return appointment.serviceTitleSnapshot || 'Service label not recorded';
}

function barberLabel(appointment: PosAppointment) {
  return appointment.barberNameSnapshot || 'Barber not recorded';
}

function statusLabel(status?: string | null) {
  return status?.replace(/_/g, ' ') || 'unknown';
}

function parseCents(value: string) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  return <div aria-live="polite">{feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}</div>;
}

function hrefWith(query: PosQuery, changes: Partial<Record<'appointment' | 'tickets' | 'ticketQ' | 'sales' | 'saleQ' | 'receipts' | 'receipt', string | number | null>>) {
  const current: Record<string, string | number | undefined> = {
    appointment: query.appointmentId, tickets: query.ticketPage, ticketQ: query.ticketSearch,
    sales: query.salePage, saleQ: query.saleSearch, receipts: query.receiptPage, receipt: query.receiptId,
  };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...changes })) {
    if (value === null || value === undefined || value === '' || ((key === 'tickets' || key === 'sales' || key === 'receipts') && Number(value) <= 1)) continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return `/dashboard/platform/pos${text ? `?${text}` : ''}`;
}

/** Search that submits on Enter; no separate button. */
function SearchField({ id, name, label, defaultValue, placeholder, hidden, mono = false }: { id: string; name: string; label: string; defaultValue: string; placeholder: string; hidden?: Record<string, string>; mono?: boolean }) {
  return (
    <form action="/dashboard/platform/pos" role="search" className="relative w-full sm:max-w-sm">
      {Object.entries(hidden || {}).filter(([, value]) => value).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
      <label htmlFor={id} className="sr-only">{label}</label>
      <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input id={id} name={name} type="search" defaultValue={defaultValue} placeholder={placeholder} className={cn('h-9 w-full rounded-[6px] border bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', mono && 'tabular-nums')} />
    </form>
  );
}

function ticketTone(appointment: PosAppointment, earlierDay: boolean): Tone {
  if (earlierDay) return 'alert';
  return appointment.status === 'in_chair' ? 'live' : appointment.status === 'checked_in' ? 'wait' : 'off';
}

function Pager({ paging, label, href }: { paging: Paging; label: string; href: (page: number) => string }) {
  if (paging.total <= paging.pageSize) return null;
  const pages = Math.ceil(paging.total / paging.pageSize);
  return <KitPager label={label} page={paging.page} pages={pages} prev={paging.page > 1 ? href(paging.page - 1) : null} next={paging.page < pages ? href(paging.page + 1) : null} />;
}

export function PosPageClient({ data, query }: { data: PosProjectionData; query: PosQuery }) {
  const { appointments, requestedAppointment, requestedAppointmentId, timeZone } = data;
  // Visits from an earlier shop day are flagged and never preselected.
  const today = shopDateKey(new Date(), timeZone);
  const earlier = (appointment: PosAppointment) => Boolean(appointment.startsAt) && shopDateKey(String(appointment.startsAt), timeZone) < today;
  const [selectedId, setSelectedId] = useState(requestedAppointmentId || appointments.find((appointment) => appointment.status === 'in_chair' && !earlier(appointment))?.id || appointments.find((appointment) => !earlier(appointment))?.id || '');
  // The selected ticket is resolved by id only; a missing ticket is never replaced by another.
  const selected = (requestedAppointment && requestedAppointment.id === selectedId ? requestedAppointment : null)
    || appointments.find((appointment) => appointment.id === selectedId)
    || null;
  const requestedClosed = Boolean(requestedAppointment && (['paid', 'refunded'].includes(String(requestedAppointment.paymentStatus)) || !checkoutStatuses.includes(String(requestedAppointment.status))));

  const initialTab: CounterTab = query.receiptId || (query.receiptPage || 1) > 1 ? 'receipts' : query.saleSearch || (query.salePage || 1) > 1 ? 'returns' : 'retail';
  const [tab, setTab] = useState<CounterTab>(initialTab);

  return (
    <div className="flex min-w-0 flex-col gap-8 px-4 pb-24 md:px-6">

      {requestedAppointmentId && !requestedAppointment && (
        <Notice tone="alert">The appointment sent to checkout was not found in this shop.</Notice>
      )}
      {requestedAppointment && requestedClosed && selected?.id === requestedAppointment.id && (
        <Notice>This appointment is {statusLabel(requestedAppointment.status)}, payment {statusLabel(requestedAppointment.paymentStatus)}. Already closed; see receipts below.</Notice>
      )}

      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section aria-labelledby="pos-queue-heading" className="min-w-0 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="pos-queue-heading" className="text-sm font-semibold">Open tickets<span className="ml-2 text-xs font-normal tabular-nums text-muted-foreground">{data.tickets.total}</span></h2>
            <SearchField id="ticket-search" name="ticketQ" label="Find a ticket" defaultValue={data.tickets.search} placeholder="Customer, phone, service or barber" />
          </div>
          <div className="relative overflow-hidden rounded-[6px] border bg-background">
            <div aria-hidden="true" className="hidden h-9 grid-cols-[minmax(0,1fr)_7.5rem_6rem] items-center gap-3 border-b bg-muted/40 px-3 text-xs font-medium text-muted-foreground sm:grid">
              <span>Ticket</span><span>Status</span><span className="text-right">Amount</span>
            </div>
            <ul aria-label="Open tickets">
              {appointments.map((appointment) => {
                const earlierDay = earlier(appointment);
                const isSelected = selected?.id === appointment.id;
                return (
                  <li key={appointment.id} className="border-b last:border-b-0">
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      aria-controls="pos-tender"
                      onClick={() => setSelectedId(appointment.id)}
                      className={cn('grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_7.5rem_6rem]', isSelected && 'bg-muted hover:bg-muted')}
                    >
                      <span className="min-w-0">
                        <span className={cn('block truncate', isSelected ? 'font-semibold' : 'font-medium')}>{customerName(appointment.customer)}</span>
                        <span className="block truncate text-xs text-muted-foreground">{serviceLabel(appointment)} · {barberLabel(appointment)} · {formatDateTime(appointment.startsAt, timeZone)}{(appointment.customer?.packageBalances?.length ?? 0) > 0 ? ' · package balance' : ''}</span>
                      </span>
                      <span className="col-start-1 row-start-2 sm:col-start-2 sm:row-start-1">
                        <StatusCell tone={ticketTone(appointment, earlierDay)}>{earlierDay ? 'Earlier day' : statusLabel(appointment.status)}</StatusCell>
                        {appointment.paymentStatus && appointment.paymentStatus !== 'not_required' && appointment.paymentStatus !== 'unpaid' ? <span className="block text-xs text-muted-foreground sm:pl-3.5">{statusLabel(appointment.paymentStatus)}</span> : null}
                      </span>
                      <span className="row-span-2 text-right font-semibold tabular-nums sm:row-span-1">{formatMoney(appointment.price)}</span>
                    </button>
                  </li>
                );
              })}
              {!appointments.length && <li className="px-3 py-6 text-sm text-muted-foreground">{data.tickets.search ? `No open tickets match “${data.tickets.search}”.` : 'No checked-in or in-chair visits.'} <Link className="font-medium text-foreground underline underline-offset-4" href="/dashboard/platform/booking">Booking board</Link></li>}
            </ul>
          </div>
          <Pager paging={data.tickets} label="Ticket pages" href={(page) => hrefWith(query, { tickets: page, appointment: null })} />
        </section>

        <section id="pos-tender" aria-labelledby="pos-tender-heading" className="min-w-0 xl:sticky xl:top-4">
          <h2 id="pos-tender-heading" className="sr-only">Take payment</h2>
          {selected
            ? <TenderPanel key={selected.id} appointment={selected} closed={requestedClosed && selected.id === requestedAppointment?.id} timeZone={timeZone} />
            : <div className="rounded-[6px] border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{appointments.length ? 'Choose a ticket to take payment.' : 'Nothing to check out.'}</div>}
        </section>
      </div>

      <section aria-label="Retail, returns and receipts" className="min-w-0 space-y-4">
        <LocalTabs
          idBase="counter"
          label="Counter"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'retail', label: 'Retail sale' },
            { value: 'returns', label: 'Returns', count: data.sales.total },
            { value: 'receipts', label: 'Receipts', count: data.receiptPaging.total },
          ]}
        />
        <div role="tabpanel" id={`counter-panel-${tab}`} aria-labelledby={`counter-tab-${tab}`}>
          {tab === 'retail' && <RetailSale data={data} />}
          {tab === 'returns' && <RetailReturns data={data} query={query} />}
          {tab === 'receipts' && <Receipts data={data} query={query} />}
        </div>
      </section>
    </div>
  );
}

type CounterTab = 'retail' | 'returns' | 'receipts';

// Keyed by appointment id: tender drafts belong to exactly this ticket.
function TenderPanel({ appointment, closed, timeZone }: { appointment: PosAppointment; closed: boolean; timeZone: string }) {
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [packageBalanceId, setPackageBalanceId] = useState('');
  const [tipAmount, setTipAmount] = useState('0');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [taxAmount, setTaxAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [paid, setPaid] = useState(false);
  const [pending, startTransition] = useTransition();
  const checkoutKey = useCommandKey(`checkout:${appointment.id}`);

  const packageBalances = appointment.customer?.packageBalances || [];
  const tip = parseCents(tipAmount), discount = parseCents(discountAmount), tax = parseCents(taxAmount);
  const amountsValid = tip !== null && discount !== null && tax !== null;
  const subtotal = paymentMethod === 'package' ? 0 : appointment.price || 0;
  const appliedDiscount = Math.min(discount || 0, subtotal);
  const total = subtotal + (tip || 0) + (tax || 0) - appliedDiscount;
  // A deposit paid online counts toward the receipt; only the balance is collected here.
  const depositPaid = appointment.paymentStatus === 'deposit_paid' && paymentMethod !== 'package' ? Math.min(appointment.depositAmount || 0, total) : 0;
  const collect = total - depositPaid;
  const eligible = !closed && !paid && appointment.status === 'in_chair' && amountsValid && (paymentMethod !== 'package' || (total === 0 && Boolean(packageBalanceId)));
  const id = appointment.id;

  const submitCheckout = () => {
    if (!eligible || tip === null || discount === null || tax === null) return;
    setFeedback(null);
    const input = {
      appointmentId: id, paymentMethod,
      packageBalanceId: paymentMethod === 'package' ? packageBalanceId : undefined,
      tipAmount: tip, discountAmount: discount, taxAmount: tax, notes,
    };
    const idempotencyKey = checkoutKey.keyFor(input);
    startTransition(async () => {
      try {
        const result = await checkoutAppointmentAction({ ...input, idempotencyKey });
        if (!result.success || !result.data) { setFeedback({ tone: 'alert', text: result.error || 'Checkout was not completed.' }); return; }
        checkoutKey.settle();
        setPaid(true);
        setFeedback({ tone: 'status', text: `Paid ${result.data.transaction.formattedTotal || formatMoney(result.data.transaction.total)} by ${statusLabel(result.data.transaction.paymentMethod)}. Receipt ${result.data.transaction.id}.` });
      } catch {
        setFeedback({ tone: 'alert', text: interrupted });
      }
    });
  };

  return (
    <div className="space-y-4 rounded-[6px] border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="truncate font-semibold">{customerName(appointment.customer)}</p>
          <p className="truncate text-sm text-muted-foreground">{serviceLabel(appointment)} · {barberLabel(appointment)}</p>
          <p className="text-xs tabular-nums text-muted-foreground">{formatDateTime(appointment.startsAt, timeZone)}</p>
        </div>
        <p className="text-3xl font-semibold tabular-nums tracking-tight" aria-live="polite">{formatMoney(total)}</p>
      </div>
      <dl className="grid grid-cols-4 gap-2 border-y py-2 text-xs tabular-nums">
        <div><dt className="text-muted-foreground">Service</dt><dd>{formatMoney(subtotal)}</dd></div>
        <div><dt className="text-muted-foreground">Tip</dt><dd>{formatMoney(tip || 0)}</dd></div>
        <div><dt className="text-muted-foreground">Tax</dt><dd>{formatMoney(tax || 0)}</dd></div>
        <div><dt className="text-muted-foreground">Discount</dt><dd>−{formatMoney(appliedDiscount)}</dd></div>
      </dl>
      {appointment.status === 'checked_in' && !closed && <Notice>Seat this visit on the booking board before checkout.</Notice>}
      {depositPaid > 0 && !closed && <Notice>Deposit {formatMoney(depositPaid)} paid online · collect {formatMoney(collect)}</Notice>}
      {!closed && appointment.startsAt && shopDateKey(String(appointment.startsAt), timeZone) < shopDateKey(new Date(), timeZone) && <Notice tone="alert">Visit from {formatDateTime(appointment.startsAt, timeZone)}, an earlier day</Notice>}
      {paymentMethod === 'package' && total > 0 && <Notice tone="alert">A prepaid visit can’t include tip or tax. Mixed tender isn’t supported.</Notice>}
      {!amountsValid && <Notice tone="alert">Tip, discount and tax must be zero or positive amounts.</Notice>}

      <div className="grid gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Tender</span>
        <Segmented
          label="Payment method"
          size="lg"
          block
          value={paymentMethod}
          onChange={(value) => { setPaymentMethod(value); if (value !== 'package') setPackageBalanceId(''); }}
          options={[
            { value: 'cash', label: 'Cash' },
            { value: 'card', label: 'Card terminal' },
            ...(packageBalances.length > 0 ? [{ value: 'package', label: 'Package visit' }] : []),
          ]}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {paymentMethod === 'package' && (
          <div className="grid gap-1 sm:col-span-3">
            <Label htmlFor={`balance-${id}`} className="text-xs text-muted-foreground">Balance</Label>
            <select id={`balance-${id}`} value={packageBalanceId} onChange={(event) => setPackageBalanceId(event.target.value)} className={selectClass}>
              <option value="">Select balance</option>
              {packageBalances.map((balance) => (
                <option key={balance.id} value={balance.id}>
                  {balance.servicePackage?.name || balance.membershipPlan?.name || 'Balance'} · {balance.remainingVisits} left{balance.expiresAt ? ` · expires ${formatDateTime(balance.expiresAt, timeZone)}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="grid gap-1">
          <Label htmlFor={`tip-${id}`} className="text-xs text-muted-foreground">Tip ($)</Label>
          <Input id={`tip-${id}`} className="rounded-[6px] tabular-nums" value={tipAmount} onChange={(event) => setTipAmount(event.target.value)} inputMode="decimal" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`discount-${id}`} className="text-xs text-muted-foreground">Discount ($)</Label>
          <Input id={`discount-${id}`} className="rounded-[6px] tabular-nums" value={discountAmount} onChange={(event) => setDiscountAmount(event.target.value)} inputMode="decimal" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`tax-${id}`} className="text-xs text-muted-foreground">Tax ($)</Label>
          <Input id={`tax-${id}`} className="rounded-[6px] tabular-nums" value={taxAmount} onChange={(event) => setTaxAmount(event.target.value)} inputMode="decimal" />
        </div>
      </div>

      <div className="grid gap-1">
        <Label htmlFor={`notes-${id}`} className="text-xs text-muted-foreground">Checkout notes</Label>
        <textarea id={`notes-${id}`} value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-16 w-full rounded-[6px] border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>

      <FeedbackMessage feedback={feedback} />
      <Track block>
        <Pill variant="primary" className="h-11 text-base" disabled={pending || !eligible} onClick={submitCheckout}>
          {pending ? 'Processing…' : paymentMethod === 'package' ? 'Redeem visit' : paymentMethod === 'card' ? `Record ${formatMoney(collect)} card` : `Take ${formatMoney(collect)} cash`}
        </Pill>
      </Track>
    </div>
  );
}

function RetailSale({ data }: { data: PosProjectionData }) {
  const { products } = data;
  // Nothing is preselected: the counter opens clean, not on a stock error.
  const [productId, setProductId] = useState('');
  const [retailTender, setRetailTender] = useState<'cash' | 'card'>('cash');
  const [quantity, setQuantity] = useState('1');
  const [taxRate, setTaxRate] = useState('0');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();
  const saleKey = useCommandKey('product-sale');

  const product = products.find((item) => item.id === productId) || null;
  const parsedQuantity = Number(quantity);
  const quantityValid = Number.isInteger(parsedQuantity) && parsedQuantity >= 1 && parsedQuantity <= 100;
  const parsedRate = Number(taxRate);
  const rateValid = taxRate.trim() !== '' && Number.isFinite(parsedRate) && parsedRate >= 0 && parsedRate <= 100;
  const taxRateBps = rateValid ? Math.round(parsedRate * 100) : 0;
  const unitPrice = Math.max(0, Math.floor(product?.price || 0));
  const subtotal = quantityValid ? unitPrice * parsedQuantity : 0;
  const taxAmount = Math.round((subtotal * taxRateBps) / 10_000);
  const total = subtotal + taxAmount;
  const enough = Boolean(product && quantityValid && parsedQuantity <= product.availableQuantity);

  const submit = () => {
    if (!product || !quantityValid || !rateValid || !enough) return;
    const input = { productId: product.id, quantity: parsedQuantity, paymentMethod: retailTender, taxRateBps };
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await recordProductSaleAction({ ...input, idempotencyKey: saleKey.keyFor(input) });
        if (!result.success || !result.data?.id) { setFeedback({ tone: 'alert', text: result.error || 'The sale was not recorded.' }); return; }
        saleKey.settle();
        setFeedback({ tone: 'status', text: `Cash sale recorded: ${result.data.quantity ?? parsedQuantity} × ${result.data.productName || product.name}, total ${formatMoney(result.data.total)} (tax ${formatMoney(result.data.taxAmount)}). Receipt ${result.data.transactionId || ''}.` });
      } catch {
        setFeedback({ tone: 'alert', text: interrupted });
      }
    });
  };

  return (
    <div>
      {products.length ? (
        <div className="max-w-3xl space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1">
              <Label htmlFor="retail-product">Product</Label>
              <select id="retail-product" className={selectClass} value={productId} onChange={(event) => setProductId(event.target.value)}>
                <option value="">Choose a product</option>
                {products.map((item) => <option key={item.id} value={item.id} disabled={item.availableQuantity <= 0}>{item.name} · {formatMoney(item.price)} · {item.availableQuantity > 0 ? `${item.availableQuantity} in stock` : 'out of stock'}</option>)}
              </select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="retail-quantity">Quantity</Label>
              <Input id="retail-quantity" className="rounded-[6px] tabular-nums" inputMode="numeric" value={quantity} aria-invalid={!quantityValid} aria-describedby="retail-quantity-error" onChange={(event) => setQuantity(event.target.value)} />
              <p id="retail-quantity-error" className="text-xs text-destructive">{!quantityValid ? 'Enter a whole number from 1 to 100.' : product && !enough ? `Only ${product.availableQuantity} available.` : ''}</p>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="retail-tax-rate">Tax rate (%)</Label>
              <Input id="retail-tax-rate" className="rounded-[6px] tabular-nums" inputMode="decimal" value={taxRate} aria-invalid={!rateValid} aria-describedby="retail-tax-help" onChange={(event) => setTaxRate(event.target.value)} />
              <p id="retail-tax-help" className={`text-xs ${rateValid ? 'text-muted-foreground' : 'text-destructive'}`}>{rateValid ? '' : 'Enter a rate from 0 to 100.'}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-2 border-y py-2 text-sm tabular-nums sm:grid-cols-4">
            <div><dt className="text-xs text-muted-foreground">Unit</dt><dd>{formatMoney(unitPrice)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Subtotal</dt><dd>{formatMoney(subtotal)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Tax {rateValid ? parsedRate : 0}%</dt><dd>{formatMoney(taxAmount)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Total</dt><dd className="font-semibold">{formatMoney(total)}</dd></div>
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented label="Retail tender" value={retailTender} onChange={setRetailTender} options={[{ value: 'cash', label: 'Cash' }, { value: 'card', label: 'Card terminal' }]} />
            <Pill variant="primary" disabled={pending || !product || !enough || !rateValid} onClick={submit}>{!product ? 'Choose a product' : retailTender === 'card' ? `Record ${formatMoney(total)} card` : `Take ${formatMoney(total)} cash`}</Pill>
          </div>
        </div>
      ) : <Empty>No active products. <Link className="underline" href="/dashboard/platform/services/new-product">Add a product</Link></Empty>}
      <div className="mt-3"><FeedbackMessage feedback={feedback} /></div>
    </div>
  );
}

function RetailReturns({ data, query }: { data: PosProjectionData; query: PosQuery }) {
  const [openId, setOpenId] = useState('');
  return (
    <div className="space-y-3">
      <SearchField id="sale-search" name="saleQ" label="Find the original sale" defaultValue={data.sales.search} placeholder="Product, SKU or receipt number" />
      <div className="grid gap-x-8 md:grid-cols-2 xl:grid-cols-3">
        {data.productLines.map((line) => (
          <div key={line.id} className="border-b py-2.5 text-sm">
            <div className="flex items-baseline justify-between gap-2"><strong className="min-w-0 truncate font-medium">{line.productNameSnapshot}</strong><span className="tabular-nums">{formatMoney(line.total)}</span></div>
            <p className="text-xs text-muted-foreground">Qty {line.quantity}{line.returnedQuantity ? ` · ${line.returnedQuantity} returned` : ''} · {statusLabel(line.paymentMethod)} · {formatDateTime(line.occurredAt, data.timeZone)}</p>
            {(line.returnedQuantity || 0) < line.quantity && (openId === line.id
              ? <ReturnForm line={line} onClose={() => setOpenId('')} />
              : <Track className="mt-2"><Pill size="sm" aria-expanded={false} onClick={() => setOpenId(line.id)}>Return</Pill></Track>)}
          </div>
        ))}
        {!data.productLines.length && <Empty>{data.sales.search ? `No sales match “${data.sales.search}”.` : 'No retail sales recorded.'}</Empty>}
      </div>
      <Pager paging={data.sales} label="Sale pages" href={(page) => hrefWith(query, { sales: page })} />
    </div>
  );
}

function ReturnForm({ line, onClose }: { line: ProductLineSummary; onClose: () => void }) {
  const remaining = line.quantity - (line.returnedQuantity || 0);
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [cashReturned, setCashReturned] = useState(false);
  const [restock, setRestock] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();
  const returnKey = useCommandKey(`product-return:${line.id}`);
  const parsed = Number(quantity);
  const quantityValid = Number.isInteger(parsed) && parsed >= 1 && parsed <= remaining;
  const refund = quantityValid ? line.unitPrice * parsed + Math.round((Math.abs(line.taxAmount) * parsed) / line.quantity) : 0;
  const valid = quantityValid && reason.trim().length >= 3 && cashReturned;

  const submit = () => {
    if (!valid) return;
    const input = { saleLineId: line.id, quantity: parsed, reason: reason.trim(), cashReturned: true, restock };
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await returnProductSaleAction({ ...input, idempotencyKey: returnKey.keyFor(input) });
        if (!result.success || result.data?.originalLineId !== line.id) { setFeedback({ tone: 'alert', text: result.error || 'The return could not be matched to this sale. Refresh before retrying.' }); return; }
        returnKey.settle();
        setFeedback({ tone: 'status', text: `Return recorded: ${result.data.quantity ?? parsed} unit(s), ${formatMoney(Math.abs(result.data.total || 0))} refunded${restock ? ', restocked' : ', not restocked'}.` });
      } catch {
        setFeedback({ tone: 'alert', text: interrupted });
      }
    });
  };

  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <div className="grid gap-1">
        <Label htmlFor={`return-qty-${line.id}`}>Quantity to return (max {remaining})</Label>
        <Input id={`return-qty-${line.id}`} className="rounded-[6px] tabular-nums" inputMode="numeric" value={quantity} aria-invalid={!quantityValid} onChange={(event) => setQuantity(event.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`return-reason-${line.id}`}>Reason</Label>
        <Input id={`return-reason-${line.id}`} className="rounded-[6px]" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
      </div>
      <p className="text-xs">Refund {formatMoney(refund)} in {statusLabel(line.paymentMethod)}.</p>
      <div className="flex items-start gap-2">
        <Checkbox id={`return-cash-${line.id}`} checked={cashReturned} onCheckedChange={(value) => setCashReturned(value === true)} />
        <Label htmlFor={`return-cash-${line.id}`} className="text-xs font-normal">Cash returned to customer: I handed {formatMoney(refund)} back. (Required)</Label>
      </div>
      <div className="flex items-start gap-2">
        <Checkbox id={`return-restock-${line.id}`} checked={restock} onCheckedChange={(value) => setRestock(value === true)} />
        <Label htmlFor={`return-restock-${line.id}`} className="text-xs font-normal">Restock to the original lot (unopened, undamaged)</Label>
      </div>
      <Track>
        <Pill size="sm" variant="primary" disabled={pending || !valid} onClick={submit}>Record return</Pill>
        <Pill size="sm" onClick={onClose}>Close</Pill>
      </Track>
      <FeedbackMessage feedback={feedback} />
    </div>
  );
}

function Receipts({ data, query }: { data: PosProjectionData; query: PosQuery }) {
  const [openId, setOpenId] = useState(data.receiptPaging.receiptId || '');
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField id="receipt-lookup" name="receipt" label="Receipt number" defaultValue={data.receiptPaging.receiptId} placeholder="Receipt ID, then Enter" mono />
        {data.receiptPaging.receiptId && <PillLink size="sm" variant="flat" href={hrefWith(query, { receipt: null, receipts: null })}>All receipts</PillLink>}
      </div>
      <div className="rounded-[6px] border px-3">
        {data.receipts.map((receipt) => (
          <div key={receipt.id} className="border-b py-2.5 text-sm last:border-b-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <strong className="font-medium"><StatusDot tone={receipt.status === 'paid' ? 'live' : receipt.status === 'voided' ? 'off' : 'wait'} />{customerName(receipt.customer)}</strong>
                <p className="text-xs text-muted-foreground">{formatDateTime(receipt.completedAt, data.timeZone)} · {statusLabel(receipt.paymentMethod)} · {statusLabel(receipt.status)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold tabular-nums">{formatMoney(receipt.total)}</span>
                <Track><Pill size="sm" aria-expanded={openId === receipt.id} aria-controls={`receipt-${receipt.id}`} onClick={() => setOpenId(openId === receipt.id ? '' : receipt.id)}>{openId === receipt.id ? 'Hide' : 'Details'}</Pill></Track>
              </div>
            </div>
            {openId === receipt.id && <ReceiptDetail receipt={receipt} timeZone={data.timeZone} />}
          </div>
        ))}
        {!data.receipts.length && <Empty>{data.receiptPaging.receiptId ? 'No receipt with that number in this shop.' : 'No appointment receipts yet.'}</Empty>}
      </div>
      <Pager paging={data.receiptPaging} label="Receipt pages" href={(page) => hrefWith(query, { receipts: page })} />
    </div>
  );
}

function ReceiptDetail({ receipt, timeZone }: { receipt: PosReceipt; timeZone: string }) {
  const [reason, setReason] = useState('');
  const [cashReturned, setCashReturned] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [refunded, setRefunded] = useState(false);
  const [pending, startTransition] = useTransition();
  const refundKey = useCommandKey(`cash-refund:${receipt.id}`);
  const refundable = !refunded && receipt.paymentMethod === 'cash' && receipt.status === 'paid' && !receipt.paymentSessionId && !receipt.cashRefund && (receipt.total || 0) >= 0;
  const valid = reason.trim().length >= 3 && cashReturned;

  const submitRefund = () => {
    if (!refundable || !valid) return;
    const input = { transactionId: receipt.id, reason: reason.trim(), cashReturned: true };
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await refundCashCheckoutAction({ ...input, idempotencyKey: refundKey.keyFor(input) });
        if (!result.success || !result.data?.id) { setFeedback({ tone: 'alert', text: result.error || 'The refund was not recorded.' }); return; }
        refundKey.settle();
        setRefunded(true);
        setFeedback({ tone: 'status', text: `Cash refund of ${formatMoney(result.data.amount)} recorded against receipt ${receipt.id}.` });
      } catch {
        setFeedback({ tone: 'alert', text: interrupted });
      }
    });
  };

  return (
    <div id={`receipt-${receipt.id}`} className="mt-3 space-y-3 border-t pt-3">
      <p className="text-xs text-muted-foreground">Receipt {receipt.id} · {receipt.currencyCode || 'USD'}</p>
      <table className="w-full text-left text-xs">
        <thead><tr><th className="py-1">Service (as accepted)</th><th>Barber</th><th className="text-right">Price</th></tr></thead>
        <tbody>
          {receipt.lineItems.map((line) => (
            <tr key={line.id} className="border-t">
              <td className="py-1">{line.title || 'Service label not recorded'} · {line.durationMinutes} min{line.packageName ? ` · ${line.packageName} (${line.packageVisitsConsumed ?? 0} visit)` : ''}</td>
              <td>{line.barberName || 'Not recorded'}{line.barberChairNumber ? ` · chair ${line.barberChairNumber}` : ''}</td>
              <td className="text-right">{formatMoney(line.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="grid grid-cols-2 gap-1 text-xs sm:grid-cols-5">
        <div><dt className="text-muted-foreground">Subtotal</dt><dd>{formatMoney(receipt.subtotal)}</dd></div>
        <div><dt className="text-muted-foreground">Discount</dt><dd>{formatMoney(receipt.discountAmount)}</dd></div>
        <div><dt className="text-muted-foreground">Tax</dt><dd>{formatMoney(receipt.taxAmount)}</dd></div>
        <div><dt className="text-muted-foreground">Tip</dt><dd>{formatMoney(receipt.tipAmount)}</dd></div>
        <div><dt className="text-muted-foreground">Total</dt><dd className="font-semibold">{formatMoney(receipt.total)}</dd></div>
      </dl>
      {receipt.cashRefund && <p className="text-xs">Cash refund {formatMoney(receipt.cashRefund.amount)} on {formatDateTime(receipt.cashRefund.refundedAt, timeZone)} · {receipt.cashRefund.reason}</p>}
      <Track>
        <PillLink size="sm" href={`/dashboard/checkout-transactions/${receipt.id}`}>Receipt record</PillLink>
        <Pill size="sm" onClick={() => window.print()}>Print</Pill>
      </Track>
      {refundable && (
        <div className="space-y-2 rounded-[6px] border border-destructive/30 p-3">
          <p className="text-xs font-medium">Cash refund · owner only</p>
          <p className="text-xs tabular-nums text-muted-foreground">Full {formatMoney(receipt.total)} · tax {formatMoney(receipt.taxAmount)} · tip {formatMoney(receipt.tipAmount)} · voids unpaid commissions</p>
          <div className="grid gap-1">
            <Label htmlFor={`refund-reason-${receipt.id}`}>Reason</Label>
            <Input id={`refund-reason-${receipt.id}`} className="rounded-[6px]" value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} />
          </div>
          <div className="flex items-start gap-2">
            <Checkbox id={`refund-cash-${receipt.id}`} checked={cashReturned} onCheckedChange={(value) => setCashReturned(value === true)} />
            <Label htmlFor={`refund-cash-${receipt.id}`} className="text-xs font-normal">I returned {formatMoney(receipt.total)} in cash to the customer.</Label>
          </div>
          <Track><Pill size="sm" variant="danger" disabled={pending || !valid} onClick={submitRefund}>Record cash refund</Pill></Track>
        </div>
      )}
      <FeedbackMessage feedback={feedback} />
    </div>
  );
}
