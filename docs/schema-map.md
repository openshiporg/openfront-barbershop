# Openfront Barbershop: schema map

This map comes from reading all 49 Keystone lists in `features/keystone/models/`, the custom GraphQL commands in `features/keystone/mutations/` (31 queries, 37 mutations), and the onboarding seed in `features/platform/onboarding/lib/seed.json`.

**Tenancy:** every merchant record belongs to one `Shop`. All reads and writes are scoped to the caller's *active shop* (`features/keystone/access.ts`). That shop comes from an active `ShopMembership`, and the membership role (owner / manager / front_desk / barber / viewer) narrows the caller's global `Role` flags.

**Records that change state through commands:** many state-bearing lists can't be created or updated through the generic CRUD API (`create/update: () => false`). They change only through custom commands that keep a ledger, record a lifecycle event in the outbox, and take an idempotency key.

## 1. Lists

Who creates it:
- **M** = merchant or staff in the dashboard
- **C** = customer on the storefront
- **S** = system, through a command or hook
- **O** = onboarding seed

### Shop and access

| List | Purpose | Key fields | Relationships | Created by | States / transitions |
|---|---|---|---|---|---|
| Shop | The business (tenant). | name, slug, timezone, currencyCode (USD), jurisdictionCode, hours (weekly JSON), brandColor, logoIcon/logoColor, isPublic, isDemo | Parent of every merchant list | O, M (setup) | status: active / paused / inactive. `isPublic` publishes the storefront; only one public shop. |
| ShopSettings | Legacy singleton for storefront settings. Superseded by Shop fields. | name, tagline, hours | none | O | none |
| ShopMembership | Staff access to a shop. | membershipRole, status, membershipKey | shop, user | M (owner/manager), S (setup, claim) | invited → active → suspended / revoked. Never deleted. Every shop keeps at least one active owner. Managers can only grant front_desk / barber / viewer. |
| User | Login for staff and customers. | name, email, password, onboardingStatus | role, shopMemberships, activeShop, barberProfile, customerProfile, bookings | C (sign-up), M (admin) | onboardingStatus: not_started → in_progress → completed / dismissed |
| Role | Global permission flags. | the can* flags | assignedTo users | M (admin) | none |

### Service menu

| List | Purpose | Key fields | Relationships | Created by | States / transitions |
|---|---|---|---|---|---|
| ServiceCategory | Menu sections. | name, description, displayOrder | services | M, O | active / hidden. Hidden categories drop off the storefront menu. |
| Service | A bookable service. | name, durationMinutes, price (cents), deposit (Required / Amount), credentialRequired, waiver template (key / version / text / hash), bookingBufferMinutes, imagePath, color | category, specialists (Barber[]), practitionerCredentials, appointments, packageItems | M, O | active / hidden / archived. Hooks check that the deposit is no more than the price, and check the waiver template hash. |
| ServicePackage | Prepaid bundle of visits. | name, price, description | items, customerBalances | M, O | active / hidden / archived |
| ServicePackageItem | Join row: a service × quantity inside a package. | quantity | package, service | M | none. Covered by its parent package. |
| MembershipPlan | Recurring membership. | price, billingInterval, includedVisits, discountPercent | members (CustomerPackage), events | M, O | active / paused / archived |

### Team and time

| List | Purpose | Key fields | Relationships | Created by | States / transitions |
|---|---|---|---|---|---|
| Barber | A practitioner. | displayName, bio, phone, email, chairNumber, bookingEnabled, bufferMinutes, serviceCommissionRateBps | chair, user (login link), specialties, schedules, scheduleExceptions, shifts, credentials, appointments, commissions | M, O | active / away / inactive. `bookingEnabled` controls online booking. |
| BarberChair | A station on the floor. | chairNumber (unique per shop), stationName, locationNote | assignedBarbers, appointments, shifts, scheduleExceptions | M, O | active / maintenance / reserved. Only active chairs take bookings. |
| BarberSchedule | Weekly working hours, one row per barber per weekday. | dayOfWeek, isWorking, startMinute / endMinute, breakStart / breakEnd | barber | M, O | none |
| ScheduleException | Time off, shop closure, chair outage, or extra working window. | exceptionType, startsAt / endsAt, reason | barber, chair | S (`manageScheduleException`) | active → cancelled |
| StaffShift | A dated shift. | scheduledStart / End, clockedInAt / OutAt | barber, chair | S (`manageStaffShift`) | scheduled → clocked_in → completed; or → cancelled |
| PractitionerCredential | A licence for one service, under one jurisdiction. | credentialType, credentialNumber, issuingAuthority, jurisdictionCode, evidenceHash, effectiveFrom / expiresAt, verifiedAt, supervisionRequired | barber, service, supervisor | M (create only), O | active ↔ suspended → revoked / expired, through `setPractitionerCredentialStatus`. Records are immutable apart from status. Enforced only for services with `credentialRequired`. |

