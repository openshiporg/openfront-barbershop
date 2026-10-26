# Barbershop (Stack & Fade): full redesign, platform and storefront (2026-10-25/26)

Brief: `Euler/state/briefs/batches-2-6-full-redesign-2026-10-25.md`. The owner ordered it with no approval round, so every impeccable decision point was taken unattended. That is recorded in `PRODUCT.md` and the surface briefs.

Live: https://openfront-barbershop-production.up.railway.app (barbershop.openship.org once DNS is in).

## What it is now
- **Platform: "the floor".**
  - Every operator screen opens on what is happening at the chairs and in the line right now: title, one truthful status and the primary action, then flat underline tabs with counts, then dense tables with dot-plus-word status.
  - Queue and Booking lead with a chair strip (who is in each chair and since when, or Free with the next booking), above a time-ordered line. Booking adds barber lanes with a now-line and day navigation.
  - Radii are explicit 6px and 4px, because the shared dashboard theme sets `--radius` to 10px.
- **Storefront: "Take a number".**
  - The shop's walk-in ticket dispenser: enamel-white ground, black sign bands, and ticket stock in the merchant's colour, with perforations and notches.
  - A "Now serving" board with seven-segment numerals (unlit segments drawn as ghosts) shows the real line and wait. When closed it lights the opening hour from posted hours. Beside it sit two tickets, Join the line and Book a time.
  - Prices sit on a fixed rail (name · duration · price). Booking slots are grouped by morning, afternoon and evening, with an earliest pick and a sticky ticket dock on phones.
  - Type is Big Shoulders and Public Sans; corners are square.
- **Shared dashboard shell:** byte-identical to E-commerce (parity drift 0).

## Bugs fixed on the way
- **Team, Inventory and Payroll returned HTTP 500 live.** `StatusTabs` lived in a `'use client'` module but took a function prop (`hrefFor`) from server pages. It is now in the server-safe `ui.tsx`.
- **POS opened in an error state** ("Only 0 available."), because an out-of-stock product was preselected. It now opens on open tickets with no preselection.
- **Policies showed "Dec 31, 2019"** for an unset effective date. It now reads "Since setup".
- **Barber detail h1s never got a font size.** `text-[var(--text-display-s)]` was parsed as a colour. They now use a real `.sf-h1` class.
- **Product images.** The bundled product drawings carry this demo shop's own label, so they are never matched by name: another merchant's "beard oil" must not borrow them. Products without their own image sit on the price rail.

## Process (impeccable first)
1. Before screenshots: live, desktop 1440 and phone 390 → `before/` (67 files).
2. impeccable `critique`: isolated subagents A (design review) and B (`detect` plus a radius sweep), synthesized in `CRITIQUE.md` and persisted. Platform scored 19/40, storefront 28/40.
3. impeccable `init`: `PRODUCT.md` inferred, with the inferences labelled.
4. Storefront direction: `concept-seed` (`seed:44ede35765a09f26`) assigned grounded candidate 5 of 7 (the take-a-number dispenser). The seven-segment challenger was competitive and kept for the board's numerals. The other challengers were declined, and each one's discipline was kept as a raise.
5. Platform direction: the owner's brief pins the structure. A surface roll (`seed:eb9e04e3b592d4cd`) was recorded at the reviewer's request, and what it dealt is noted in `.impeccable/surfaces/features-platform.md`.
6. Build: I rewrote the shared kit (`features/platform/lib/ui.tsx`, `forms.tsx`). Three parallel agents then rebuilt platform group A (queue, booking, POS, customers, payments), platform group B (shop operations, services, staff, inventory, payroll, policies, reports, team, settings, records) and the storefront.
7. impeccable finish review:
   - Round 1 asked for a recapture (lazy photos and a sticky dock in the full-page shots).
   - Round 2 found 7 material fixes, shipped in `2e13c24`.
   - The verdict pass scored 6 fixes resolved and 2 withdrawn as cited adaptations: onboarding files are off-limits by owner rule.
   - The last open item, the platform seed, now passes `--check-seed`.
8. impeccable documenter: `DESIGN.md` plus `.impeccable/design.json`, derived from the shipped CSS and components.

## Skills used, per screen, and what each changed

