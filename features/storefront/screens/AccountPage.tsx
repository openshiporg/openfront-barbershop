import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { phoneHref } from '@/features/shared/storefront-settings';
import { StorefrontShell } from './StorefrontShell';
import { AccountForms } from '../components/AccountForms';
import { AccountDataExport } from '../components/AccountDataExport';
import { getStorefrontAccountState, getStorefrontBookingHistory, signOutAccount } from '../lib/data/account';
import { getPublicStorefrontSettings } from '../lib/data/settings';
import { getAccountBalances } from '../lib/data/offers';
import { formatMoney, paymentLabel, statusLabel } from '../lib/format';

function bookingTime(startsAt: string, timeZone: string | null) {
  return new Date(startsAt).toLocaleString('en-US', { ...(timeZone ? { timeZone } : {}), dateStyle: 'medium', timeStyle: 'short' }) + (timeZone ? ` (${timeZone})` : '');
}

const bookingTone: Record<string, string> = { requested: 'is-wait', confirmed: 'is-accent', checked_in: 'is-live', in_chair: 'is-live', completed: '', cancelled: 'is-alert', no_show: 'is-alert' };

export default async function AccountPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams || {};
  const page = Math.max(1, Math.floor(Number(typeof params.page === 'string' ? params.page : 1)) || 1);
  const [account, settings] = await Promise.all([getStorefrontAccountState(), getPublicStorefrontSettings()]);
  const user = account.status === 'signed_in' ? account.user : null;
  const [history, balances] = user ? await Promise.all([getStorefrontBookingHistory(page), getAccountBalances()]) : [null, null];
  const result = history?.success ? history.data.accountBookings : null;
  const data = result?.success ? result.data : null;
  const telephoneHref = phoneHref(settings?.phone);

  // Existing bookings stay reachable even if the public storefront is paused.
  return (
    <StorefrontShell allowUnavailableChildren>
      <main id="main-content" className={user ? 'sf-container pb-[var(--space-3xl)]' : 'sf-container-narrow pb-[var(--space-3xl)]'}>
        <section className="sf-page-head">
          <p className="sf-eyebrow">{user ? <span className="break-words">{user.name} · {user.email}</span> : 'Account'}</p>
          <div className="sf-page-head-row">
            <h1 className="sf-display">{user ? 'Your visits' : 'Sign in'}</h1>
            {user ? (
              <div className="sf-track">
                <Link href="/book" className="sf-pill is-primary">Book a chair</Link>
                <form action={signOutAccount} className="contents"><button className="sf-pill">Sign out</button></form>
              </div>
            ) : null}
          </div>
        </section>

        {account.status === 'unavailable' ? <p role="alert" className="sf-notice is-error mt-8">Your account couldn’t load. Reload this page in a moment.</p> : !user ? <div className="pt-8"><AccountForms /></div> : (
          <div className="grid gap-10 pt-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section aria-label="Bookings">
              {!data ? <p role="alert" className="sf-notice is-error">{history?.success ? result?.error || 'Your bookings couldn’t load.' : 'Your bookings couldn’t load. Reload this page in a moment.'}</p> : (
                <>
                  <ul>
                    {data.bookings.map(booking => (
                      <li key={booking.id}>
                        <Link href={`/appointment?id=${encodeURIComponent(booking.id)}`} className="sf-booking-row">
                          <span className="grid min-w-0 gap-1">
                            <span className="sf-subtitle text-[1.35rem]"><span className={`sf-dot ${bookingTone[booking.status] ?? ''}`} aria-hidden="true" />{booking.serviceTitleSnapshot}</span>
                            <span className="sf-small sf-muted break-words">{bookingTime(booking.startsAt, booking.timeZone)} · {booking.barberNameSnapshot}</span>
                          </span>
                          <span className="grid justify-items-end gap-1 text-end">
                            <span className="sf-mono font-semibold">{formatMoney(booking.price)}</span>
                            <span className="sf-small sf-muted"><span className="capitalize">{statusLabel(booking.status)}</span> · {paymentLabel(booking.paymentStatus)}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {!data.bookings.length ? <div className="sf-empty"><p className="sf-subtitle">{page > 1 ? 'No more bookings' : 'No bookings yet'}</p></div> : null}
                  {page > 1 || data.hasMore ? (
                    <nav aria-label="Booking pages" className="mt-6 flex flex-wrap items-center justify-between gap-3">
                      <div className="sf-track">
                        {page > 1 ? <Link className="sf-pill" href={`/account?page=${page - 1}`}>Newer</Link> : null}
                        {data.hasMore ? <Link className="sf-pill" href={`/account?page=${page + 1}`}>Older</Link> : null}
                      </div>
                      <span className="sf-mono sf-small sf-muted">Page {page} / {Math.max(1, Math.ceil(data.total / data.pageSize))}</span>
                    </nav>
                  ) : null}
                </>
              )}
            </section>
            <aside className="sf-block content-start lg:border-t-0 lg:pt-0" aria-labelledby="your-data-heading">
              <section aria-labelledby="balances-heading" className="grid gap-2">
                <h2 id="balances-heading" className="sf-eyebrow">Packages and memberships</h2>
                {balances === null ? <p role="alert" className="sf-small sf-muted">Balances couldn’t load.</p>
                  : !balances.length ? <p className="sf-small sf-muted">None yet · <Link className="sf-link" href="/memberships">See memberships</Link></p>
                  : (
                    <ul className="sf-ledger">
                      {balances.map((balance) => (
                        <li key={balance.id} className="flex justify-between gap-3">
                          <span><span className={`sf-dot ${balance.status === 'active' ? 'is-live' : 'is-wait'}`} aria-hidden="true" />{balance.name}{balance.status === 'paused' ? <span className="sf-muted"> · paused</span> : null}</span>
                          <span className="sf-mono">{balance.remainingVisits ?? 0} {balance.remainingVisits === 1 ? 'visit' : 'visits'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
              </section>
              <h2 id="your-data-heading" className="sf-eyebrow">Your data</h2>
              <AccountDataExport />
              <p className="sf-small sf-muted">Corrections or deletion: contact the shop{telephoneHref && settings?.phone ? <> at <a className="sf-link" href={`tel:${telephoneHref}`}>{settings.phone}</a></> : null}.</p>
              <Link href="/appointment" className="sf-arrow-link">Find an appointment <ArrowUpRight aria-hidden="true" /></Link>
            </aside>
          </div>
        )}
      </main>
    </StorefrontShell>
  );
}
