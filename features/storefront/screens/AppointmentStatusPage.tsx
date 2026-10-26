import Link from 'next/link';
import { phoneHref } from '@/features/shared/storefront-settings';
import { AppointmentSelfService, AppointmentWaiver } from '../components/AppointmentSelfService';
import { getPublicAppointment, type PublicAppointmentCustomer } from '../lib/data/public-appointments';
import { getPublicStorefrontSettings } from '../lib/data/settings';
import { getStorefrontAccount, getStorefrontBookingHistory, type AccountBooking } from '../lib/data/account';
import { confirmDeposit, getOnlineDepositsEnabled } from '../lib/data/deposits';
import { PayDepositButton } from '../components/PayDepositButton';
import { formatShopDateTime } from '../../shared/shop-time';
import { formatMoney, paymentLabel, statusLabel } from '../lib/format';
import { StorefrontShell } from './StorefrontShell';

function customerName(customer?: PublicAppointmentCustomer | null) {
  return [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') || 'Customer';
}

function statusStep(status?: string | null) {
  const order = ['requested', 'confirmed', 'checked_in', 'in_chair', 'completed'];
  return Math.max(0, order.indexOf(status || 'requested'));
}

const progressLabels = ['Requested', 'Confirmed', 'Checked in', 'In chair', 'Complete'];

const terminalStatuses = ['cancelled', 'no_show'];

const statusTone: Record<string, string> = { requested: 'is-wait', confirmed: 'is-accent', checked_in: 'is-live', in_chair: 'is-live', completed: '', cancelled: 'is-alert', no_show: 'is-alert' };

function isTerminal(status?: string | null) {
  return terminalStatuses.includes(status || '');
}

export default async function AppointmentStatusPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = searchParams ? await searchParams : {};
  const appointmentId = typeof params.id === 'string' ? params.id : '';
  // Back from Stripe: record the deposit before showing the visit.
  const depositReturn = params.deposit === 'return' && appointmentId ? await confirmDeposit(appointmentId) : null;
  const [lookup, settings, onlineDeposits] = await Promise.all([
    appointmentId ? getPublicAppointment(appointmentId) : Promise.resolve(null),
    getPublicStorefrontSettings(),
    getOnlineDepositsEnabled(),
  ]);
  const appointment = lookup?.status === 'found' ? lookup.appointment : null;
  const depositDue = Boolean(appointment && appointment.paymentStatus === 'deposit_due' && onlineDeposits && !isTerminal(appointment.status));
  // Signed-in customers get their own visits instead of a sign-in prompt.
  const account = !appointment && lookup?.status !== 'unavailable' ? await getStorefrontAccount() : null;
  const history = account ? await getStorefrontBookingHistory(1) : null;
  const accountBookings: AccountBooking[] | null = history?.success && history.data.accountBookings.success ? history.data.accountBookings.data?.bookings || [] : null;
  const receiptLine = appointment?.lineItems?.[0];
  // Times are shown in the timezone the booking was made in.
  const timeZone = appointment?.bookingTimezone || settings?.timezone || null;
  const transaction = appointment?.transaction;

  const step = statusStep(appointment?.status);
  const telephoneHref = phoneHref(settings?.phone);
  const paymentLine = transaction
    ? transaction.status === 'paid' || transaction.status === 'partially_refunded' || transaction.status === 'refunded'
      ? `Paid${transaction.paymentMethod ? ` by ${statusLabel(transaction.paymentMethod)}` : ''}${transaction.completedAt ? ` · ${timeZone ? formatShopDateTime(transaction.completedAt, timeZone) : transaction.completedAt}` : ''}`
      : transaction.status === 'voided' ? 'Payment voided' : 'Payment not completed'
    : appointment?.paymentStatus === 'deposit_due'
      ? `Deposit due: ${formatMoney(appointment.depositAmount)}`
      : appointment?.paymentStatus === 'deposit_paid'
        ? `Deposit paid: ${formatMoney(appointment.depositAmount)}`
        : 'Pay in the shop';

  return (
    <StorefrontShell allowUnavailableChildren>
      <main id="main-content" className="sf-container pb-[var(--space-3xl)]">
        {!appointment ? (
          <>
            <section className="sf-page-head">
              <h1 className="sf-display">{lookup?.status === 'unavailable' ? 'Status couldn’t load' : account && !appointmentId ? 'Your visits' : appointmentId ? 'Not found here' : 'Find your visit'}</h1>
            </section>
            <div className="sf-container-narrow !mx-0 grid gap-5 pt-8" role={lookup?.status === 'unavailable' ? 'alert' : undefined}>
              {account ? (
                accountBookings === null ? <p role="alert" className="sf-notice is-error">Your visits couldn’t load. Reload this page in a moment.</p>
                  : !accountBookings.length ? <p className="sf-lead">No bookings yet</p>
                  : (
                    <ul aria-label="Your visits">
                      {accountBookings.map((booking) => (
                        <li key={booking.id}>
                          <Link href={`/appointment?id=${encodeURIComponent(booking.id)}`} className="sf-booking-row">
                            <span className="grid min-w-0 gap-1">
                              <span className="sf-subtitle text-[1.35rem]"><span className={`sf-dot ${statusTone[booking.status] ?? ''}`} aria-hidden="true" />{booking.serviceTitleSnapshot}</span>
                              <span className="sf-small sf-muted break-words">{booking.timeZone ? formatShopDateTime(booking.startsAt, booking.timeZone) : booking.startsAt} · {booking.barberNameSnapshot}</span>
                            </span>
                            <span className="sf-small sf-muted capitalize">{statusLabel(booking.status)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )
              ) : (
                <p className="sf-lead">
                  {lookup?.status === 'unavailable'
                    ? 'Your booking hasn’t changed. Reload in a moment.'
                    : 'Open the link from the browser you booked in, or sign in to the account you booked with.'}
                </p>
              )}
              <div className="sf-actions">
                {account
                  ? <><Link href="/book" className="sf-btn is-primary">Book a time</Link><Link href="/account" className="sf-btn">All visits</Link></>
                  : <Link href="/account" className="sf-btn is-primary">Sign in</Link>}
                {telephoneHref && settings?.phone ? <a href={`tel:${telephoneHref}`} className="sf-btn">Call {settings.phone}</a> : null}
              </div>
            </div>
          </>
        ) : (
          <>
            <section className="sf-page-head">
              <h1 className="sf-display">{receiptLine?.title || appointment.service?.name}</h1>
              <p className="sf-lead"><span className={`sf-dot ${statusTone[appointment.status || ''] ?? ''}`} aria-hidden="true" />For {customerName(appointment.customer)}</p>
            </section>

            <div className="grid gap-8 pt-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-12">
              <section className="sf-card-dark sf-on-dark content-start" aria-label="Appointment">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="sf-subtitle capitalize">{statusLabel(appointment.status)}</p>
                  <span className="sf-tag">{paymentLabel(appointment.paymentStatus)}</span>
                </div>
                {isTerminal(appointment.status) ? (
                  <p className="sf-notice is-error">{appointment.status === 'cancelled' ? 'Visit cancelled' : 'Marked no-show'}</p>
                ) : (
                  <ol className="sf-progress" aria-label="Visit progress">
                    {progressLabels.map((label, index) => <li key={label} className={index <= step ? 'is-done' : undefined} aria-current={index === step ? 'step' : undefined}>{label}</li>)}
                  </ol>
                )}
                <dl className="sf-ledger">
                  <div><dt>When</dt><dd className="sf-mono">{appointment.startsAt ? (timeZone ? `${formatShopDateTime(appointment.startsAt, timeZone)} (${timeZone})` : appointment.startsAt) : 'To be confirmed'}</dd></div>
                  <div><dt>Barber</dt><dd>{appointment.barber?.displayName || 'To be assigned'}{appointment.barber?.chairNumber ? ` · Chair ${appointment.barber.chairNumber}` : ''}</dd></div>
                  <div><dt>Time in chair</dt><dd className="sf-mono">{receiptLine?.durationMinutes || appointment.durationMinutes ? `${receiptLine?.durationMinutes || appointment.durationMinutes} min` : '—'}</dd></div>
                  <div><dt>Price</dt><dd className="sf-mono">{formatMoney(receiptLine?.price ?? appointment.price)}</dd></div>
                </dl>
                <div className="sf-actions">
                  <Link href={`/book?service=${encodeURIComponent(appointment.service?.id || '')}&barber=${encodeURIComponent(appointment.barber?.id || '')}`} className="sf-btn is-primary">Rebook this visit</Link>
                  <Link href="/services" className="sf-btn">Services</Link>
                </div>
              </section>

              <aside className="grid content-start gap-0">
                <section className="sf-block border-t-0 pt-0" aria-labelledby="payment-heading">
                  <h2 id="payment-heading" className="sf-subtitle">Payment</h2>
                  {transaction ? <p className="sf-title">{transaction.formattedTotal || formatMoney(transaction.total)}</p> : null}
                  <p className="sf-small">{paymentLine}</p>
                  {depositReturn === true ? <p role="status" className="sf-notice">Deposit received</p> : null}
                  {params.deposit === 'cancelled' && depositDue ? <p role="status" className="sf-notice">Deposit not paid</p> : null}
                  {depositDue ? <PayDepositButton appointmentId={appointment.id} label={`Pay ${formatMoney(appointment.depositAmount)} deposit`} /> : null}
                  {transaction && (transaction.status === 'refunded' || transaction.status === 'partially_refunded') ? (
                    <p className="sf-small sf-muted">
                      {transaction.formattedRefundedAmount
                        ? `Refunded ${transaction.formattedRefundedAmount}${transaction.refundedAt ? ` · ${timeZone ? formatShopDateTime(transaction.refundedAt, timeZone) : transaction.refundedAt}` : ''}`
                        : 'Marked refunded. Contact the shop for details.'}
                    </p>
                  ) : null}
                </section>

                {/* A required waiver can still be signed after check-in; changes cannot. */}
                {['requested', 'confirmed', 'checked_in'].includes(appointment.status || '') && appointment.waiverRequired === true && (
                  <AppointmentWaiver
                    appointmentId={appointment.id}
                    customerName={customerName(appointment.customer)}
                    waiverSigned={appointment.waiverSigned === true}
                    waiverTemplateKey={appointment.waiverTemplateKey}
                    waiverTemplateVersion={appointment.waiverTemplateVersion}
                    waiverTemplateText={appointment.waiverTemplateText}
                  />
                )}
                {timeZone && ['requested', 'confirmed'].includes(appointment.status || '') && (
                  <AppointmentSelfService timeZone={timeZone} appointmentId={appointment.id} />
                )}

                {appointment.customer?.packageBalances?.length ? (
                  <section className="sf-block" aria-labelledby="balances-heading">
                    <h2 id="balances-heading" className="sf-subtitle">Packages & memberships</h2>
                    <dl className="sf-ledger">
                      {appointment.customer.packageBalances.map((balance) => (
                        <div key={balance.id}><dt>{balance.servicePackageName || balance.membershipPlanName || 'Balance'}</dt><dd>{balance.remainingVisits} visits left · {statusLabel(balance.status)}</dd></div>
                      ))}
                    </dl>
                  </section>
                ) : null}
              </aside>
            </div>
          </>
        )}
      </main>
    </StorefrontShell>
  );
}