### Bookings

| List | Purpose | Key fields | Relationships | Created by | States / transitions |
|---|---|---|---|---|---|
| BookingPolicy | Versioned rules for cancelling and rescheduling. | version, cancellationWindowMinutes, rescheduleWindowMinutes, fees, depositCancellationRule, publicServiceEligibility, maxCustomerReschedules, effectiveFrom / Until | none | M, O | active → retired. Never deleted. Each booking snapshots the policy in force. |
| Appointment | A visit. | startsAt / endsAt, status, source, paymentStatus, price, depositAmount, snapshots (service, barber, policy, authority, waiver), notes | shop, customer, account (User), barber, chair, service, transaction, lineItems, changeEvents, noShowEvents, paymentSessions, packageUsages, queueEntry | C (`createOnlineBooking` / `createAccountBooking`), M (`createStaffAppointment`), S (seat walk-in) | requested → confirmed → checked_in → in_chair → completed (by paid checkout only). cancelled and no_show are terminal. Check-in and seat happen only on the visit's shop day. No-show is allowed only after start plus the grace period. |
| AppointmentChangeEvent | Ledger of cancellations and reschedules. | action, actorType, previous / next times, feeAmount, depositConsequence | appointment | S | none (append-only). Covered by the appointment detail. |
| AppointmentLineItem | What was performed and sold at checkout. | title, price, packageVisitsConsumed | appointment, transaction, service | S | none. Covered by the POS receipt. |
| NoShowPolicy | Fee and grace period for no-shows. | feeAmount, graceMinutes, appliesToMemberships | events | M, O | active / paused / archived |
| NoShowEvent | A recorded no-show. | feeAmount, feeWaived, graceMinutes | appointment, customer, policy | S (`markAppointmentNoShow`) | none. Covered by the appointment and customer pages. |
| WalkInQueueEntry | A walk-in. | customerName, phone, partySize, quotedWaitMinutes, checkedInAt, seatedAt | requestedService, requestedBarber, appointment, customer | C (`createPublicQueueEntry`), M (`createStaffQueueEntry`) | waiting → texted → in_chair (only through `seatWalkInQueueEntry`, which creates an appointment) → served, or → left. Waiting entries from earlier days close out as left. |
| WaitlistEntry | A request for a time that isn't open yet. | customerName, phone, preferredAt | customer, requestedService, requestedBarber | M (`manageWaitlist`) | waiting → notified → booked / expired |
| GuestBookingCommand | Idempotency record for guest bookings. | requestKey, payloadHash, receipt | appointment | S | none. System list, no page. |

### Customers

| List | Purpose | Key fields | Relationships | Created by | States / transitions |
|---|---|---|---|---|---|
| Customer | A client profile within one shop. | first / last name, phone, email, preferredContactMethod, acceptsMarketing, birthday, lastVisitAt | user (account), preferredBarber, appointments, notes, packageBalances, transactions | M, S (bookings and walk-ins) | active / vip / needs_attention / blocked, through `setCustomerStatus` |
| CustomerNote | A staff note about a client. | noteType, body, visibility (staff / owner) | customer, appointment, createdBy | S (`addCustomerNote`) | none (append-only) |
| GroomingNote | Cut formula, beard detail, allergies. | noteType, body, photoUrl, privateToStaff | customer, barber, appointment | O, S | none |
| WaiverForm | A consent document. | waiverType, template key / version / hash, signer, affirmation | customer, appointment, service | S (`issueCustomerWaiver`, `signPublicWaiver`) | draft → sent → signed / expired |
| CustomerPackage | A client's package or membership balance. | remainingVisits, start / expiry / next billing, autoRenew | customer, servicePackage or membershipPlan, usageLedger, membershipEvents | S (`manageMembership`: sell / renew / pause / resume / cancel) | active ↔ paused → used_up / expired / cancelled |
| PackageUsage | Ledger of package visits. | usageType, visitsDelta, balanceAfter | customerPackage, appointment, transaction | S | none. Covered by the customer balances view. |
| MembershipEvent | Ledger of membership sales and changes. | eventType, amount, visitsDelta | customer, plan, package, transaction | S | none. Covered by the customer page. |

