'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCommandKey } from '@/features/platform/lib/useCommandKey';
import { shopDateKey } from '@/features/shared/shop-time';
import { Empty, Notice, Pager as KitPager, Pill, PillLink, Section, selectClass, StatusDot, Track } from '@/features/platform/lib/ui';
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

  return (
    <div className="flex min-w-0 flex-col gap-8 px-4 pb-8 md:px-6">

      {requestedAppointmentId && !requestedAppointment && (
        <Notice tone="alert">The appointment sent to checkout was not found in this shop.</Notice>
      )}
      {requestedAppointment && requestedClosed && selected?.id === requestedAppointment.id && (
        <Notice>This appointment is {statusLabel(requestedAppointment.status)}, payment {statusLabel(requestedAppointment.paymentStatus)}. Already closed; see receipts below.</Notice>
      )}

      <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Section id="pos-queue-heading" title="Open tickets" tone={data.tickets.total ? 'wait' : undefined} count={data.tickets.total}>
          <form action="/dashboard/platform/pos" role="search" className="mb-3 flex items-end gap-2">
            <div className="grid min-w-0 flex-1 gap-1">
              <Label htmlFor="ticket-search" className="sr-only">Find a ticket</Label>
              <Input id="ticket-search" name="ticketQ" defaultValue={data.tickets.search} placeholder="Customer, phone, service or barber" />
            </div>
            <Track><Pill type="submit">Search</Pill></Track>
          </form>
          <div className="space-y-1 rounded-2xl bg-muted/50 p-1 ring-1 ring-inset ring-black/5 dark:ring-white/5">
            {appointments.map((appointment) => (
              <button
                key={appointment.id}
                type="button"
                aria-pressed={selected?.id === appointment.id}
                aria-controls="pos-tender"
                onClick={() => setSelectedId(appointment.id)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 rounded-xl px-3 py-2.5 text-left transition aria-pressed:bg-background aria-pressed:shadow-sm aria-pressed:ring-1 aria-pressed:ring-black/5 hover:bg-background/60 dark:aria-pressed:bg-zinc-800"
              >
                <span className="min-w-0 truncate font-medium"><StatusDot tone={earlier(appointment) ? 'alert' : appointment.status === 'in_chair' ? 'live' : appointment.status === 'checked_in' ? 'wait' : 'off'} />{customerName(appointment.customer)}</span>
                <span className="font-mono text-sm tabular-nums">{formatMoney(appointment.price)}</span>
                <span className="col-span-2 truncate pl-4 text-xs text-muted-foreground">{serviceLabel(appointment)} · {barberLabel(appointment)} · {formatDateTime(appointment.startsAt, timeZone)}</span>
                <span className="col-span-2 pl-4 text-xs text-muted-foreground">{earlier(appointment) ? <span className="font-medium text-destructive">Earlier day · </span> : null}{statusLabel(appointment.status)}{appointment.paymentStatus && appointment.paymentStatus !== 'not_required' ? ` · ${statusLabel(appointment.paymentStatus)}` : ''}{(appointment.customer?.packageBalances?.length ?? 0) > 0 ? ' · package balance' : ''}</span>
              </button>
            ))}
            {!appointments.length && <p className="px-3 py-4 text-sm text-muted-foreground">{data.tickets.search ? `No open tickets match “${data.tickets.search}”.` : 'No checked-in or in-chair visits.'}</p>}
          </div>
          <Pager paging={data.tickets} label="Ticket pages" href={(page) => hrefWith(query, { tickets: page, appointment: null })} />
        </Section>

        <section id="pos-tender" aria-labelledby="pos-tender-heading" className="min-w-0">
          <h2 id="pos-tender-heading" className="border-b pb-2 text-sm font-semibold">Take payment</h2>
          <div className="pt-3">
            {selected
              ? <TenderPanel key={selected.id} appointment={selected} closed={requestedClosed && selected.id === requestedAppointment?.id} timeZone={timeZone} />
              : <Empty>Select a ticket.</Empty>}
          </div>
        </section>
      </div>

      <RetailSale data={data} />
      <RetailReturns data={data} query={query} />
      <Receipts data={data} query={query} />
    </div>
  );
}

