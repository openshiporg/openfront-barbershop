import Link from 'next/link';
import { StorefrontShell } from './StorefrontShell';
import { AccountForms } from '../components/AccountForms';
import { AccountDataExport } from '../components/AccountDataExport';
import { getStorefrontAccountState, getStorefrontBookingHistory, signOutAccount } from '../lib/data/account';
import { getPublicStorefrontSettings } from '../lib/data/settings';
import { formatMoney, statusLabel } from '../lib/format';

function bookingTime(startsAt: string, timeZone: string | null) {
  return new Date(startsAt).toLocaleString('en-US', { ...(timeZone ? { timeZone } : {}), dateStyle: 'medium', timeStyle: 'short' }) + (timeZone ? ` (${timeZone})` : '');
}

export default async function AccountPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams || {};
  const page = Math.max(1, Math.floor(Number(typeof params.page === 'string' ? params.page : 1)) || 1);
  const [account, settings] = await Promise.all([getStorefrontAccountState(), getPublicStorefrontSettings()]);
  const user = account.status === 'signed_in' ? account.user : null;
  const history = user ? await getStorefrontBookingHistory(page) : null;
  const result = history?.success ? history.data.accountBookings : null;
  const data = result?.success ? result.data : null;
  // Existing bookings stay reachable even if the public storefront is paused.
  return <StorefrontShell allowUnavailableChildren><main id="main-content" className="sf-container py-10">
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4"><h1 className="sf-display text-4xl">{user ? 'Your bookings' : 'Account'}</h1>{user ? <form action={signOutAccount}><button className="sf-btn sf-btn-ghost">Sign out</button></form> : null}</div>
    {account.status === 'unavailable' ? <p role="alert" className="sf-panel p-5">Your account couldn’t load. Reload this page in a moment.</p> : !user ? <AccountForms /> : <>
      <p className="mb-6 break-words">{user.name} · {user.email}</p>
      {!data ? <p role="alert">{history?.success ? result?.error || 'Your bookings couldn’t load.' : 'Your bookings couldn’t load. Reload this page in a moment.'}</p> : <div className="space-y-4">
        {data.bookings.map(booking => <Link key={booking.id} href={`/appointment?id=${encodeURIComponent(booking.id)}`} className="sf-panel flex flex-wrap items-center justify-between gap-4 p-5 no-underline hover:border-[var(--color-ink-muted)]">
          <div className="min-w-0"><h2 className="font-semibold break-words">{booking.serviceTitleSnapshot}</h2><p>{bookingTime(booking.startsAt, booking.timeZone)}</p><p className="break-words">{booking.barberNameSnapshot}</p></div>
          <div><p className="capitalize">{statusLabel(booking.status)}</p><p>{formatMoney(booking.price)}</p><p className="capitalize">{statusLabel(booking.paymentStatus)}</p><p className="sf-link mt-1 text-[var(--text-small)]">View or change</p></div>
        </Link>)}
        {!data.bookings.length ? <p>{page > 1 ? 'No more bookings.' : 'No bookings yet.'}</p> : null}
        {page > 1 || data.hasMore ? <nav aria-label="Booking pages" className="flex flex-wrap items-center gap-3">
          {page > 1 ? <Link className="sf-btn sf-btn-ghost" href={`/account?page=${page - 1}`}>Newer bookings</Link> : null}
          <span className="text-[var(--text-small)]">Page {page} of {Math.max(1, Math.ceil(data.total / data.pageSize))}</span>
          {data.hasMore ? <Link className="sf-btn sf-btn-ghost" href={`/account?page=${page + 1}`}>Older bookings</Link> : null}
        </nav> : null}
      </div>}
      <Link href="/book" className="sf-btn sf-btn-primary mt-6">Book a chair</Link>
      <section className="sf-panel mt-10 p-5" aria-labelledby="your-data-heading">
        <h2 id="your-data-heading" className="font-semibold">Your data</h2>
        <p className="mt-2 text-[var(--text-small)] text-[var(--color-ink-muted)]">Download your account details and bookings. To correct or delete your information, contact the shop{settings?.phone ? ` at ${settings.phone}` : ''}.</p>
        <div className="mt-4"><AccountDataExport /></div>
      </section>
    </>}
  </main></StorefrontShell>;
}