### Money

| List | Purpose | Key fields | Relationships | Created by | States / transitions |
|---|---|---|---|---|---|
| CheckoutTransaction | A receipt. | subtotal, tip, tax, discount, total, paymentMethod (cash / card / package / gift_card / other), completedAt | appointments, lineItems, productLines, paymentSession, cashRefund, packageBalance | S (`checkoutAppointment`, `recordProductSale`) | open → paid → partially_refunded / refunded; or → voided |
| CashRefund | A cash refund on a receipt. | amount, tip / tax amounts, reason | transaction | S (`refundCashCheckout`) | none. Covered by POS receipts. |
| PaymentProvider | A payment adapter (`pp_manual` by default). | code, isInstalled, credentials, adapter function names | paymentSessions | M, S (`ensureDefaultPaymentProvider`) | installed / not installed |
| PaymentSession | A card or online payment intent. | status, amount, providerPaymentId, refundedAmount | appointment, transaction, provider, reconciliations | S (initiate / capture / refund / cancel commands) | pending → authorized → captured → partially_refunded / refunded; or → failed / expired / cancelled |
| PaymentReconciliation | A status check against the processor. | localStatusBefore / After, remoteStatus, changed | paymentSession | S (`reconcilePaymentSession`) | none. Covered by the Payments page. |
| PaymentWebhookEvent | Replay guard for webhooks. | providerCode, providerEventId | none | S | none. System list. |
| Tip | A tip for a barber. | amount, paymentMethod | barber, customer, transaction, appointment | S (checkout) | none |
| Commission | Barber earnings on a receipt. | serviceAmount, productAmount, commissionRate, commissionAmount | barber, transaction, appointment, payout | S (checkout) | projected → approved → paid; or → voided, through `transitionCommission` and `payApprovedCommissions` |
| CommissionPayout | A batch payment to one barber. | totalAmount, commissionCount, paidAt, notes | barber, commissions | S (`payApprovedCommissions`) | paid / voided |

### Retail

| List | Purpose | Key fields | Relationships | Created by | States / transitions |
|---|---|---|---|---|---|
| Product | A retail item. | name, sku (unique per shop), productType, price, cost, inventoryTracked, description | inventoryLots, inventoryMovements, saleLines | M, O | active / draft / archived |
| Supplier | A vendor. | contactName, email, phone, website, notes | inventoryLots | M, O | active / paused / archived |
| InventoryLot | A received delivery. | lotNumber, quantityReceived / Remaining, unitCost, receivedAt, expiresAt | product, supplier, movements | S (`receiveInventoryLot`) | active → consumed / expired |
| InventoryMovement | Stock ledger. | movementType (receive / sale / return / waste / adjustment), quantityDelta, quantityAfter, reason | product, inventoryLot, productSaleLine | S (`receiveInventoryLot`, `recordInventoryMovement`, retail sale and return) | none (append-only). Covered by the product detail. |
| ProductSaleLine | A retail sale or return line. | quantity, unitPrice, totals, returnedQuantity | transaction, product, inventoryMovement, originalLine / returnLines | S (`recordProductSale`, `returnProductSaleLine`) | sale / return |

### System

| List | Purpose | Key fields | Relationships | Created by | States / transitions |
|---|---|---|---|---|---|
| LifecycleOutboxEvent | Domain event outbox and audit trail. | eventType, aggregate, payload, status, attempts | shop | S | pending → processing → delivered / dead_letter. System list, read-only. |

## 2. Merchant workflows

