import Link from 'next/link';
import { StorefrontImage } from '../components/StorefrontImage';
import { AppointmentSelfService, AppointmentWaiver } from '../components/AppointmentSelfService';
import { getPublicAppointment, type PublicAppointmentCustomer } from '../lib/data/public-appointments';
import { getPublicStorefrontSettings } from '../lib/data/settings';
import { formatShopDateTime } from '../../shared/shop-time';
import { formatMoney, statusLabel } from '../lib/format';
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
  const [lookup, settings] = await Promise.all([
    appointmentId ? getPublicAppointment(appointmentId) : Promise.resolve(null),
    getPublicStorefrontSettings(),
  ]);
  const appointment = lookup?.status === 'found' ? lookup.appointment : null;
  const receiptLine = appointment?.lineItems?.[0];
  // Times are shown in the timezone the booking was made in.
  const timeZone = appointment?.bookingTimezone || settings?.timezone || null;
  const transaction = appointment?.transaction;

  return (
    <StorefrontShell allowUnavailableChildren>
      <main>
        <section className="border-b border-[var(--color-rule)]">
          <div className="sf-container py-[var(--space-3xl)]">
            <p className="sf-eyebrow">Appointment status</p>
            <h1 className="sf-display mt-3 text-[var(--text-display-s)]">Your appointment.</h1>

          </div>
        </section>

        {!appointment ? (
          <section className="sf-container-narrow py-[var(--space-3xl)]">
            <div className="border border-dashed border-[var(--color-rule-strong)] p-[var(--space-2xl)]" role={lookup?.status === 'unavailable' ? 'alert' : undefined}>
              {lookup?.status === 'unavailable' ? (
                <>
                  <h2 className="sf-display text-[var(--text-title)]">Appointment status couldn’t load</h2>
                  <p className="mt-3 text-[var(--color-ink-muted)]">Your booking hasn’t changed. Reload this page in a moment, or contact the shop.</p>
                </>
              ) : (
                <>
                  <h2 className="sf-display text-[var(--text-title)]">{appointmentId ? 'We couldn’t open this appointment' : 'Find your appointment'}</h2>
                  <p className="mt-3 text-[var(--color-ink-muted)]">
                    Open the status page from the browser you booked in, or sign in to the account you booked with to see your bookings.
                  </p>
                </>
              )}
              <div className="mt-[var(--space-xl)] flex flex-wrap gap-3">
                <Link href="/account" className="sf-btn sf-btn-primary">
                  Sign in to your account
                </Link>
                {settings?.phone ? <a href={`tel:${settings.phone.replace(/[^0-9+]/g, '')}`} className="sf-btn sf-btn-ghost">Call {settings.phone}</a> : null}
              </div>
            </div>
          </section>
        ) : (
          <div className="sf-container grid gap-[var(--space-xl)] py-[var(--space-2xl)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <section className="sf-panel-inverse overflow-hidden">
              <StorefrontImage
                src={appointment.barber?.imagePath || receiptLine?.imagePath || appointment.service?.imagePath}
                fallbackSrc="/images/barbershop/service-classic-cut.svg"
                alt={appointment.barber?.displayName ? `${appointment.barber.displayName} and ${appointment.service?.name || 'service'}` : `${appointment.service?.name || 'Appointment'} detail`}
                className="aspect-[16/7] border-b border-[color-mix(in_oklch,var(--color-inverse-ink)_12%,transparent)]"
                priority
                sizes="(max-width: 1024px) 100vw, 58vw"
              />
              <div className="p-[var(--space-xl)]">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="sf-eyebrow text-[var(--color-accent)]">{statusLabel(appointment.status)}</p>
                  <h2 className="sf-display mt-2 text-[var(--text-title)] text-[var(--color-inverse-ink)]">
                    {receiptLine?.title || appointment.service?.name}
                  </h2>
                  <p className="mt-2 text-[var(--text-small)] text-[var(--color-inverse-muted)]">
                    For {customerName(appointment.customer)}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center border border-[var(--color-accent)] px-3 py-1.5 text-[var(--text-caption)] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">
                  {statusLabel(appointment.paymentStatus)}
                </span>
              </div>

              <dl className="mt-[var(--space-xl)] grid gap-[var(--space-md)] sm:grid-cols-3">
                <div className="border border-[color-mix(in_oklch,var(--color-inverse-ink)_12%,transparent)] p-[var(--space-md)]">
                  <dt className="text-[var(--text-caption)] font-semibold uppercase tracking-[0.08em] text-[var(--color-inverse-muted)]">When</dt>
                  <dd className="mt-2 text-[var(--text-small)] text-[var(--color-inverse-ink)]">{appointment.startsAt ? (timeZone ? `${formatShopDateTime(appointment.startsAt, timeZone)} (${timeZone})` : appointment.startsAt) : 'Time to be confirmed'}</dd>
                </div>
                <div className="border border-[color-mix(in_oklch,var(--color-inverse-ink)_12%,transparent)] p-[var(--space-md)]">
                  <dt className="text-[var(--text-caption)] font-semibold uppercase tracking-[0.08em] text-[var(--color-inverse-muted)]">Barber</dt>
                  <dd className="mt-2 text-[var(--text-small)] text-[var(--color-inverse-ink)]">
                    {appointment.barber?.displayName || 'To be assigned'}
                    {appointment.barber?.chairNumber ? ` · Chair ${appointment.barber.chairNumber}` : ''}
                  </dd>
                </div>
                <div className="border border-[color-mix(in_oklch,var(--color-inverse-ink)_12%,transparent)] p-[var(--space-md)]">
                  <dt className="text-[var(--text-caption)] font-semibold uppercase tracking-[0.08em] text-[var(--color-inverse-muted)]">Service</dt>
                  <dd className="mt-2 text-[var(--text-small)] text-[var(--color-inverse-ink)]">
                    {receiptLine?.durationMinutes || appointment.durationMinutes ? `${receiptLine?.durationMinutes || appointment.durationMinutes} min · ` : ''}
                    {formatMoney(receiptLine?.price ?? appointment.price)}
                  </dd>
                </div>
              </dl>

              {isTerminal(appointment.status) ? (
                <div className="mt-[var(--space-xl)] border border-[var(--color-error)] p-[var(--space-md)]">
                  <p className="text-[var(--text-caption)] font-semibold uppercase tracking-[0.1em] text-[var(--color-error)]">
                    {appointment.status === 'cancelled' ? 'Visit cancelled' : 'Marked no-show'}
                  </p>
                  <p className="mt-2 text-[var(--text-small)] text-[var(--color-inverse-muted)]">
                    This appointment is no longer active.
                  </p>
                </div>
              ) : (
                <div className="mt-[var(--space-xl)]">
                  <p className="text-[var(--text-caption)] font-semibold uppercase tracking-[0.1em] text-[var(--color-inverse-muted)]">
                    Visit progress
                  </p>
                  <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {progressLabels.map((label, index) => (
                      <li
                        key={label}
                        className={`px-2 py-2 text-center text-[var(--text-caption)] font-semibold ${
                          index <= statusStep(appointment.status)
                            ? 'bg-[var(--color-accent)] text-[var(--color-ink)]'
                            : 'bg-[color-mix(in_oklch,var(--color-inverse-ink)_8%,transparent)] text-[var(--color-inverse-muted)]'
                        }`}
                      >
                        {label}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              </div>
            </section>

            <aside className="space-y-[var(--space-md)]">
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
              <div className="sf-panel p-[var(--space-lg)]">
                <h3 className="sf-eyebrow">Payment</h3>
                {transaction ? (
                  <div className="mt-[var(--space-md)]">
                    <p className="sf-display text-[1.75rem] tabular-nums">
                      {transaction.formattedTotal || formatMoney(transaction.total)}
                    </p>
                    <p className="mt-2 text-[var(--text-small)] text-[var(--color-ink-muted)]">
                      {transaction.status === 'paid' || transaction.status === 'partially_refunded' || transaction.status === 'refunded'
                        ? `Paid${transaction.paymentMethod ? ` by ${statusLabel(transaction.paymentMethod)}` : ''}${transaction.completedAt ? ` on ${timeZone ? formatShopDateTime(transaction.completedAt, timeZone) : transaction.completedAt}` : ''}`
                        : transaction.status === 'voided'
                          ? 'This payment was voided.'
                          : 'Payment not yet completed.'}
                    </p>
                    {transaction.status === 'refunded' || transaction.status === 'partially_refunded' ? (
                      <p className="mt-2 text-[var(--text-small)] text-[var(--color-ink-muted)]">
                        {transaction.formattedRefundedAmount
                          ? `Refunded ${transaction.formattedRefundedAmount}${transaction.refundedAt ? ` on ${timeZone ? formatShopDateTime(transaction.refundedAt, timeZone) : transaction.refundedAt}` : ''}.`
                          : 'Marked as refunded. Contact the shop for refund details.'}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-[var(--space-md)] text-[var(--text-small)] text-[var(--color-ink-muted)]">
                    {appointment.paymentStatus === 'deposit_due'
                      ? `Deposit due: ${formatMoney(appointment.depositAmount)}`
                      : appointment.paymentStatus === 'deposit_paid'
                        ? `Deposit paid: ${formatMoney(appointment.depositAmount)}`
                        : 'Pay in the shop after your visit.'}
                  </p>
                )}
              </div>

              {appointment.customer?.packageBalances?.length ? (
                <div className="sf-panel p-[var(--space-lg)]">
                  <h3 className="sf-eyebrow">Packages & memberships</h3>
                  <div className="mt-[var(--space-md)] space-y-3">
                    {appointment.customer.packageBalances.map((balance) => (
                      <div key={balance.id} className="border border-[var(--color-rule)] p-[var(--space-md)] text-[var(--text-small)]">
                        <strong>{balance.servicePackageName || balance.membershipPlanName || 'Balance'}</strong>
                        <p className="mt-1 text-[var(--color-ink-muted)]">
                          {balance.remainingVisits} visits left · {statusLabel(balance.status)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <Link
                  href={`/book?service=${encodeURIComponent(appointment.service?.id || '')}&barber=${encodeURIComponent(appointment.barber?.id || '')}`}
                  className="sf-btn sf-btn-primary w-full"
                >
                  Rebook this visit
                </Link>
                <Link href="/services" className="sf-btn sf-btn-ghost w-full">
                  Browse menu
                </Link>
              </div>
            </aside>
          </div>
        )}

        <section className="border-t border-[var(--color-rule)] bg-[var(--color-paper-2)]">
          <div className="sf-container-narrow py-[var(--space-lg)] text-center text-[var(--text-small)] text-[var(--color-ink-muted)]">
            {settings?.name}{settings?.phone ? ` · ${settings.phone}` : ''}
          </div>
        </section>
      </main>
    </StorefrontShell>
  );
}
