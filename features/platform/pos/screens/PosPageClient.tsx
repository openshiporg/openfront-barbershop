'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, ReceiptText, ShoppingBag } from 'lucide-react';
import { useCommandKey } from '@/features/platform/lib/useCommandKey';
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
  return (
    <div aria-live="polite">
      {feedback && <p role={feedback.tone} className={`rounded-md p-3 text-sm ${feedback.tone === 'alert' ? 'bg-destructive/10 text-destructive' : 'bg-muted'}`}>{feedback.text}</p>}
    </div>
  );
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
  return (
    <nav aria-label={label} className="mt-4 flex items-center justify-between gap-2">
      {paging.page > 1 ? <Button asChild size="sm" variant="outline"><Link href={href(paging.page - 1)}>Previous</Link></Button> : <span />}
      <span className="text-xs text-muted-foreground">Page {paging.page} of {pages} · {paging.total} total</span>
      {paging.page < pages ? <Button asChild size="sm" variant="outline"><Link href={href(paging.page + 1)}>Next</Link></Button> : <span />}
    </nav>
  );
}

export function PosPageClient({ data, query }: { data: PosProjectionData; query: PosQuery }) {
  const { appointments, requestedAppointment, requestedAppointmentId, timeZone } = data;
  const [selectedId, setSelectedId] = useState(requestedAppointmentId || appointments[0]?.id || '');
  // The selected ticket is resolved by id only; a missing ticket is never replaced by another.
  const selected = (requestedAppointment && requestedAppointment.id === selectedId ? requestedAppointment : null)
    || appointments.find((appointment) => appointment.id === selectedId)
    || null;
  const requestedClosed = Boolean(requestedAppointment && (['paid', 'refunded'].includes(String(requestedAppointment.paymentStatus)) || !checkoutStatuses.includes(String(requestedAppointment.status))));

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 md:px-6">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild><Link href="/dashboard/platform/booking">Booking board</Link></Button>
        <Button variant="outline" asChild><Link href="/dashboard/platform/queue">Walk-in queue</Link></Button>
      </div>

      {requestedAppointmentId && !requestedAppointment && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">The appointment sent to checkout was not found in this shop. Select a ticket below.</p>
      )}
      {requestedAppointment && requestedClosed && selected?.id === requestedAppointment.id && (
        <p role="status" className="rounded-md border p-3 text-sm">This appointment is {statusLabel(requestedAppointment.status)} with payment {statusLabel(requestedAppointment.paymentStatus)}. It cannot be checked out again; look up its receipt below.</p>
      )}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section aria-labelledby="pos-queue-heading" className="min-w-0 rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="pos-queue-heading" className="font-semibold">Checkout queue</h2>
            <Badge variant="secondary">{data.tickets.total} open</Badge>
          </div>
          <form action="/dashboard/platform/pos" role="search" className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-1">
              <Label htmlFor="ticket-search">Find a ticket</Label>
              <Input id="ticket-search" name="ticketQ" defaultValue={data.tickets.search} placeholder="Customer, phone, service or barber" />
            </div>
            <Button type="submit" variant="outline">Search</Button>
          </form>
          <div className="space-y-3">
            {appointments.map((appointment) => {
              const isSelected = selected?.id === appointment.id;
              return (
                <button
                  key={appointment.id}
                  type="button"
                  aria-pressed={isSelected}
                  aria-controls="pos-tender"
                  onClick={() => setSelectedId(appointment.id)}
                  className={`w-full rounded-xl border p-4 text-left transition ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted/50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">{customerName(appointment.customer)}</div>
                      <div className="text-sm opacity-75">{serviceLabel(appointment)} · {barberLabel(appointment)}</div>
                      <div className="text-xs opacity-75">{formatDateTime(appointment.startsAt, timeZone)}</div>
                    </div>
                    <span className="font-semibold">{formatMoney(appointment.price)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-black/10 px-2 py-1 dark:bg-white/10">{statusLabel(appointment.status)}</span>
                    <span className="rounded-full bg-black/10 px-2 py-1 dark:bg-white/10">payment {statusLabel(appointment.paymentStatus)}</span>
                    {(appointment.customer?.packageBalances?.length ?? 0) > 0 && <span className="rounded-full bg-black/10 px-2 py-1 dark:bg-white/10">package balance</span>}
                  </div>
                </button>
              );
            })}
            {!appointments.length && <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">{data.tickets.search ? `No open tickets match “${data.tickets.search}”.` : 'No checked-in or in-chair appointments need checkout.'}</div>}
          </div>
          <Pager paging={data.tickets} label="Ticket pages" href={(page) => hrefWith(query, { tickets: page, appointment: null })} />
        </section>

        <section id="pos-tender" aria-labelledby="pos-tender-heading" className="min-w-0 rounded-xl border bg-card p-4 shadow-sm">
          <h2 id="pos-tender-heading" className="mb-4 flex items-center gap-2 font-semibold"><CreditCard className="h-5 w-5" /> Take payment</h2>
          {selected
            ? <TenderPanel key={selected.id} appointment={selected} closed={requestedClosed && selected.id === requestedAppointment?.id} timeZone={timeZone} />
            : <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Select a ticket to take payment.</div>}
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
      <div className="rounded-xl bg-muted/40 p-4">
        <div className="text-lg font-semibold">{customerName(appointment.customer)}</div>
        <div className="text-sm text-muted-foreground">{serviceLabel(appointment)} with {barberLabel(appointment)} · {formatDateTime(appointment.startsAt, timeZone)}</div>
        <div className="mt-3 text-3xl font-semibold">{formatMoney(total)}</div>
        <p className="mt-1 text-xs text-muted-foreground">Service {formatMoney(subtotal)} + tip {formatMoney(tip || 0)} + tax {formatMoney(tax || 0)} − discount {formatMoney(appliedDiscount)}</p>
        {appointment.status !== 'in_chair' && !closed && <p role="status" className="mt-2 text-sm">Seat this visit from the booking board before checkout.</p>}
        {paymentMethod === 'package' && total > 0 && <p role="alert" className="mt-2 text-sm text-destructive">A prepaid visit cannot include tips or tax on this ticket. Mixed tender is not supported.</p>}
        {!amountsValid && <p role="alert" className="mt-2 text-sm text-destructive">Tip, discount and tax must be zero or positive dollar amounts.</p>}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-1">
          <Label htmlFor={`tender-${id}`}>Payment method</Label>
          <select id={`tender-${id}`} value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); if (event.target.value !== 'package') setPackageBalanceId(''); }} className="rounded-md border bg-background px-3 py-2 text-sm">
            <option value="cash">Cash</option>
            {packageBalances.length > 0 && <option value="package">Package or membership visit</option>}
          </select>
          <p className="text-xs text-muted-foreground">Card and gift card are not available at this register.</p>
        </div>
        {paymentMethod === 'package' && (
          <div className="grid gap-1">
            <Label htmlFor={`balance-${id}`}>Balance</Label>
            <select id={`balance-${id}`} value={packageBalanceId} onChange={(event) => setPackageBalanceId(event.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
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
          <Label htmlFor={`tip-${id}`}>Tip ($)</Label>
          <Input id={`tip-${id}`} value={tipAmount} onChange={(event) => setTipAmount(event.target.value)} inputMode="decimal" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`discount-${id}`}>Discount ($)</Label>
          <Input id={`discount-${id}`} value={discountAmount} onChange={(event) => setDiscountAmount(event.target.value)} inputMode="decimal" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`tax-${id}`}>Tax ($)</Label>
          <Input id={`tax-${id}`} value={taxAmount} onChange={(event) => setTaxAmount(event.target.value)} inputMode="decimal" />
        </div>
      </div>

      <div className="grid gap-1">
        <Label htmlFor={`notes-${id}`}>Checkout notes</Label>
        <textarea id={`notes-${id}`} value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm" />
      </div>

      <FeedbackMessage feedback={feedback} />
      <Button className="w-full" disabled={pending || !eligible} onClick={submitCheckout}>
        {pending ? 'Processing…' : paymentMethod === 'package' ? `Redeem visit for ${customerName(appointment.customer)}` : `Take ${formatMoney(total)} cash from ${customerName(appointment.customer)}`}
      </Button>
    </div>
  );
}

function RetailSale({ data }: { data: PosProjectionData }) {
  const { products } = data;
  const [productId, setProductId] = useState(products[0]?.id || '');
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
    const input = { productId: product.id, quantity: parsedQuantity, paymentMethod: 'cash', taxRateBps };
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
    <section aria-labelledby="retail-sale-heading" className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 id="retail-sale-heading" className="mb-4 flex items-center gap-2 font-semibold"><ShoppingBag className="h-4 w-4" /> Retail sale</h2>
      {products.length ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1">
              <Label htmlFor="retail-product">Product</Label>
              <select id="retail-product" className="rounded-md border bg-background px-3 py-2 text-sm" value={productId} onChange={(event) => setProductId(event.target.value)}>
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
              <p id="retail-tax-help" className={`text-xs ${rateValid ? 'text-muted-foreground' : 'text-destructive'}`}>{rateValid ? 'Enter the rate that applies to this sale; 0 records no tax.' : 'Enter a rate from 0 to 100.'}</p>
            </div>
          </div>
          <dl className="grid gap-1 rounded-md bg-muted/40 p-3 text-sm sm:grid-cols-4">
            <div><dt className="text-muted-foreground">Unit price</dt><dd>{formatMoney(unitPrice)}</dd></div>
            <div><dt className="text-muted-foreground">Subtotal</dt><dd>{formatMoney(subtotal)}</dd></div>
            <div><dt className="text-muted-foreground">Tax ({rateValid ? parsedRate : 0}%)</dt><dd>{formatMoney(taxAmount)}</dd></div>
            <div><dt className="text-muted-foreground">Total</dt><dd className="font-semibold">{formatMoney(total)}</dd></div>
          </dl>
          <Button disabled={pending || !enough || !rateValid} onClick={submit}>Take {formatMoney(total)} cash</Button>
        </div>
      ) : <p className="text-sm text-muted-foreground">No active products. <Link className="underline" href="/dashboard/products/create">Add a product</Link></p>}
      <div className="mt-3"><FeedbackMessage feedback={feedback} /></div>
    </section>
  );
}

function RetailReturns({ data, query }: { data: PosProjectionData; query: PosQuery }) {
  const [openId, setOpenId] = useState('');
  return (
    <section aria-labelledby="retail-return-heading" className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 id="retail-return-heading" className="mb-4 font-semibold">Retail returns</h2>
      <form action="/dashboard/platform/pos" role="search" className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="grid flex-1 gap-1">
          <Label htmlFor="sale-search">Find the original sale</Label>
          <Input id="sale-search" name="saleQ" defaultValue={data.sales.search} placeholder="Product, SKU or receipt number" />
        </div>
        <Button type="submit" variant="outline">Search</Button>
      </form>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {data.productLines.map((line) => (
          <div key={line.id} className="rounded-lg border p-3 text-sm">
            <div className="flex justify-between gap-2"><strong>{line.productNameSnapshot}</strong><span>{formatMoney(line.total)}</span></div>
            <p className="text-muted-foreground">Qty {line.quantity}{line.returnedQuantity ? ` · ${line.returnedQuantity} returned` : ''} · {statusLabel(line.paymentMethod)} · {formatDateTime(line.occurredAt, data.timeZone)}</p>
            {(line.returnedQuantity || 0) < line.quantity && (openId === line.id
              ? <ReturnForm line={line} onClose={() => setOpenId('')} />
              : <Button className="mt-2" size="sm" variant="outline" aria-expanded={false} onClick={() => setOpenId(line.id)}>Review return</Button>)}
          </div>
        ))}
        {!data.productLines.length && <p className="text-sm text-muted-foreground">{data.sales.search ? `No sales match “${data.sales.search}”.` : 'No retail sales recorded.'}</p>}
      </div>
      <Pager paging={data.sales} label="Sale pages" href={(page) => hrefWith(query, { sales: page })} />
    </section>
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
        <Label htmlFor={`return-restock-${line.id}`} className="text-xs font-normal">Put the returned units back into sellable stock (only if the product is unopened and undamaged).</Label>
      </div>
      <p className="text-xs text-muted-foreground">{restock ? 'Returned units go back to the original stock lot.' : 'Returned units are not added back to stock.'}</p>
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || !valid} onClick={submit}>Record return</Button>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </div>
      <FeedbackMessage feedback={feedback} />
    </div>
  );
}

function Receipts({ data, query }: { data: PosProjectionData; query: PosQuery }) {
  const [openId, setOpenId] = useState(data.receiptPaging.receiptId || '');
  return (
    <section aria-labelledby="receipts-heading" className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 id="receipts-heading" className="mb-4 flex items-center gap-2 font-semibold"><ReceiptText className="h-4 w-4" /> Appointment receipts</h2>
      <form action="/dashboard/platform/pos" role="search" className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="grid flex-1 gap-1">
          <Label htmlFor="receipt-lookup">Receipt number</Label>
          <Input id="receipt-lookup" name="receipt" defaultValue={data.receiptPaging.receiptId} placeholder="Receipt ID" />
        </div>
        <Button type="submit" variant="outline">Look up</Button>
        {data.receiptPaging.receiptId && <Button asChild variant="ghost"><Link href={hrefWith(query, { receipt: null, receipts: null })}>Show all</Link></Button>}
      </form>
      <div className="space-y-2">
        {data.receipts.map((receipt) => (
          <div key={receipt.id} className="rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <strong>{customerName(receipt.customer)}</strong>
                <p className="text-xs text-muted-foreground">{formatDateTime(receipt.completedAt, data.timeZone)} · {statusLabel(receipt.paymentMethod)} · {statusLabel(receipt.status)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{formatMoney(receipt.total)}</span>
                <Button size="sm" variant="outline" aria-expanded={openId === receipt.id} aria-controls={`receipt-${receipt.id}`} onClick={() => setOpenId(openId === receipt.id ? '' : receipt.id)}>{openId === receipt.id ? 'Hide' : 'Details'}</Button>
              </div>
            </div>
            {openId === receipt.id && <ReceiptDetail receipt={receipt} timeZone={data.timeZone} />}
          </div>
        ))}
        {!data.receipts.length && <p className="text-sm text-muted-foreground">{data.receiptPaging.receiptId ? 'No appointment receipt with that number in this shop.' : 'No appointment receipts yet.'}</p>}
      </div>
      <Pager paging={data.receiptPaging} label="Receipt pages" href={(page) => hrefWith(query, { receipts: page })} />
    </section>
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
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline"><Link href={`/dashboard/checkout-transactions/${receipt.id}`}>Open receipt record</Link></Button>
        <Button size="sm" variant="outline" onClick={() => window.print()}>Print</Button>
      </div>
      {refundable && (
        <div className="space-y-2 rounded-md border border-dashed p-3">
          <p className="text-xs font-medium">Cash refund (shop owner only)</p>
          <p className="text-xs text-muted-foreground">Refunds the full {formatMoney(receipt.total)} including tax {formatMoney(receipt.taxAmount)} and tip {formatMoney(receipt.tipAmount)}. Unpaid commissions on this receipt are voided; if a commission was already paid, the refund is refused until it is reconciled.</p>
          <div className="grid gap-1">
            <Label htmlFor={`refund-reason-${receipt.id}`}>Reason</Label>
            <Input id={`refund-reason-${receipt.id}`} value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} />
          </div>
          <div className="flex items-start gap-2">
            <Checkbox id={`refund-cash-${receipt.id}`} checked={cashReturned} onCheckedChange={(value) => setCashReturned(value === true)} />
            <Label htmlFor={`refund-cash-${receipt.id}`} className="text-xs font-normal">I returned {formatMoney(receipt.total)} in cash to the customer.</Label>
          </div>
          <Button size="sm" variant="destructive" disabled={pending || !valid} onClick={submitRefund}>Record cash refund</Button>
        </div>
      )}
      <FeedbackMessage feedback={feedback} />
    </div>
  );
}