// Keyed by appointment id: tender drafts belong to exactly this ticket.
function TenderPanel({ appointment, closed, timeZone }: { appointment: PosAppointment; closed: boolean; timeZone: string }) {
  const [paymentMethod, setPaymentMethod] = useState('cash');
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
    <div className="space-y-5">
      <div className="rounded-2xl bg-zinc-950 p-5 text-zinc-50 shadow-[inset_0_1px_3px_rgb(0_0_0/0.6)] dark:bg-black">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold">{customerName(appointment.customer)}</p>
          <p className="text-xs text-zinc-400">{formatDateTime(appointment.startsAt, timeZone)}</p>
        </div>
        <p className="text-sm text-zinc-400">{serviceLabel(appointment)} · {barberLabel(appointment)}</p>
        <p className="mt-4 font-mono text-4xl font-semibold tabular-nums sm:text-5xl">{formatMoney(total)}</p>
        <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-zinc-800 pt-3 font-mono text-xs tabular-nums">
          <div><dt className="text-zinc-500">Service</dt><dd>{formatMoney(subtotal)}</dd></div>
          <div><dt className="text-zinc-500">Tip</dt><dd>{formatMoney(tip || 0)}</dd></div>
          <div><dt className="text-zinc-500">Tax</dt><dd>{formatMoney(tax || 0)}</dd></div>
          <div><dt className="text-zinc-500">Discount</dt><dd>−{formatMoney(appliedDiscount)}</dd></div>
        </dl>
      </div>
      {appointment.status === 'checked_in' && !closed && <Notice>Seat this visit on the booking board before checkout.</Notice>}
      {!closed && appointment.startsAt && shopDateKey(String(appointment.startsAt), timeZone) < shopDateKey(new Date(), timeZone) && <Notice tone="alert">Visit from {formatDateTime(appointment.startsAt, timeZone)}, an earlier day</Notice>}
      {paymentMethod === 'package' && total > 0 && <Notice tone="alert">A prepaid visit can’t include tip or tax. Mixed tender isn’t supported.</Notice>}
      {!amountsValid && <Notice tone="alert">Tip, discount and tax must be zero or positive amounts.</Notice>}

      <div className="grid gap-1">
        <span className="text-xs text-muted-foreground">Tender</span>
        <Track label="Payment method">
          <Pill size="sm" variant="flat" aria-pressed={paymentMethod === 'cash'} onClick={() => { setPaymentMethod('cash'); setPackageBalanceId(''); }}>Cash</Pill>
          <Pill size="sm" variant="flat" aria-pressed={paymentMethod === 'card'} onClick={() => { setPaymentMethod('card'); setPackageBalanceId(''); }}>Card terminal</Pill>
          {packageBalances.length > 0 && <Pill size="sm" variant="flat" aria-pressed={paymentMethod === 'package'} onClick={() => setPaymentMethod('package')}>Package visit</Pill>}
        </Track>
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
          <Input id={`tip-${id}`} className="font-mono" value={tipAmount} onChange={(event) => setTipAmount(event.target.value)} inputMode="decimal" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`discount-${id}`} className="text-xs text-muted-foreground">Discount ($)</Label>
          <Input id={`discount-${id}`} className="font-mono" value={discountAmount} onChange={(event) => setDiscountAmount(event.target.value)} inputMode="decimal" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`tax-${id}`} className="text-xs text-muted-foreground">Tax ($)</Label>
          <Input id={`tax-${id}`} className="font-mono" value={taxAmount} onChange={(event) => setTaxAmount(event.target.value)} inputMode="decimal" />
        </div>
      </div>

      <div className="grid gap-1">
        <Label htmlFor={`notes-${id}`} className="text-xs text-muted-foreground">Checkout notes</Label>
        <textarea id={`notes-${id}`} value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" />
      </div>

      <FeedbackMessage feedback={feedback} />
      <Track block>
        <Pill variant="primary" disabled={pending || !eligible} onClick={submitCheckout}>
          {pending ? 'Processing…' : paymentMethod === 'package' ? 'Redeem visit' : paymentMethod === 'card' ? `Record ${formatMoney(total)} card` : `Take ${formatMoney(total)} cash`}
        </Pill>
      </Track>
    </div>
  );
}

