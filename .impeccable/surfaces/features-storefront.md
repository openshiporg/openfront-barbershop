---
version: 1
slug: "features-storefront"
primary_target: "features/storefront"
related_targets: ["app/(storefront)"]
---

# Storefront (features/storefront, app/(storefront))

Mode: Persuade on home, services, barbers, shop, memberships; Operate on book, queue, appointment, account.
Audience: a customer on a phone, often outside on the street in daylight, deciding whether to walk in now or book a time. Action in working form: join the walk-in line or pick a time, from the first viewport.
Constraints: keep every route, state, workflow, loader, server action, form field; merchant name/logo/colour/images from settings; no invented claims (no ratings, founding year, press). Queue positions and waits shown only from real data.
Decision: owner ordered the redesign with no approval round (2026-10-25); assigned direction taken unattended, code-led (no image generation).

## Direction contract

THESIS: Take a number. The shop's walk-in system is the storefront: a ticket dispenser and its "Now serving" board. The first thing a passer-by learns is the line right now, and the page hands them a ticket (join the line) or a time (book). It refuses the dark wood-and-whisky barbershop page and the barber-pole stripe as wallpaper.

OWN-WORLD: Enamel-white sign ground (cool, not cream), black sign panels, and ticket stock in the merchant's colour (demo amber) as the one saturated field, owning real area: every primary action is a torn ticket with a perforated edge and a heavy numeral. Type: a condensed display grotesk for numerals and labels (e.g. Big Shoulders Display from Google Fonts), a plain workhorse grotesk for body (not Inter, not the salon's Archivo). Square corners; perforation and ticket notches are the only shaped edges. No pills.

STORY: See how many are waiting and whether walk-ins are open; take a ticket or choose a time; see the barbers and the price board; come back to your ticket from your account.

FIRST VIEWPORT: Top: shop name and tagline on a black sign band with open/closed and today's hours. Main: the "Now serving" board (black panel, seven-segment numerals built in SVG/CSS, unlit segments drawn as ghosts) showing people waiting and estimated wait from live queue data (or "Walk-ins closed · opens …" when closed), beside a big ticket "Join the line" and a second ticket "Book a time". A shop-floor photograph sits below as the board's backdrop band. Phone: board full width, the two tickets stacked under it, both above the fold.

FORM: Candidate 5 of 7 (take-a-number dispenser), seed: seed:44ede35765a09f26. Seven-segment display family (challenger 4): competitive; kept as the board's numerals, raise: unlit segments are designed, not empty. Variable-font specimen: declined; raise: hierarchy carried by the width/weight of one display face, no eyebrows. Glazier colour-field partition: declined; raise: saturated colour placed sparingly as whole fields (tickets), never as scattered accents. Centre-rail reference setting: declined; raise: the price board runs on a fixed rail (name · duration · price) aligned across every row. Window-box toy shelf: declined; raise: every product shows the product itself, never a reused portrait. Signature interaction: tearing a ticket: pressing "Join the line" or a time slot plays a short tear along the perforation and the ticket docks into a sticky "your ticket" bar on phone.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