| # | Workflow | Lists touched |
|---|---|---|
| W1 | **Set up the shop:** identity, hours, publish | Shop, ShopSettings, ShopMembership, User |
| W2 | **Build the menu:** categories → services (price, time, deposit, barbers, licence, waiver) → hide / archive | ServiceCategory, Service, Barber.specialties |
| W3 | **Sell prepaid:** packages and memberships → sell, renew, pause, cancel on a client | ServicePackage, ServicePackageItem, MembershipPlan, CustomerPackage, MembershipEvent, PackageUsage |
| W4 | **Staff the floor:** barbers → chairs → weekly hours → shifts and time off → shop closures | Barber, BarberChair, BarberSchedule, StaffShift, ScheduleException |
| W5 | **Licensing:** add credentials per barber and service → suspend, revoke, reinstate | PractitionerCredential, Service.credentialRequired |
| W6 | **Team access:** invite staff → set role → suspend or revoke | ShopMembership, User, Barber.user |
| W7 | **Set the rules:** booking policy versions and no-show policy | BookingPolicy, NoShowPolicy |
| W8 | **Run the day:** bookings → confirm → check in → seat → (no-show) | Appointment, AppointmentChangeEvent, NoShowEvent, Customer |
| W9 | **Walk-ins and waitlist:** join → text → seat → serve or left; waitlist → book | WalkInQueueEntry, WaitlistEntry, Appointment |
| W10 | **Take payment:** checkout (cash, card terminal, package) → tip → receipt → refund or return | CheckoutTransaction, AppointmentLineItem, Tip, CashRefund, PaymentSession, PackageUsage, ProductSaleLine |
| W11 | **Payment setup:** providers and processor checks | PaymentProvider, PaymentSession, PaymentReconciliation |
| W12 | **Pay barbers:** commissions → approve or void → pay out per barber → payout history | Commission, CommissionPayout, Tip |
| W13 | **Retail stock:** products → suppliers → receive delivery → adjust / waste → sell | Product, Supplier, InventoryLot, InventoryMovement, ProductSaleLine |
| W14 | **Know the client:** profile, history, notes, waivers, consent, status | Customer, CustomerNote, GroomingNote, WaiverForm, Appointment |
| W15 | **Measure:** money, chairs, performance | CheckoutTransaction, Appointment, WalkInQueueEntry, Commission, CustomerPackage |

## 3. Coverage, before this pass

**MISSING** means there is no platform page. **THIN** means a page shows the records but sends the real job to the generic model form or can't do it at all.

| Workflow / list | Platform page (route · slice) | Before |
|---|---|---|
| W1 Shop, hours, publish | `/platform/store-settings` · store-settings | OK |
| W1 Unclaimed shop access | `/platform/*` gate · barbershop (ShopAccessPanel) | OK |
| W2 ServiceCategory | `/platform/services` · services. Create, edit and hide go to the model form. | **THIN** |
| W2 Service | `/platform/services` + `/services/new` · services, records. Edit goes to the model form (prices in cents). | **THIN** |
| W3 ServicePackage / MembershipPlan | `/platform/services` · services. Create and edit go to the model form; package items can't be edited. | **THIN** |
| W3 Sell / renew / pause a balance | `/platform/customers` · customers | OK |
| W4 Barber | `/platform/staff` + `/staff/new` · staff. Profile edit goes to the model form. | **THIN** |
| W4 BarberSchedule (weekly hours) | `/platform/staff` · staff. Shown as a grid only; "+ Hours" goes to the model form. | **THIN** |
| W4 BarberChair | `/platform/barbershop` · barbershop. List only; create and edit go to the model form. | **THIN** |
| W4 StaffShift / ScheduleException | `/platform/staff` · staff (WorkforceControls) | OK |
| W5 PractitionerCredential | none. Only the model list `/dashboard/practitioner-credentials`. | **MISSING** |
| W6 ShopMembership (team access) | `/platform/staff` links a barber to a login only. No invite, role or revoke. | **MISSING** |
| W7 BookingPolicy | none. Linked to the model list. | **MISSING** |
| W7 NoShowPolicy | `/platform/barbershop` · barbershop. List only; create goes to the model form. | **THIN** |
| W8 Appointment | `/platform/booking` · booking | OK |
| W9 WalkInQueueEntry | `/platform/queue` · queue | OK |
| W9 WaitlistEntry | `/platform/barbershop` · barbershop (WaitlistControls) | OK |
| W10 Checkout / receipts / refunds / returns | `/platform/pos` · pos | OK |
| W11 PaymentProvider / PaymentSession / Reconciliation | `/platform/barbershop` shows open sessions only. No provider page. | **MISSING** |
| W12 Commission / CommissionPayout / Tip | `/platform/barbershop` · barbershop. Short lists with approve and pay per row. No status tabs, no per-barber payout, no history. | **THIN** |
| W13 Product | `/platform/services` (list) + `/services/new-product`. No stock view; edit goes to the model form. | **THIN** |
| W13 Supplier | `/platform/barbershop`. List only; create and edit go to the model form. | **THIN** |
| W13 InventoryLot / InventoryMovement | `/platform/barbershop` (receive delivery). No ledger, adjust or waste. | **THIN** |
| W14 Customer / notes / waivers / consent | `/platform/customers` · customers | OK |
| W15 Reports | `/platform/reports` · reports | OK |
| System: GuestBookingCommand, PaymentWebhookEvent, LifecycleOutboxEvent | No page needed: these are system ledgers. | n/a |
| Join and ledger lists: ServicePackageItem, AppointmentLineItem, AppointmentChangeEvent, NoShowEvent, PackageUsage, MembershipEvent, CashRefund, ProductSaleLine | Covered by their parent pages: package, POS receipt, appointment, customer, product | n/a |