function RetailSale({ data }: { data: PosProjectionData }) {
  const { products } = data;
  const [productId, setProductId] = useState((products.find((item) => item.availableQuantity > 0) || products[0])?.id || '');
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
    <Section id="retail-sale-heading" title="Retail sale">
      {products.length ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1">
              <Label htmlFor="retail-product">Product</Label>
              <select id="retail-product" className={selectClass} value={productId} onChange={(event) => setProductId(event.target.value)}>
                {products.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatMoney(item.price)} · {item.availableQuantity} available</option>)}
              </select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="retail-quantity">Quantity</Label>
              <Input id="retail-quantity" inputMode="numeric" value={quantity} aria-invalid={!quantityValid} aria-describedby="retail-quantity-error" onChange={(event) => setQuantity(event.target.value)} />
              <p id="retail-quantity-error" className="text-xs text-destructive">{!quantityValid ? 'Enter a whole number from 1 to 100.' : product && !enough ? `Only ${product.availableQuantity} available.` : ''}</p>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="retail-tax-rate">Tax rate (%)</Label>
              <Input id="retail-tax-rate" inputMode="decimal" value={taxRate} aria-invalid={!rateValid} aria-describedby="retail-tax-help" onChange={(event) => setTaxRate(event.target.value)} />
              <p id="retail-tax-help" className={`text-xs ${rateValid ? 'text-muted-foreground' : 'text-destructive'}`}>{rateValid ? '' : 'Enter a rate from 0 to 100.'}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border font-mono text-sm tabular-nums ring-1 ring-border sm:grid-cols-4">
            <div className="bg-background px-3 py-2"><dt className="font-sans text-[11px] uppercase tracking-wider text-muted-foreground">Unit</dt><dd>{formatMoney(unitPrice)}</dd></div>
            <div className="bg-background px-3 py-2"><dt className="font-sans text-[11px] uppercase tracking-wider text-muted-foreground">Subtotal</dt><dd>{formatMoney(subtotal)}</dd></div>
            <div className="bg-background px-3 py-2"><dt className="font-sans text-[11px] uppercase tracking-wider text-muted-foreground">Tax {rateValid ? parsedRate : 0}%</dt><dd>{formatMoney(taxAmount)}</dd></div>
            <div className="bg-background px-3 py-2"><dt className="font-sans text-[11px] uppercase tracking-wider text-muted-foreground">Total</dt><dd className="font-semibold">{formatMoney(total)}</dd></div>
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            <Track label="Retail tender">
              <Pill size="sm" variant="flat" aria-pressed={retailTender === 'cash'} onClick={() => setRetailTender('cash')}>Cash</Pill>
              <Pill size="sm" variant="flat" aria-pressed={retailTender === 'card'} onClick={() => setRetailTender('card')}>Card terminal</Pill>
            </Track>
            <Track><Pill variant="primary" disabled={pending || !enough || !rateValid} onClick={submit}>{retailTender === 'card' ? `Record ${formatMoney(total)} card` : `Take ${formatMoney(total)} cash`}</Pill></Track>
          </div>
        </div>
      ) : <Empty>No active products. <Link className="underline" href="/dashboard/platform/services/new-product">Add a product</Link></Empty>}
      <div className="mt-3"><FeedbackMessage feedback={feedback} /></div>
    </Section>
  );
}

