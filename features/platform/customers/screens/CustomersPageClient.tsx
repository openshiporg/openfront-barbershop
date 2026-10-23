'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCommandKey } from '@/features/platform/lib/useCommandKey';
import { Empty, Notice, Pager, Pill, PillLink, Restricted, Section, selectClass, StatusDot, Tag, Track, type Tone } from '@/features/platform/lib/ui';
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

const customerTone: Record<CustomerStatus, Tone> = { active: 'live', vip: 'info', needs_attention: 'wait', blocked: 'alert' };

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  return <div aria-live="polite">{feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}</div>;
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
    <div className="flex min-w-0 flex-col gap-6 px-4 pb-8 md:px-6">
      <form action="/dashboard/platform/customers" className="flex items-end gap-2" role="search">
        <div className="grid min-w-0 flex-1 gap-1">
          <Label htmlFor="customer-search" className="text-xs text-muted-foreground">Search customers</Label>
          <Input id="customer-search" name="q" defaultValue={search} placeholder="Name, phone, or email" />
        </div>
        <Track><Pill type="submit">Search</Pill>{search ? <PillLink href="/dashboard/platform/customers">Clear</PillLink> : null}</Track>
      </form>

      <div className="grid min-w-0 grid-cols-1 gap-8 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
        <Section id="customer-directory-heading" title="Directory" count={total ? `${firstIndex}–${lastIndex} / ${total}` : '0'}>
          <div className="space-y-1 rounded-2xl bg-muted/50 p-1 ring-1 ring-inset ring-black/5 dark:ring-white/5">
            {customers.map((customer) => {
              const isSelected = selected?.id === customer.id;
              return (
                <button
                  key={customer.id}
                  type="button"
                  aria-pressed={isSelected}
                  aria-controls="customer-detail"
                  onClick={() => setSelectedId(customer.id)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 rounded-xl px-3 py-2.5 text-left transition aria-pressed:bg-background aria-pressed:shadow-sm aria-pressed:ring-1 aria-pressed:ring-black/5 hover:bg-background/60 dark:aria-pressed:bg-zinc-800"
                >
                  <span className="min-w-0 truncate font-medium"><StatusDot tone={customerTone[customer.status as CustomerStatus] || 'off'} />{fullName(customer)}</span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatDay(customer.lastVisitAt, timeZone, '—')}</span>
                  <span className="col-span-2 truncate pl-4 text-xs text-muted-foreground">{customer.phone || customer.email || 'No contact'}{data.requestedCustomerId === customer.id ? ' · requested record' : ''}</span>
                </button>
              );
            })}
            {!customers.length && (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                {search ? <>No customers match “{search}”.</> : <>No customers yet. <Link className="underline" href="/dashboard/platform/customers/new">Add a customer</Link></>}
              </p>
            )}
          </div>
          <Pager label="Customer pages" page={page} pages={Math.ceil(total / pageSize)} prev={page > 1 ? pageHref(search, page - 1, planSearch) : null} next={page * pageSize < total ? pageHref(search, page + 1, planSearch) : null} />
        </Section>

        <section id="customer-detail" aria-label={selected ? `Customer details: ${fullName(selected)}` : 'Customer details'} className="min-w-0">
          {selected
            ? <CustomerDetail key={selected.id} customer={selected} data={data} search={search} planSearch={planSearch} />
            : <Empty>Select a customer.</Empty>}
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
      'Waiver record created. Nothing was sent; signature pending.',
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

  const waiverTone = (waiver: NonNullable<CustomerHistoryItem['waivers']>[number]): Tone => (waiver.signedAt || waiver.status === 'signed' ? 'live' : ['draft', 'sent'].includes(waiver.status) ? 'wait' : 'off');

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight"><StatusDot tone={customerTone[customer.status as CustomerStatus] || 'off'} />{fullName(customer)}</h2>
            <p className="text-sm text-muted-foreground">{customer.phone || 'No phone'} · {customer.email || 'No email'} · prefers {statusLabel(customer.preferredContactMethod)}</p>
            {data.staffAccess === 'restricted'
              ? <p className="text-sm text-muted-foreground">Preferred barber restricted.</p>
              : customer.preferredBarber && <p className="text-sm text-muted-foreground">Preferred barber: {customer.preferredBarber.displayName || 'Barber unavailable'}</p>}
          </div>
          <Track><PillLink size="sm" href={`/dashboard/customers/${customer.id}`}>Edit profile</PillLink></Track>
        </div>
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <Track label={`Status for ${fullName(customer)}`} className="flex-nowrap">
            {(['active', 'vip', 'needs_attention', 'blocked'] as CustomerStatus[]).map((status) => <Pill key={status} size="sm" variant="flat" aria-pressed={customer.status === status} disabled={pending} onClick={() => updateStatus(status)} className="capitalize">{statusLabel(status)}</Pill>)}
          </Track>
        </div>
        <FeedbackMessage feedback={profileFeedback} />
      </div>

      <div className="grid min-w-0 gap-8 lg:grid-cols-2">
        <Section id={`visits-${customer.id}`} title="Recent visits" count={appointmentsAccess === 'granted' ? customer.appointments?.length ?? 0 : undefined} actions={appointmentsAccess === 'granted' ? <ViewAll href={listHref('appointments', customer.id)} label="All visits" /> : undefined}>
          {appointmentsAccess === 'restricted' && <Restricted>Visit history restricted for your role.</Restricted>}
          <ul>
            {(customer.appointments || []).map((appointment) => (
              <li key={appointment.id} className="border-b py-2.5 text-sm last:border-b-0">
                <div className="flex items-baseline justify-between gap-3"><strong className="min-w-0 truncate font-medium">{appointment.serviceTitleSnapshot || 'Service label not recorded'}</strong><span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{formatDay(appointment.startsAt, timeZone)}</span></div>
                <p className="text-xs text-muted-foreground">{appointment.barberNameSnapshot || 'Barber not recorded'} · {statusLabel(appointment.status)} · {statusLabel(appointment.paymentStatus)}</p>
                {appointment.transaction && (
                  <p className="mt-1 text-xs">
                    <span className="font-mono tabular-nums">{appointment.transaction.formattedTotal || formatMoney(appointment.transaction.total)}</span> {statusLabel(appointment.transaction.paymentMethod)} ·{' '}
                    <Link className="font-medium underline-offset-4 hover:underline" href={`/dashboard/checkout-transactions/${appointment.transaction.id}`}>Receipt</Link>
                  </p>
                )}
              </li>
            ))}
          </ul>
          {appointmentsAccess === 'granted' && paymentsAccess === 'restricted' && Boolean(customer.appointments?.length) && <p className="text-xs text-muted-foreground">Payment details restricted.</p>}
          {appointmentsAccess === 'granted' && !customer.appointments?.length && <Empty>No visits yet.</Empty>}
          {appointmentsAccess === 'granted' && (customer.appointments?.length || 0) >= limit && <p className="pt-2 font-mono text-xs text-muted-foreground">Latest {limit}</p>}
          {paymentsAccess === 'granted' && <p className="pt-2"><ViewAll href={listHref('checkout-transactions', customer.id)} label="All receipts" /></p>}
        </Section>

        <Section id={`balances-${customer.id}`} title="Memberships & packages" count={membershipsAccess === 'granted' ? customer.packageBalances?.length ?? 0 : undefined} actions={membershipsAccess === 'granted' ? <ViewAll href={listHref('customer-packages', customer.id)} label="All balances" /> : undefined}>
          <ul>
            {(customer.packageBalances || []).map((balance) => {
              const renewable = Boolean(balance.membershipPlan) && ['active', 'paused', 'expired', 'used_up'].includes(String(balance.status));
              return (
                <li key={balance.id} className="border-b py-2.5 text-sm last:border-b-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <strong className="min-w-0 truncate font-medium"><StatusDot tone={balance.status === 'active' ? 'live' : balance.status === 'paused' ? 'wait' : 'off'} />{balance.servicePackage?.name || balance.membershipPlan?.name || 'Balance'}</strong>
                    <span className="shrink-0 font-mono text-xs tabular-nums">{balance.remainingVisits ?? 0} left</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{statusLabel(balance.status)}{balance.expiresAt ? ` · ${balance.status === 'expired' ? 'expired' : 'expires'} ${formatDay(balance.expiresAt, timeZone)}` : ''}</p>
                  {balance.membershipPlan && (renewable || ['active', 'paused'].includes(String(balance.status))) && (
                    <Track className="mt-2">
                      {renewable && paymentsAccess === 'granted' && <Pill size="sm" disabled={pending} onClick={() => runMembership('renew', balance.id)}>Renew · {formatMoney(balance.membershipPlan.price)} cash</Pill>}
                      {balance.status === 'active' && <Pill size="sm" disabled={pending} onClick={() => runMembership('pause', balance.id)}>Pause</Pill>}
                      {balance.status === 'paused' && <Pill size="sm" disabled={pending} onClick={() => runMembership('resume', balance.id)}>Resume</Pill>}
                      {['active', 'paused'].includes(String(balance.status)) && <Pill size="sm" variant="danger" disabled={pending} onClick={() => runMembership('cancel', balance.id)}>Cancel</Pill>}
                    </Track>
                  )}
                </li>
              );
            })}
          </ul>
          {membershipsAccess === 'restricted' && <Restricted>Membership details restricted for your role.</Restricted>}
          {membershipsAccess === 'granted' && !customer.packageBalances?.length && <Empty>No package or membership balance.</Empty>}
          {membershipsAccess === 'granted' && membershipPlans && (
            <div className="mt-4 space-y-3 rounded-2xl bg-muted/50 p-3 ring-1 ring-inset ring-black/5 dark:ring-white/5">
              <form action="/dashboard/platform/customers" className="flex items-end gap-2" role="search">
                {search && <input type="hidden" name="q" value={search} />}
                <input type="hidden" name="customer" value={customer.id} />
                <div className="grid min-w-0 flex-1 gap-1">
                  <Label htmlFor={`plan-search-${customer.id}`} className="text-xs text-muted-foreground">Find a plan or package</Label>
                  <Input id={`plan-search-${customer.id}`} name="plans" defaultValue={planSearch} placeholder="Plan name" />
                </div>
                <Track><Pill type="submit" size="sm">Find</Pill></Track>
              </form>
              {membershipPlans.length > 0 ? (
                <div className="grid gap-1">
                  <Label htmlFor={planId} className="text-xs text-muted-foreground">Membership</Label>
                  <div className="flex items-center gap-2">
                    <select id={planId} value={membershipPlanId} onChange={(event) => setMembershipPlanId(event.target.value)} className={`${selectClass} flex-1`}>
                      {membershipPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {formatMoney(plan.price)} / {statusLabel(plan.billingInterval)}</option>)}
                    </select>
                    <Track><Pill size="sm" variant="primary" disabled={pending || !membershipPlanId || paymentsAccess !== 'granted'} onClick={() => runMembership('purchase')}>Sell · cash</Pill></Track>
                  </div>
                </div>
              ) : <p className="text-xs text-muted-foreground">{planSearch ? `No active plans match “${planSearch}”.` : 'No active membership plans.'}</p>}
              {data.membershipPlansTruncated && <p className="text-xs text-muted-foreground">More plans match. Narrow the search.</p>}
              {servicePackages && servicePackages.length > 0 && (
                <div className="grid gap-1">
                  <Label htmlFor={packageSaleId} className="text-xs text-muted-foreground">Package</Label>
                  <div className="flex items-center gap-2">
                    <select id={packageSaleId} value={servicePackageId} onChange={(event) => setServicePackageId(event.target.value)} className={`${selectClass} flex-1`}>
                      {servicePackages.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name} · {pkg.visits} visit{pkg.visits === 1 ? '' : 's'} · {formatMoney(pkg.price)}</option>)}
                    </select>
                    <Track><Pill size="sm" variant="primary" disabled={pending || !servicePackageId || paymentsAccess !== 'granted'} onClick={() => runMembership('purchase_package')}>Sell · cash</Pill></Track>
                  </div>
                  {data.servicePackagesTruncated && <p className="text-xs text-muted-foreground">More packages match. Narrow the search.</p>}
                </div>
              )}
              {paymentsAccess !== 'granted' && <p className="text-xs text-muted-foreground"><StatusDot tone="off" />Selling needs payment access.</p>}
              <p className="text-xs text-muted-foreground">Cash only.</p>
            </div>
          )}
          <div className="mt-3"><FeedbackMessage feedback={membershipFeedback} /></div>
        </Section>
      </div>

      <div className="grid min-w-0 gap-8 lg:grid-cols-2">
        <Section id={`consent-${customer.id}`} title="Consent & waivers" actions={<ViewAll href={listHref('waiver-forms', customer.id)} label="All waivers" />}>
          <p className="text-sm"><StatusDot tone={customer.acceptsMarketing ? 'live' : 'off'} />{customer.acceptsMarketing ? `Marketing allowed via ${statusLabel(customer.preferredContactMethod)}` : 'No marketing'} <span className="text-xs text-muted-foreground">· staff-recorded</span></p>
          <Track className="mt-3" label="Record the customer's contact preference">
            <Pill size="sm" disabled={pending} onClick={() => saveConsent(true, 'sms')}>Prefers SMS</Pill>
            <Pill size="sm" disabled={pending} onClick={() => saveConsent(true, 'email')}>Prefers email</Pill>
            <Pill size="sm" disabled={pending} onClick={() => saveConsent(false, customer.preferredContactMethod || 'sms')}>Declines marketing</Pill>
          </Track>
          <ul className="mt-4">
            {(customer.waivers || []).map((waiver) => <li key={waiver.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b py-2 text-sm last:border-b-0"><span className="min-w-0 truncate"><StatusDot tone={waiverTone(waiver)} />{waiver.title} <span className="text-xs text-muted-foreground">{statusLabel(waiver.waiverType)}</span></span><span className="text-xs text-muted-foreground">{waiver.signedAt || waiver.status === 'signed' ? `signed${waiver.signedAt ? ` ${formatDay(waiver.signedAt, timeZone)}` : ''}` : ['draft', 'sent'].includes(waiver.status) ? 'awaiting signature' : statusLabel(waiver.status)}</span></li>)}
          </ul>
          {!customer.waivers?.length && <Empty>No waivers on record.</Empty>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor={waiverTitleId} className="text-xs text-muted-foreground">Waiver title</Label>
              <Input id={waiverTitleId} value={waiverTitle} maxLength={200} onChange={(event) => setWaiverTitle(event.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={waiverTypeId} className="text-xs text-muted-foreground">Waiver type</Label>
              <select id={waiverTypeId} value={waiverType} onChange={(event) => setWaiverType(event.target.value)} className={selectClass}>
                <option value="general">General</option>
                <option value="minor_consent">Minor consent</option>
                <option value="chemical_service">Chemical service</option>
                <option value="photo_release">Photo release</option>
              </select>
            </div>
          </div>
          <Track className="mt-3"><Pill size="sm" variant="primary" disabled={pending || !waiverTitle.trim()} onClick={issueWaiver}>Create waiver record</Pill></Track>
          <div className="mt-3"><FeedbackMessage feedback={consentFeedback} /></div>
        </Section>

        <Section id={`notes-${customer.id}`} title="Notes" count={notesAccess === 'granted' ? customer.notes?.length ?? 0 : undefined} actions={notesAccess === 'granted' ? <ViewAll href={listHref('customer-notes', customer.id)} label="All notes" /> : undefined}>
          {notesAccess === 'granted' && (
            <div className="mb-4 space-y-2">
              <div className="flex items-end gap-2">
                <div className="grid min-w-0 flex-1 gap-1">
                  <Label htmlFor={noteTypeId} className="text-xs text-muted-foreground">Type</Label>
                  <select id={noteTypeId} value={noteType} onChange={(event) => setNoteType(event.target.value)} className={selectClass}>
                    <option value="preference">Preference</option>
                    <option value="formula">Formula / cut detail</option>
                    <option value="service_issue">Service issue</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>
              <Label htmlFor={noteId} className="sr-only">Note</Label>
              <textarea id={noteId} value={noteBody} onChange={(event) => setNoteBody(event.target.value)} placeholder="Guard length, fade height, beard line…" className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm" />
              <Track><Pill size="sm" variant="primary" disabled={pending || !noteBody.trim()} onClick={addNote}>Add note</Pill></Track>
              <FeedbackMessage feedback={noteFeedback} />
            </div>
          )}
          <ul>
            {(customer.notes || []).map((note) => (
              <li key={note.id} className="border-b py-2.5 text-sm last:border-b-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2"><Tag>{statusLabel(note.noteType)}</Tag><span className="font-mono text-xs tabular-nums text-muted-foreground">{formatDateTime(note.createdAt, timeZone)}</span></div>
                <p className="mt-1 whitespace-pre-wrap break-words">{note.body}</p>
                {note.appointment && <p className="mt-1 text-xs text-muted-foreground">{note.appointment.serviceTitleSnapshot || 'Appointment'} · {formatDateTime(note.appointment.startsAt, timeZone)}</p>}
              </li>
            ))}
          </ul>
          {notesAccess === 'restricted'
            ? <Restricted>Notes restricted for your role.</Restricted>
            : !customer.notes?.length && <Empty>No notes yet.</Empty>}
          {notesAccess === 'granted' && (customer.notes?.length || 0) >= limit && <p className="pt-2 font-mono text-xs text-muted-foreground">Latest {limit}</p>}
        </Section>
      </div>
    </div>
  );
}
