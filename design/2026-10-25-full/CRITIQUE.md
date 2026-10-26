Method: dual-agent (A: design review subagent · B: detector subagent)

# Barbershop critique, before the 2026-10-25 full redesign

Evidence: live screenshots in `design/2026-10-25-full/before/` (desktop 1440, phone 390); source in `features/platform/**` and `features/storefront/**`.

## Scores (Nielsen, 0–4)
Platform 19/40: status 3 · real world 2 · control 2 · consistency 2 · error prevention 2 · recognition 2 · efficiency 1 · minimalist 2 · error recovery 1 · help 2.
Storefront 28/40: status 3 · real world 3 · control 3 · consistency 3 · error prevention 3 · recognition 3 · efficiency 2 · minimalist 3 · error recovery 3 · help 2.

## Design specificity
- Platform: generic. One kit (`features/platform/lib/ui.tsx`): status dot + title, 4-cell mono readout strip, raised pills in a recessed track (`Track` ui.tsx:44, `pillClass` :62, `Readouts` rounded-xl :82, `Tag` :121; `StatusTabs` pill track forms.tsx:106; `<Track>` used ~86 times). No chair view, no day timeline by barber, no "next up".
- Storefront: partly specific (menu board with leaders and mono prices, "The Chairs"), but the barber-pole stripe repeats as wallpaper, pills everywhere (`--radius-pill`), stock barber portraits reused as product photos, hero says nothing live (no wait time, who's in).

## Detector
- platform: clean. storefront: 1 `side-tab` at `features/storefront/styles/barbershop.css:166` (3px inset accent stripe on the selected option).
- Radius sweep: rounded-full 14 (6 banned: Track, pillClass, Tag, StatusTabs nav+links, settings preview chip), 2xl 10, xl 7, lg 5. Browser overlay skipped (no mutable browser automation).

## Priority issues: platform
- P0 Team, Inventory, Payroll return HTTP 500 live. Likely cause: `StatusTabs` (client, forms.tsx) receives a function prop `hrefFor` from server pages; the error wipes the shell.
- P1 pill system at the kit source (owner complaint); primary, filter, toggle, nav and destructive actions all share one pill shape inside one track.
- P1 Booking board is a status kanban with no time axis; needs barbers × time.
- P1 Staff is a form farm (open forms under every barber, 4 ambiguous pills, "Close shop" always open); needs a weekly roster table with row actions.
- P2 Shop operations (/barbershop) duplicates inventory/payroll/policies/waitlist; make it "today at the counter".
- P2 POS opens in an error state (default out-of-stock product, "Only 0 available."); open tickets should lead.
- P2 raw tech strings (`STRIPE_SECRET_KEY not set`, `pp_manual`, "America/New_York" everywhere), Policies date "Dec 31, 2019".

## Priority issues: storefront
- P1 home sells a generic dark barbershop; walk-in wait / chairs open now should lead; CTAs are 26px pills.
- P1 two of six services greyed "Call to book" with no reason (deposit services when online deposits are off).
- P2 37-slot time wall, no grouping or earliest; summary and submit at the very bottom on phone.
- P2 Shop page: one third-width card per row, product images are barber portraits.
- P2 pills/radius-lg across storefront; account pairs "Book a chair" with "Sign out" in one track.
- P3 barber detail h1 smaller than the bio; empty account without a way forward.

## Per-route main task (first 10 seconds)
queue: who's next, waited how long, add walk-in (partial) · booking: today by barber and time, check in next (not served) · pos: take payment for the checked-in ticket (partial) · barbershop: today's attention items (not served) · services: change price/availability (mostly) · categories/new/detail: edit a record (adequate) · staff: who works this week, time off (not served) · staff/chairs: chair assignment (served) · staff/[id]: hours and services (adequate) · customers: find a customer, preferences before the cut (partial) · customers/new: quick add (served) · inventory: what's low (500) · suppliers: contact/log delivery (partial) · payroll: what I owe each barber (500) · payments: money in, card/deposit setup (partial) · policies: rules (served) · team: access and invites (500) · reports: last period by barber (partial) · store-settings: hours and info (served, long).

Questions skipped: the owner ordered the redesign directly with no approval stops; all P0–P2 issues are in scope.
