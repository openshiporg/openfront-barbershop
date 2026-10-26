# Product

<!-- impeccable:product-schema 1 -->

Inferred on 2026-10-25 from the repository and the owner's redesign brief (`Euler/state/briefs/batches-2-6-full-redesign-2026-10-25.md`). The owner ordered the work without an interview round; every fact below is taken from code, seed data or the brief.

## Platform

web

## Users
- **Front desk / owner** (dashboard, `/dashboard/platform/*`): run the walk-in queue and the day's bookings, check customers in, seat them in a chair, take payment at the POS, manage barbers' shifts and time off, chairs, services, packages and plans, inventory and suppliers, payroll (commissions, tips, payouts), policies, payments setup, team access and settings.
- **Barbers**: see who is next in their chair.
- **Customers** (storefront): see the shop and its barbers, join the walk-in queue, book a time, buy retail, memberships, manage visits from their account. Mostly on a phone, often standing outside or on the way.

## Product Purpose
A self-hostable appointment, walk-in and shop-management application for barbershops.

## Operating Context
- Two streams share the chairs: walk-ins (queue, wait order) and appointments (booking board).
- Services have duration and price; some require a deposit (online deposits need a configured payment provider; otherwise customers call).
- Barbers have shifts, time off, overrides and chair blocks. Times are in the shop's timezone.

## Capabilities and Constraints
- Next.js + Keystone 6. The shared dashboard shell (`features/dashboard/**`, `proxy.ts`, `app/dashboard/**` outside platform routes) stays byte-identical to Openfront E-commerce.
- No new environment variables; onboarding/seed files are not edited by design work.

## Brand Commitments
- The storefront brand is the merchant's (name, logo, colour, imagery from settings; demo: Stack & Fade, Brooklyn NY, tagline "Haircuts · Beards · Walk-ins"). Design must work for any merchant name and colour.
- Platform UI: no pill-shaped or heavily rounded tabs, chips or cards; radii ≤ 6px; flat or underline tabs (owner, 2026-10-25).

## Evidence on Hand
- Photography in `public/images/barbershop/photo/` (shop interior, floor, chair, barber at work, clipper fade, scissor cut, beard detail); SVG illustrations for barbers, services and products in `public/images/barbershop/`.
- No real testimonials, press, founding story or ratings; none may be invented.

## Product Principles
1. The floor is the product: who is in which chair, who is next, how long the wait is.
2. Walk-ins are first-class, not a fallback to booking.
3. Truthful labels and states (wait, open, deposit by phone) from real data.
4. Keep every route, state and workflow when changing presentation.
