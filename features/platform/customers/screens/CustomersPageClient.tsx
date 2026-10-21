'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarClock, MessageSquareText, PackageCheck, UserRoundCheck } from 'lucide-react';
import { useCommandKey } from '@/features/platform/lib/useCommandKey';
import {
  addCustomerNoteAction,
  issueCustomerWaiverAction,
  manageMembershipAction,
  setCustomerConsentAction,
  updateCustomerStatusAction,
  type CustomerCommandResult,
  type CustomerHistoryItem,
  type CustomerStatus,
  type CustomersProjectionData,
  type MembershipPlanSummary,
} from '../actions/customers';

type RelationAccess = 'granted' | 'restricted';

type CustomersPageClientProps = {
  data: CustomersProjectionData;
  search: string;
  planSearch: string;
  initialCustomerId: string;
};

type Feedback = { tone: 'status' | 'alert'; text: string } | null;

function fullName(customer?: CustomerHistoryItem | null) {
  return customer?.fullName || [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') || 'Customer';
}

function validDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Timestamps are shown in the shop's timezone, never the browser's.
function formatDateTime(value: string | null | undefined, timeZone: string, empty = 'Not recorded') {
  const date = validDate(value);
  if (!date) return empty;
  return new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(date);
}

function formatDay(value: string | null | undefined, timeZone: string, empty = 'Not recorded') {
  const date = validDate(value);
  if (!date) return empty;
  return new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatMoney(cents?: number | null) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function statusLabel(status?: string | null) {
  return status?.replace(/_/g, ' ') || 'unknown';
}

function listHref(listSlug: string, customerId: string) {
  const params = new URLSearchParams({ '!customer_is': JSON.stringify(customerId) });
  return `/dashboard/${listSlug}?${params.toString()}`;
}

function pageHref(search: string, page: number, planSearch: string) {
  const params = new URLSearchParams();
  if (search) params.set('q', search);
  if (planSearch) params.set('plans', planSearch);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return `/dashboard/platform/customers${query ? `?${query}` : ''}`;
}

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  return (
    <div aria-live="polite" className="min-h-0">
      {feedback && (
        <p role={feedback.tone} className={`rounded-md p-2 text-sm ${feedback.tone === 'alert' ? 'bg-destructive/10 text-destructive' : 'bg-muted'}`}>
          {feedback.text}
        </p>
      )}
    </div>
  );
}

function ViewAll({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="text-xs font-medium text-primary underline-offset-4 hover:underline">{label}</Link>;
}

export function CustomersPageClient({ data, search, planSearch, initialCustomerId }: CustomersPageClientProps) {
  const [selectedId, setSelectedId] = useState(initialCustomerId);
  const { customers, timeZone, page, pageSize, total } = data;
  // Never fall back to another customer when the selection disappears.
  const selected = customers.find((customer) => customer.id === selectedId) || null;
  const firstIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastIndex = Math.min(total, (page - 1) * pageSize + (customers.length - (data.requestedCustomerId ? 1 : 0)));

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 md:px-6">
      <form action="/dashboard/platform/customers" className="flex flex-col gap-2 sm:flex-row sm:items-end" role="search">
        <div className="grid flex-1 gap-1">
          <Label htmlFor="customer-search">Search customers</Label>
          <Input id="customer-search" name="q" defaultValue={search} placeholder="Name, phone, or email" />
        </div>
        <Button type="submit" variant="outline">Search</Button>
      </form>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section aria-labelledby="customer-directory-heading" className="min-w-0 rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="customer-directory-heading" className="font-semibold">Customers</h2>
            <span className="text-sm text-muted-foreground">{total ? `${firstIndex}–${lastIndex} of ${total}` : '0 customers'}</span>
          </div>
          <div className="space-y-3">
            {customers.map((customer) => {
              const isSelected = selected?.id === customer.id;
              return (
                <button
                  key={customer.id}
                  type="button"
                  aria-pressed={isSelected}
                  aria-controls="customer-detail"
                  onClick={() => setSelectedId(customer.id)}
                  className={`w-full rounded-xl border p-4 text-left transition ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted/50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">{fullName(customer)}</div>
                      <div className="truncate text-sm opacity-75">{customer.phone || customer.email || 'No contact'}</div>
                    </div>
                    <Badge variant={isSelected ? 'secondary' : 'outline'}>{statusLabel(customer.status)}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-black/10 px-2 py-1 dark:bg-white/10">Last visit {formatDay(customer.lastVisitAt, timeZone, 'none yet')}</span>
                    {data.requestedCustomerId === customer.id && <span className="rounded-full bg-black/10 px-2 py-1 dark:bg-white/10">Requested record</span>}
                  </div>
                </button>
              );
            })}
            {!customers.length && (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                {search ? <>No customers match “{search}”. <Link className="underline" href="/dashboard/platform/customers">Clear search</Link></> : <>No customers yet. <Link className="underline" href="/dashboard/customers/create">Add a customer</Link></>}
              </div>
            )}
          </div>
          {total > pageSize && (
            <nav aria-label="Customer pages" className="mt-4 flex items-center justify-between gap-2">
              {page > 1 ? <Button asChild size="sm" variant="outline"><Link href={pageHref(search, page - 1, planSearch)}>Previous</Link></Button> : <span />}
              <span className="text-xs text-muted-foreground">Page {page} of {Math.ceil(total / pageSize)}</span>
              {page * pageSize < total ? <Button asChild size="sm" variant="outline"><Link href={pageHref(search, page + 1, planSearch)}>Next</Link></Button> : <span />}
            </nav>
          )}
        </section>

        <section id="customer-detail" aria-label={selected ? `Customer details: ${fullName(selected)}` : 'Customer details'} className="min-w-0 rounded-xl border bg-card p-4 shadow-sm">
          {selected
            ? <CustomerDetail key={selected.id} customer={selected} data={data} search={search} planSearch={planSearch} />
            : <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Select a customer to view history and take action.</div>}
        </section>
      </div>
    </div>
  );
}

// Keyed by customer id: every draft below belongs to exactly this customer and is
// discarded when the operator explicitly selects someone else.
function CustomerDetail({ customer, data, search, planSearch }: { customer: CustomerHistoryItem; data: CustomersProjectionData; search: string; planSearch: string }) {
  const { timeZone, historyPreviewLimit: limit } = data;
  const notesAccess: RelationAccess = data.notesAccess === 'granted' ? 'granted' : 'restricted';
  const appointmentsAccess: RelationAccess = data.appointmentsAccess === 'granted' ? 'granted' : 'restricted';
  const paymentsAccess: RelationAccess = data.paymentsAccess === 'granted' ? 'granted' : 'restricted';
  const membershipsAccess: RelationAccess = data.membershipsAccess === 'granted' ? 'granted' : 'restricted';
  const membershipPlans: MembershipPlanSummary[] | null = membershipsAccess === 'granted' ? data.membershipPlans ?? [] : null;

  const [noteBody, setNoteBody] = useState('');
  const [noteType, setNoteType] = useState('preference');
  const [membershipPlanId, setMembershipPlanId] = useState(membershipPlans?.[0]?.id || '');
  const [waiverTitle, setWaiverTitle] = useState('General service consent');
  const [waiverType, setWaiverType] = useState('general');
  const servicePackages = membershipsAccess === 'granted' ? data.servicePackages ?? [] : null;
  const [servicePackageId, setServicePackageId] = useState(servicePackages?.[0]?.id || '');
  const [profileFeedback, setProfileFeedback] = useState<Feedback>(null);
  const [membershipFeedback, setMembershipFeedback] = useState<Feedback>(null);
  const [consentFeedback, setConsentFeedback] = useState<Feedback>(null);
  const [noteFeedback, setNoteFeedback] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();

  const noteKey = useCommandKey(`customer-note:${customer.id}`);
  const membershipKey = useCommandKey(`customer-membership:${customer.id}`);
  const consentKey = useCommandKey(`customer-consent:${customer.id}`);
  const waiverKey = useCommandKey(`customer-waiver:${customer.id}`);
  const statusKey = useCommandKey(`customer-status:${customer.id}`);

  const interrupted = 'Connection interrupted. The change may have completed. Retry to confirm; the same request will be reused.';

  const run = <T,>(
    setFeedback: (value: Feedback) => void,
    command: () => Promise<CustomerCommandResult<T>>,
    verify: (data: T | null) => boolean,
    success: string,
    settle: () => void,
    onSuccess?: () => void,
  ) => {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await command();
        if (!result.success) {
          setFeedback({ tone: 'alert', text: result.error || 'The change was not saved.' });
          return;
        }
        if (!verify(result.data)) {
          setFeedback({ tone: 'alert', text: 'The change reported success but could not be matched to this customer. Refresh before retrying.' });
          return;
        }
        settle();
        setFeedback({ tone: 'status', text: success });
        onSuccess?.();
      } catch {
        setFeedback({ tone: 'alert', text: interrupted });
      }
    });
  };

  const addNote = () => {
    const body = noteBody.trim();
    if (!body) return;
    const submitted = noteBody;
    const input = { customerId: customer.id, body, noteType };
    run(setNoteFeedback, () => addCustomerNoteAction({ ...input, idempotencyKey: noteKey.keyFor(input) }), (result) => Boolean(result?.id), 'Note added.', noteKey.settle,
      // Clear only the exact text that was submitted; newer typing is preserved.
      () => setNoteBody((current) => (current === submitted ? '' : current)));
  };

  const runMembership = (action: 'purchase' | 'purchase_package' | 'renew' | 'pause' | 'resume' | 'cancel', balanceId?: string) => {
    if (action === 'purchase' && !membershipPlanId) return;
    if (action === 'purchase_package' && !servicePackageId) return;
    const input = { action, customerId: customer.id, membershipPlanId: action === 'purchase' ? membershipPlanId : undefined, servicePackageId: action === 'purchase_package' ? servicePackageId : undefined, customerPackageId: balanceId };
    const labels = { purchase: 'Membership purchased with cash.', purchase_package: 'Package sold for cash.', renew: 'Membership renewed with cash.', pause: 'Membership paused.', resume: 'Membership resumed.', cancel: 'Membership cancelled.' } as const;
    run(setMembershipFeedback, () => manageMembershipAction({ ...input, idempotencyKey: membershipKey.keyFor(input) }), (result) => Boolean(result?.id) && (!balanceId || result?.id === balanceId), labels[action], membershipKey.settle);
  };

  const saveConsent = (acceptsMarketing: boolean, preferredContactMethod: string) => {
    const input = { customerId: customer.id, acceptsMarketing, preferredContactMethod };
    run(setConsentFeedback, () => setCustomerConsentAction({ ...input, idempotencyKey: consentKey.keyFor(input) }), (result) => result?.id === customer.id && result?.acceptsMarketing === acceptsMarketing, acceptsMarketing ? `Contact preference recorded by staff: ${statusLabel(preferredContactMethod)} marketing allowed.` : 'Contact preference recorded by staff: no marketing.', consentKey.settle);
  };

  const issueWaiver = () => {
    const title = waiverTitle.trim();
    if (!title) return;
    const input = { customerId: customer.id, title, waiverType, deliveryStatus: 'draft' as const };
    run(setConsentFeedback, () => issueCustomerWaiverAction({ ...input, idempotencyKey: waiverKey.keyFor(input) }), (result) => Boolean(result?.id),
      'Waiver record created. Nothing was sent to the customer; signature is still pending.',
      waiverKey.settle);
  };

  const updateStatus = (status: CustomerStatus) => {
    const input = { customerId: customer.id, status };
    run(setProfileFeedback, () => updateCustomerStatusAction({ ...input, idempotencyKey: statusKey.keyFor(input) }), (result) => result?.id === customer.id && result?.status === status, `Marked ${statusLabel(status)}.`, statusKey.settle);
  };

  const noteId = `note-body-${customer.id}`;
  const noteTypeId = `note-type-${customer.id}`;
  const waiverTitleId = `waiver-title-${customer.id}`;
  const waiverTypeId = `waiver-type-${customer.id}`;
  const packageSaleId = `package-sale-${customer.id}`;
  const planId = `membership-plan-${customer.id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">{fullName(customer)}</h2>
          <p className="text-sm text-muted-foreground">{customer.phone || 'No phone'} · {customer.email || 'No email'} · prefers {statusLabel(customer.preferredContactMethod)}</p>
          {data.staffAccess === 'restricted'
            ? <p className="mt-1 text-sm text-muted-foreground">Preferred barber restricted.</p>
            : customer.preferredBarber && <p className="mt-1 text-sm text-muted-foreground">Preferred barber: {customer.preferredBarber.displayName || 'Barber unavailable'}</p>}
          <Link className="mt-1 inline-block text-xs text-primary underline-offset-4 hover:underline" href={`/dashboard/customers/${customer.id}`}>Edit profile</Link>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={`Status for ${fullName(customer)}`}>
          {(['active', 'vip', 'needs_attention', 'blocked'] as CustomerStatus[]).map((status) => <Button key={status} size="sm" aria-pressed={customer.status === status} variant={customer.status === status ? 'default' : 'outline'} disabled={pending} onClick={() => updateStatus(status)}>{statusLabel(status)}</Button>)}
        </div>
      </div>
      <FeedbackMessage feedback={profileFeedback} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-background p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold"><CalendarClock className="h-4 w-4" /> Recent visits</h3>
            {appointmentsAccess === 'granted' && <ViewAll href={listHref('appointments', customer.id)} label="All visits" />}
          </div>
          <div className="space-y-3">
            {appointmentsAccess === 'restricted' && <p className="text-sm text-muted-foreground">Visit history restricted. Your role does not include appointment access for this shop.</p>}
            {(customer.appointments || []).map((appointment) => (
              <div key={appointment.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2"><strong>{appointment.serviceTitleSnapshot || 'Service label not recorded'}</strong><span>{formatDateTime(appointment.startsAt, timeZone)}</span></div>
                <div className="mt-1 text-muted-foreground">{appointment.barberNameSnapshot || 'Barber not recorded'} · {statusLabel(appointment.status)} · {statusLabel(appointment.paymentStatus)}</div>
                {appointment.transaction && (
                  <div className="mt-2 font-medium">
                    Paid {appointment.transaction.formattedTotal || formatMoney(appointment.transaction.total)} by {statusLabel(appointment.transaction.paymentMethod)} ·{' '}
                    <Link className="text-primary underline-offset-4 hover:underline" href={`/dashboard/checkout-transactions/${appointment.transaction.id}`}>Receipt</Link>
                  </div>
                )}
              </div>
            ))}
            {appointmentsAccess === 'granted' && paymentsAccess === 'restricted' && Boolean(customer.appointments?.length) && <p className="text-xs text-muted-foreground">Payment details restricted.</p>}
            {appointmentsAccess === 'granted' && !customer.appointments?.length && <p className="text-sm text-muted-foreground">No visits yet.</p>}
            {appointmentsAccess === 'granted' && (customer.appointments?.length || 0) >= limit && <p className="text-xs text-muted-foreground">Showing the latest {limit} visits.</p>}
            {paymentsAccess === 'granted' && <ViewAll href={listHref('checkout-transactions', customer.id)} label="All receipts" />}
          </div>
        </div>

        <div className="rounded-xl border bg-background p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold"><PackageCheck className="h-4 w-4" /> Memberships & packages</h3>
            {membershipsAccess === 'granted' && <ViewAll href={listHref('customer-packages', customer.id)} label="All balances" />}
          </div>
          <div className="space-y-3">
            {(customer.packageBalances || []).map((balance) => {
              const renewable = Boolean(balance.membershipPlan) && ['active', 'paused', 'expired', 'used_up'].includes(String(balance.status));
              return (
                <div key={balance.id} className="rounded-lg border p-3 text-sm">
                  <strong>{balance.servicePackage?.name || balance.membershipPlan?.name || 'Balance'}</strong>
                  <div className="mt-1 text-muted-foreground">{balance.remainingVisits ?? 0} visits left · {statusLabel(balance.status)}</div>
                  {balance.expiresAt && <div className="mt-1 text-muted-foreground">{balance.status === 'expired' ? 'Expired' : 'Expires'} {formatDay(balance.expiresAt, timeZone)}</div>}
                  {balance.membershipPlan && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {renewable && paymentsAccess === 'granted' && <Button size="sm" variant="outline" disabled={pending} onClick={() => runMembership('renew', balance.id)}>Renew · {formatMoney(balance.membershipPlan.price)} cash</Button>}
                      {balance.status === 'active' && <Button size="sm" variant="outline" disabled={pending} onClick={() => runMembership('pause', balance.id)}>Pause</Button>}
                      {balance.status === 'paused' && <Button size="sm" variant="outline" disabled={pending} onClick={() => runMembership('resume', balance.id)}>Resume</Button>}
                      {['active', 'paused'].includes(String(balance.status)) && <Button size="sm" variant="ghost" disabled={pending} onClick={() => runMembership('cancel', balance.id)}>Cancel</Button>}
                    </div>
                  )}
                </div>
              );
            })}
            {membershipsAccess === 'restricted' && <p className="text-sm text-muted-foreground">Membership details restricted. Your role does not include membership access for this shop.</p>}
            {membershipsAccess === 'granted' && !customer.packageBalances?.length && <p className="text-sm text-muted-foreground">No package or membership balance.</p>}
            {membershipsAccess === 'granted' && membershipPlans && (
              <div className="rounded-lg border border-dashed p-3">
                <form action="/dashboard/platform/customers" className="flex flex-col gap-2 sm:flex-row sm:items-end" role="search">
                  {search && <input type="hidden" name="q" value={search} />}
                  <input type="hidden" name="customer" value={customer.id} />
                  <div className="grid flex-1 gap-1">
                    <Label htmlFor={`plan-search-${customer.id}`} className="text-xs">Find a plan or package</Label>
                    <Input id={`plan-search-${customer.id}`} name="plans" defaultValue={planSearch} placeholder="Plan name" />
                  </div>
                  <Button type="submit" size="sm" variant="outline">Find</Button>
                </form>
                {membershipPlans.length > 0 ? (
                  <div className="mt-3 grid gap-1">
                    <Label htmlFor={planId} className="text-xs">Add membership</Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <select id={planId} value={membershipPlanId} onChange={(event) => setMembershipPlanId(event.target.value)} className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm">
                        {membershipPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {formatMoney(plan.price)} / {statusLabel(plan.billingInterval)}</option>)}
                      </select>
                      <Button size="sm" disabled={pending || !membershipPlanId || paymentsAccess !== 'granted'} onClick={() => runMembership('purchase')}>Purchase · cash</Button>
                    </div>
                  </div>
                ) : <p className="mt-2 text-xs text-muted-foreground">{planSearch ? `No active plans match “${planSearch}”.` : 'No active membership plans.'}</p>}
                {data.membershipPlansTruncated && <p className="mt-2 text-xs text-muted-foreground">More plans match than are listed. Narrow the plan search to find others.</p>}
                {servicePackages && servicePackages.length > 0 && (
                  <div className="mt-3 grid gap-1">
                    <Label htmlFor={packageSaleId} className="text-xs">Sell a package</Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <select id={packageSaleId} value={servicePackageId} onChange={(event) => setServicePackageId(event.target.value)} className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm">
                        {servicePackages.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name} · {pkg.visits} visit{pkg.visits === 1 ? '' : 's'} · {formatMoney(pkg.price)}</option>)}
                      </select>
                      <Button size="sm" disabled={pending || !servicePackageId || paymentsAccess !== 'granted'} onClick={() => runMembership('purchase_package')}>Sell package · cash</Button>
                    </div>
                    {data.servicePackagesTruncated && <p className="text-xs text-muted-foreground">More packages match than are listed. Narrow the search to find others.</p>}
                  </div>
                )}
                {paymentsAccess !== 'granted' && <p className="mt-2 text-xs text-muted-foreground">Selling or renewing needs payment access for this shop.</p>}
                <p className="mt-2 text-xs text-muted-foreground">Cash only. Card and gift card are unavailable for memberships and packages.</p>
              </div>
            )}
            <FeedbackMessage feedback={membershipFeedback} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-background p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold"><UserRoundCheck className="h-4 w-4" /> Consent & waivers</h3>
          <ViewAll href={listHref('waiver-forms', customer.id)} label="All waivers" />
        </div>
        <p className="text-sm text-muted-foreground">Contact preference (recorded by staff): {customer.acceptsMarketing ? `marketing allowed via ${statusLabel(customer.preferredContactMethod)}` : 'no marketing'}.</p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Record the customer's contact preference">
          <Button size="sm" variant="outline" disabled={pending} onClick={() => saveConsent(true, 'sms')}>Customer prefers SMS</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => saveConsent(true, 'email')}>Customer prefers email</Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => saveConsent(false, customer.preferredContactMethod || 'sms')}>Customer declines marketing</Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Record only what the customer told you. This is a staff note of their preference, not a signed opt-in.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <Label htmlFor={waiverTitleId}>Waiver title</Label>
            <Input id={waiverTitleId} value={waiverTitle} maxLength={200} onChange={(event) => setWaiverTitle(event.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor={waiverTypeId}>Waiver type</Label>
            <select id={waiverTypeId} value={waiverType} onChange={(event) => setWaiverType(event.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
              <option value="general">General</option>
              <option value="minor_consent">Minor consent</option>
              <option value="chemical_service">Chemical service</option>
              <option value="photo_release">Photo release</option>
            </select>
          </div>
        </div>
        <Button className="mt-3" size="sm" disabled={pending || !waiverTitle.trim()} onClick={issueWaiver}>Create waiver record</Button>
        <p className="mt-2 text-xs text-muted-foreground">The system does not send waivers. Signing happens from the customer’s own appointment link.</p>
        <div className="mt-3 space-y-2">
          {(customer.waivers || []).map((waiver) => <div key={waiver.id} className="flex flex-wrap justify-between gap-2 rounded-md bg-muted p-2 text-xs"><span>{waiver.title} · {statusLabel(waiver.waiverType)}</span><Badge variant="outline">{waiver.signedAt || waiver.status === 'signed' ? `signed${waiver.signedAt ? ` ${formatDay(waiver.signedAt, timeZone)}` : ''}` : ['draft', 'sent'].includes(waiver.status) ? 'awaiting signature' : statusLabel(waiver.status)}</Badge></div>)}
          {!customer.waivers?.length && <p className="text-xs text-muted-foreground">No waivers on record.</p>}
        </div>
        <div className="mt-3"><FeedbackMessage feedback={consentFeedback} /></div>
      </div>

      <div className="rounded-xl border bg-background p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold"><MessageSquareText className="h-4 w-4" /> Notes</h3>
          {notesAccess === 'granted' && <ViewAll href={listHref('customer-notes', customer.id)} label="All notes" />}
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_0.9fr]">
          <div className="space-y-3">
            {(customer.notes || []).map((note) => (
              <div key={note.id} className="rounded-lg border p-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><Badge variant="outline">{statusLabel(note.noteType)}</Badge><span className="text-muted-foreground">{formatDateTime(note.createdAt, timeZone)}</span></div>
                <p className="whitespace-pre-wrap break-words">{note.body}</p>
                {note.appointment && <p className="mt-2 text-xs text-muted-foreground">Linked to {note.appointment.serviceTitleSnapshot || 'appointment'} on {formatDateTime(note.appointment.startsAt, timeZone)}</p>}
              </div>
            ))}
            {notesAccess === 'restricted'
              ? <p className="text-sm text-muted-foreground">Notes restricted. Your role does not include customer-note access for this shop.</p>
              : !customer.notes?.length && <p className="text-sm text-muted-foreground">No notes yet.</p>}
            {notesAccess === 'granted' && (customer.notes?.length || 0) >= limit && <p className="text-xs text-muted-foreground">Showing the latest {limit} notes.</p>}
          </div>
          {notesAccess === 'granted' && (
            <div className="space-y-3">
              <div className="grid gap-1">
                <Label htmlFor={noteTypeId}>Note type</Label>
                <select id={noteTypeId} value={noteType} onChange={(event) => setNoteType(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                  <option value="preference">Preference</option>
                  <option value="formula">Formula / cut detail</option>
                  <option value="service_issue">Service issue</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor={noteId}>Note</Label>
                <textarea id={noteId} value={noteBody} onChange={(event) => setNoteBody(event.target.value)} placeholder="Preference, guard length, beard note, or recovery note" className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm" />
              </div>
              <Button disabled={pending || !noteBody.trim()} onClick={addNote}>Add note for {fullName(customer)}</Button>
              <FeedbackMessage feedback={noteFeedback} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