function RetailReturns({ data, query }: { data: PosProjectionData; query: PosQuery }) {
  const [openId, setOpenId] = useState('');
  return (
    <Section id="retail-return-heading" title="Retail returns" count={data.sales.total}>
      <form action="/dashboard/platform/pos" role="search" className="mb-3 flex items-end gap-2">
        <div className="grid min-w-0 flex-1 gap-1">
          <Label htmlFor="sale-search" className="sr-only">Find the original sale</Label>
          <Input id="sale-search" name="saleQ" defaultValue={data.sales.search} placeholder="Product, SKU or receipt number" />
        </div>
        <Track><Pill type="submit">Search</Pill></Track>
      </form>
      <div className="grid gap-x-8 md:grid-cols-2 xl:grid-cols-3">
        {data.productLines.map((line) => (
          <div key={line.id} className="border-b py-2.5 text-sm">
            <div className="flex items-baseline justify-between gap-2"><strong className="min-w-0 truncate font-medium">{line.productNameSnapshot}</strong><span className="font-mono tabular-nums">{formatMoney(line.total)}</span></div>
            <p className="text-xs text-muted-foreground">Qty {line.quantity}{line.returnedQuantity ? ` · ${line.returnedQuantity} returned` : ''} · {statusLabel(line.paymentMethod)} · {formatDateTime(line.occurredAt, data.timeZone)}</p>
            {(line.returnedQuantity || 0) < line.quantity && (openId === line.id
              ? <ReturnForm line={line} onClose={() => setOpenId('')} />
              : <Track className="mt-2"><Pill size="sm" aria-expanded={false} onClick={() => setOpenId(line.id)}>Return</Pill></Track>)}
          </div>
        ))}
        {!data.productLines.length && <Empty>{data.sales.search ? `No sales match “${data.sales.search}”.` : 'No retail sales recorded.'}</Empty>}
      </div>
      <Pager paging={data.sales} label="Sale pages" href={(page) => hrefWith(query, { sales: page })} />
    </Section>
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
        <Input id={`return-qty-${line.id}`} inputMode="numeric" value={quantity} aria-invalid={!quantityValid} onChange={(event) => setQuantity(event.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`return-reason-${line.id}`}>Reason</Label>
        <Input id={`return-reason-${line.id}`} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
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
    <Section id="receipts-heading" title="Receipts" count={data.receiptPaging.total}>
      <form action="/dashboard/platform/pos" role="search" className="mb-3 flex items-end gap-2">
        <div className="grid min-w-0 flex-1 gap-1">
          <Label htmlFor="receipt-lookup" className="sr-only">Receipt number</Label>
          <Input id="receipt-lookup" name="receipt" className="font-mono" defaultValue={data.receiptPaging.receiptId} placeholder="Receipt ID" />
        </div>
        <Track>
          <Pill type="submit">Look up</Pill>
          {data.receiptPaging.receiptId && <PillLink href={hrefWith(query, { receipt: null, receipts: null })}>All</PillLink>}
        </Track>
      </form>
      <div>
        {data.receipts.map((receipt) => (
          <div key={receipt.id} className="border-b py-2.5 text-sm last:border-b-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <strong className="font-medium"><StatusDot tone={receipt.status === 'paid' ? 'live' : receipt.status === 'voided' ? 'off' : 'wait'} />{customerName(receipt.customer)}</strong>
                <p className="text-xs text-muted-foreground">{formatDateTime(receipt.completedAt, data.timeZone)} · {statusLabel(receipt.paymentMethod)} · {statusLabel(receipt.status)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold tabular-nums">{formatMoney(receipt.total)}</span>
                <Track><Pill size="sm" aria-expanded={openId === receipt.id} aria-controls={`receipt-${receipt.id}`} onClick={() => setOpenId(openId === receipt.id ? '' : receipt.id)}>{openId === receipt.id ? 'Hide' : 'Details'}</Pill></Track>
              </div>
            </div>
            {openId === receipt.id && <ReceiptDetail receipt={receipt} timeZone={data.timeZone} />}
          </div>
        ))}
        {!data.receipts.length && <Empty>{data.receiptPaging.receiptId ? 'No receipt with that number in this shop.' : 'No appointment receipts yet.'}</Empty>}
      </div>
      <Pager paging={data.receiptPaging} label="Receipt pages" href={(page) => hrefWith(query, { receipts: page })} />
    </Section>
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
        <div className="space-y-2 rounded-2xl bg-muted/50 p-3 ring-1 ring-inset ring-black/5 dark:ring-white/5">
          <p className="text-xs font-medium">Cash refund · owner only</p>
          <p className="font-mono text-xs text-muted-foreground">Full {formatMoney(receipt.total)} · tax {formatMoney(receipt.taxAmount)} · tip {formatMoney(receipt.tipAmount)} · voids unpaid commissions</p>
          <div className="grid gap-1">
            <Label htmlFor={`refund-reason-${receipt.id}`}>Reason</Label>
            <Input id={`refund-reason-${receipt.id}`} value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} />
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