| Screen | Skills | What changed |
|---|---|---|
| Platform kit (`ui.tsx`, `forms.tsx`) | impeccable craft-floor and operate, minimalist-ui, emil-design-eng | Pill and recessed track became flat 6px buttons with an ink primary. `StatusTabs` became underline tabs and server-safe. Readouts became a one-line ledger. Added `DataTable`, `Td` and `StatusCell`. Small buttons are 36px on phones. Press scale 0.98. |
| Queue | impeccable operate, hallmark (states) | Chair strip, then one "Line" table: position, Next marker, waited plus quoted wait, status, row actions. One empty state. Search on Enter. |
| Booking | impeccable operate | A schedule instead of a status kanban: day navigation, chair strip, barber lanes with a now-line, underline status tabs, and a time-ordered table with Confirm, Check in, Seat and Checkout. |
| POS | impeccable operate, emil-design-eng | Open tickets first. Two flat tender buttons. Retail, returns and receipts sit under tabs. No preselected product. Clears the assistant button. |
| Customers | impeccable clarify | Find a customer first. Detail leads with preferences, notes and history; sell, waiver and note forms are folded behind buttons. |
| Payments | impeccable clarify | Money in first. "Card payments not connected" in plain words; raw configuration strings sit behind a disclosure. |
| Staff, chairs | impeccable operate, hallmark | Weekly roster table with one Schedule drawer per barber: one segmented choice and a submit button that names its action. "Close shop" sits behind a button. Actions stay in view at 1440. |
| Shop operations | impeccable distill | A "needs attention" table that links each item to its home page, replacing duplicated forms. |
| Services, categories, forms | impeccable operate, minimalist-ui | Dense services table. Package, plan and product as secondary actions. Square segmented status. |
| Inventory, suppliers, payroll, policies, reports, team, store settings | impeccable operate and craft-floor | Each opens on its task: needs reordering; receive delivery; owed by barber with Pay; rules with "Since setup"; by barber and by service; access and invite; square colour swatches and an honest Save. |
| Storefront home | impeccable new-work and mode-persuade, frontend-design (token plan), design-taste-frontend (design read, dials 6/4/5) | Sign band as the h1, the Now serving board and two tickets in the first viewport, a shop-floor photo band, the price rail, The Chairs (photo, chair plate, on-floor light). The barber-pole wallpaper is gone. |
| Book | hallmark (mobile, states), emil-design-eng (tear 260ms, dock 280ms) | Grouped slots with an earliest pick. Deposit services say they are booked by phone and give a call link. Sticky "Your ticket" dock on phone. |
| Walk-ins (/queue), ticket page | impeccable craft-floor (no eyebrows) | "Take a number" with the same board. Ticket in the merchant colour with notches; status sits in the details list, not above the numeral. |
| Shop, product | impeccable craft-floor (truth) | Products without their own image sit on the price rail, as one list when categories hold one item each. |
| Barbers, account, memberships, 404 | frontend-design, hallmark | h1 sized correctly, sign-plate buttons. The empty account offers both tickets; Sign out is quiet. |

## Checks (final state, `2e13c24`)
- `tsc --noEmit` through heavy-exec, non-incremental: exit 0, 0 errors.
- Unit tests: `barbershop-hours` 4/0, `family-security` 14/0, `shared-dashboard` 8/0 (pass/fail).
- `parity-check.py openfront-barbershop`: drift 0, missing 0, sidebar ok.
- `impeccable detect --json features/platform features/storefront`: `[]`.
- Live: all 68 route×viewport rows return 200 with overflowX 0 (`after/after-report.json`).

## Commits (master, auto-deployed)
- `691be74` Full redesign: barbershop platform as the floor, storefront as take-a-number
- `2e13c24` Barbershop finish-review fixes: products on the price rail, full-width chair strip, roster actions in view, no labels above headings

## Screenshots
- `before/`: 67 captures (Playwright Chromium, live). Team, Inventory and Payroll show the old 500s.
- `after/`: 81 captures (Playwright WebKit, live), covering every platform and storefront route at desktop and phone. Storefront phone pages also have `-viewport` shots that show the dock in place.

## Open items
- **Onboarding** (`OnboardingDialog.tsx` tracked-caps label, `OnboardingCards.tsx` 8px cards): untouched by owner rule.
- **Contract divergences, recorded as built in DESIGN.md:** the merchant colour preset key `amber` renders Cobalt. Time slots play the dock arrival, not the tear.
- **Queue data:** it carries no appointments, so a queue chair cell says "No walk-in seated" rather than claiming the chair is free.