### Storefront, before this pass

| Customer workflow | Flow | Before |
|---|---|---|
| Book a service | `/services` → `/services/[id]` → `/book` → confirmation → `/appointment` → `/account` | OK |
| Walk in | `/queue` → ticket | OK |
| Choose a barber | `/barbers`. No barber detail page. | **THIN** |
| Retail products | none. `getPublicProducts` exists but has no page. | **MISSING** |
| Packages and memberships | none | **MISSING** |
| Account balances | `/account` shows visits only, not package or membership balances | **THIN** |


## 4. Coverage after this pass

| Workflow / list | Platform page (route · slice) | After |
|---|---|---|
| W1 Shop, hours, publish | `/platform/store-settings` · store-settings (hours editor, timezone picker) | OK |
| W2 ServiceCategory | `/platform/services/categories` · services: create, edit, order, show/hide | OK |
| W2 Service | `/platform/services/new`, `/platform/services/[id]` · records: dollars, deposit, barbers, licensed flag, status | OK |
| W3 ServicePackage (+ items) / MembershipPlan | `/platform/services/packages/new\|[id]`, `/platform/services/plans/new\|[id]` · records | OK |
| W4 Barber | `/platform/staff/[id]` · staff: profile edit, services, chair, commission, recent visits | OK |
| W4 BarberSchedule | `/platform/staff/[id]` (weekly hours editor) | OK |
| W4 BarberChair | `/platform/staff/chairs` · staff: create, edit, in service / maintenance / reserved | OK |
| W4 StaffShift / ScheduleException | `/platform/staff` and `/platform/staff/[id]` (WorkforceControls) | OK |
| W5 PractitionerCredential | `/platform/staff/[id]`: add, suspend / expire / revoke | OK |
| W6 ShopMembership | `/platform/team` · team: add an existing account by email, role, suspend / restore / remove | OK |
| W7 BookingPolicy | `/platform/policies` · policies: policy in force, publish a new version (no gap), version history, retire | OK |
| W7 NoShowPolicy | `/platform/policies`: create, edit, use / pause / archive | OK |
| W8–W10, W14, W15 | booking, queue, pos, customers, reports (unchanged) | OK |
| W11 PaymentProvider / PaymentSession / Reconciliation | `/platform/payments` · payments: methods (set up, on/off), takings by tender, receipts, open card payments, processor checks | OK. Online card processing is not connected (no processor adapter). |
| W12 Commission / CommissionPayout / Tip | `/platform/payroll` · payroll: status tabs, barber filter, bulk approve / void, pay per barber, payouts, tips by barber | OK |
| W13 Product | `/platform/inventory`, `/platform/inventory/[id]` · inventory: stock on hand, low-stock tab, search, margin; edit at `/platform/services/products/[id]` | OK |
| W13 Supplier | `/platform/inventory/suppliers` · inventory: create, edit, use / pause / archive | OK |
| W13 InventoryLot / InventoryMovement | `/platform/inventory/[id]`: receive delivery, waste, count correction, lots, stock ledger | OK |

### Storefront, after

| Customer workflow | Flow | After |
|---|---|---|
| Book a service | unchanged | OK |
| Walk in | `/queue` (closed state when nobody is on the floor) | OK |
| Choose a barber | `/barbers` → `/barbers/[id]` (bio, weekly hours, services) → `/book?barber=` | OK |
| Retail products | `/shop` → `/shop/[id]`. Bought at the counter: there is no online checkout, because online payment is not connected. | OK (no online purchase) |
| Packages and memberships | `/memberships` (plans and packages, bought in the shop) | OK (no online purchase) |
| Account balances | `/account`: package and membership balances next to visits | OK |
