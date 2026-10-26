---
name: Openfront Barbershop
description: Take a number. The walk-in ticket dispenser and its "Now serving" board out front; the floor behind the counter.
colors:
  ticket: "oklch(46% 0.2 263)"
  ticket-press: "oklch(40% 0.19 263)"
  ticket-ink: "oklch(98.5% 0.008 263)"
  ticket-soft: "oklch(93% 0.035 263)"
  led: "oklch(84% 0.18 263)"
  led-ghost: "oklch(21% 0.036 263)"
  led-ghost-edge: "oklch(30% 0.044 263)"
  focus: "oklch(52% 0.2 263)"
  enamel: "oklch(96.6% 0.005 230)"
  enamel-2: "oklch(92.6% 0.007 230)"
  enamel-3: "oklch(87.5% 0.009 230)"
  field-white: "oklch(99.5% 0.002 230)"
  ink: "oklch(16% 0.012 240)"
  ink-2: "oklch(30% 0.012 240)"
  ink-muted: "oklch(42% 0.012 240)"
  rule: "oklch(82% 0.009 230)"
  sign: "oklch(0% 0 0)"
  sign-2: "oklch(19% 0.004 240)"
  sign-3: "oklch(31% 0.006 240)"
  sign-ink: "oklch(97% 0.004 230)"
  sign-muted: "oklch(76% 0.008 230)"
  live: "oklch(50% 0.13 150)"
  live-on-sign: "oklch(82% 0.17 150)"
  wait: "oklch(55% 0.13 70)"
  alert: "oklch(48% 0.18 27)"
  alert-on-sign: "oklch(76% 0.15 27)"
  alert-soft: "oklch(94.5% 0.03 27)"
  floor-background: "oklch(1 0 0)"
  floor-foreground: "oklch(0.141 0.005 285.823)"
  floor-muted: "oklch(0.967 0.001 286.375)"
  floor-muted-foreground: "oklch(0.552 0.016 285.938)"
  floor-border: "oklch(0.92 0.004 286.32)"
  floor-live: "oklch(69.6% 0.17 162.48)"
  floor-wait: "oklch(76.9% 0.188 70.08)"
  floor-info: "oklch(54.6% 0.245 262.881)"
  floor-alert: "oklch(63.7% 0.237 25.331)"
  floor-off: "oklch(70.5% 0.015 286.067)"
  floor-now-line: "oklch(63.7% 0.237 25.331)"
typography:
  numeral:
    fontFamily: "Big Shoulders, Arial Narrow, sans-serif"
    fontSize: "clamp(4.25rem, 19vw, 8.5rem)"
    fontWeight: 900
    lineHeight: 0.8
    fontFeature: "tnum"
  display:
    fontFamily: "Big Shoulders, Arial Narrow, sans-serif"
    fontSize: "clamp(2.9rem, 10vw, 5.75rem)"
    fontWeight: 850
    lineHeight: 0.86
    letterSpacing: "-0.005em"
  headline:
    fontFamily: "Big Shoulders, Arial Narrow, sans-serif"
    fontSize: "clamp(2.1rem, 5.6vw, 3.4rem)"
    fontWeight: 850
    lineHeight: 0.9
  title:
    fontFamily: "Big Shoulders, Arial Narrow, sans-serif"
    fontSize: "clamp(1.4rem, 3vw, 1.75rem)"
    fontWeight: 780
    lineHeight: 0.95
    letterSpacing: "0.005em"
  lead:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.06rem, 1.5vw, 1.2rem)"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1.4
  floor-title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    letterSpacing: "-0.025em"
  floor-body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  floor-label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    fontFeature: "tnum"
rounded:
  none: "0"
  floor-control: "6px"
  floor-inset: "4px"
spacing:
  xl: "2.5rem"
  2xl: "4rem"
  3xl: "6rem"
  measure: "40rem"
  measure-wide: "78rem"
  head-h: "3.5rem"
  head-h-desktop: "4rem"
  floor-row: "40px"
components:
  ticket-link:
    backgroundColor: "{colors.ticket}"
    textColor: "{colors.ticket-ink}"
    rounded: "{rounded.none}"
    height: "6.5rem"
  ticket-link-hover:
    backgroundColor: "{colors.ticket-press}"
  ticket-link-sign:
    backgroundColor: "{colors.sign}"
    textColor: "{colors.sign-ink}"
  button-primary:
    backgroundColor: "{colors.sign}"
    textColor: "{colors.sign-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0.55rem 1.25rem"
    height: "3rem"
  button-primary-hover:
    backgroundColor: "{colors.sign-2}"
  button-ticket:
    backgroundColor: "{colors.ticket}"
    textColor: "{colors.ticket-ink}"
    rounded: "{rounded.none}"
    padding: "0.55rem 1.25rem"
    height: "3rem"
  button-ticket-hover:
    backgroundColor: "{colors.ticket-press}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.55rem 1.25rem"
    height: "3rem"
  button-outline-hover:
    backgroundColor: "{colors.enamel-3}"
  input:
    backgroundColor: "{colors.field-white}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0.7rem 0.85rem"
    height: "3rem"
  time-slot:
    backgroundColor: "{colors.field-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    height: "2.9rem"
  time-slot-selected:
    backgroundColor: "{colors.ticket}"
    textColor: "{colors.ticket-ink}"
  board-panel:
    backgroundColor: "{colors.sign}"
    textColor: "{colors.sign-ink}"
    rounded: "{rounded.none}"
    padding: "1.25rem 1.25rem 1.4rem"
  ticket-dock:
    backgroundColor: "{colors.sign}"
    textColor: "{colors.sign-ink}"
    padding: "0.75rem 1rem"
  nav-band:
    backgroundColor: "{colors.sign}"
    textColor: "{colors.sign-muted}"
    height: "{spacing.head-h}"
  floor-button-primary:
    backgroundColor: "{colors.floor-foreground}"
    textColor: "{colors.floor-background}"
    typography: "{typography.floor-body}"
    rounded: "{rounded.floor-control}"
    padding: "0 0.875rem"
    height: "2.25rem"
  floor-button-raised:
    backgroundColor: "{colors.floor-background}"
    textColor: "{colors.floor-foreground}"
    rounded: "{rounded.floor-control}"
    padding: "0 0.875rem"
    height: "2.25rem"
  floor-tag:
    backgroundColor: "{colors.floor-muted}"
    textColor: "{colors.floor-foreground}"
    rounded: "{rounded.floor-inset}"
    padding: "0 0.375rem"
    height: "1.25rem"
  floor-table-head:
    backgroundColor: "{colors.floor-muted}"
    textColor: "{colors.floor-muted-foreground}"
    typography: "{typography.floor-label}"
    padding: "0 0.75rem"
    height: "2.25rem"
  floor-table-cell:
    typography: "{typography.floor-body}"
    padding: "0.625rem 0.75rem"
    height: "{spacing.floor-row}"
---

# Design System: Openfront Barbershop

## Overview

**Creative North Star: "Take a number"**

Two worlds share one shop. Out front, the storefront is the shop's walk-in system made into a page: a cool enamel sign ground, black sign panels, a "Now serving" board drawn in seven-segment numerals, and primary actions printed as torn tickets in the merchant's colour. A passer-by on a phone in daylight learns the line right now and is handed a ticket (join the line) or a time (book). Hierarchy is carried by the width and weight of one condensed display face, never by labels stacked above headings.

Behind the counter, the platform is "the floor": every operator screen opens on what is happening at the chairs and in the line, inside the shared dashboard shell. It is neutral, dense and flat: the shell's own palette, status colour only where it carries meaning (a dot plus a word), tabular numerals for times, waits and money, 40px rows, flat 6px controls with a filled ink primary, underline tabs with counts, and hairline panels. The shared dashboard shell (sidebar, header, theme tokens in `app/dashboard/globals.css`, `components/ui`) is untouched by this system; neither shipping commit (691be74, 2e13c24) edits it, and the floor kit sets explicit pixel radii instead of changing the shell's 10px `--radius`.

The storefront replaced the earlier navy felt letter-board world. It refuses the dark wood-and-whisky barbershop page and the barber-pole stripe as wallpaper.

**Key Characteristics:**
- Ticket stock in the merchant's colour is the one saturated field, placed as whole areas (tickets, the selected option, the chosen slot), never as scattered accents.
- Square corners everywhere on the storefront; perforations and ticket notches are its only shaped edges.
- Unlit seven-segment ghosts are designed, not empty: the board always shows every segment.
- Truthful numbers only: board readouts come from live queue data or show ghost dashes, never a guess.
- The floor is table-first: chair strip, then a time-ordered table, then a record only when needed.
- Status is a dot plus a word on both surfaces; never a coloured pill.

## Colors

A cool, nearly colourless enamel-and-black sign world with a single saturated stock derived from the merchant's colour; the floor runs on the shell's neutrals with four meaning-bearing status hues.

### Primary
- **Ticket Stock** (`{colors.ticket}`): every primary action's field: the ticket links on home, the "Book" plate in the nav band, the accent button, the chosen option row and the chosen time slot, text selection, the active nav underline (4px). Derived, not chosen: `oklch(from var(--color-accent) 46% min(c, 0.2) h)`, so any merchant hue lands at a depth where white type reads. The frontmatter value is the live demo's resolution (the Cobalt preset, `oklch(50% 0.2 263)`).
- **Ticket Press** (`{colors.ticket-press}`): hover and press state of ticket stock (40% lightness, same hue).
- **Ticket Ink** (`{colors.ticket-ink}`): type and perforation dots on ticket stock (98.5%, chroma 0.008); the perforation uses it at 55% alpha.
- **Ticket Soft** (`{colors.ticket-soft}`): the one tint use: today's row in the hours list.

### Secondary
- **Board LED** (`{colors.led}`): lit seven-segment numerals, the active item in the phone nav sheet, completed lamps on the appointment progress rail, and the focus outline on black panels. Derived as `84% calc(c * 0.7 + 0.04) h` from the merchant colour.
- **LED Ghost** (`{colors.led-ghost}`) with **Ghost Edge** (`{colors.led-ghost-edge}`): unlit segments, filled dark and stroked 1px so the off state reads like a real board. Ghost Edge also fills dimmed readouts (unknown values).

### Tertiary
- **Live Green** (`{colors.live}`, `{colors.live-on-sign}` on black): walk-ins open, line running.
- **Wait Amber** (`{colors.wait}`): waiting states.
- **Alert Red** (`{colors.alert}`, `{colors.alert-on-sign}` on black, `{colors.alert-soft}` notice ground): closed, errors, invalid fields, danger buttons.

### Neutral
- **Enamel** (`{colors.enamel}`): the storefront ground, also painted on `html` and `body` so overscroll never shows white. Cool hue 230, not cream.
- **Enamel 2 / Enamel 3** (`{colors.enamel-2}`, `{colors.enamel-3}`): image wells, notices, quiet hovers; Enamel 3 is the outline-button hover.
- **Field White** (`{colors.field-white}`): inputs, time slots and outlined cards: a hair brighter than the ground.
- **Ink / Ink 2 / Ink Muted** (`{colors.ink}`, `{colors.ink-2}`, `{colors.ink-muted}`): body type, secondary type and input borders, metadata.
- **Rule** (`{colors.rule}`): 1px row dividers; heavy dividers (2-3px) use Ink.
- **Sign Black** (`{colors.sign}`): the nav band, home sign band, the board, the booking summary, the dock, the footer, step numbers, chair plates. Pure black.
- **Sign 2 / Sign 3** (`{colors.sign-2}`, `{colors.sign-3}`): hovers and dividers on black.
- **Sign Ink / Sign Muted** (`{colors.sign-ink}`, `{colors.sign-muted}`): type on black.
- **Floor neutrals** (`{colors.floor-background}`, `{colors.floor-foreground}`, `{colors.floor-muted}`, `{colors.floor-muted-foreground}`, `{colors.floor-border}`): the shared shell's light-theme tokens, used through its utilities so the floor follows the shell into dark mode. Not redefined by this system.
- **Floor status** (`{colors.floor-live}` live, `{colors.floor-wait}` wait, `{colors.floor-info}` info, `{colors.floor-alert}` alert, `{colors.floor-off}` off): dot colours only. The booking lanes carry the same hues as soft blocks (requested amber, confirmed blue, checked-in emerald, in-chair solid emerald, completed muted). The now-line is a 1px red rule (`{colors.floor-now-line}`).

### Named Rules
**The One Stock Rule.** The merchant colour exists only as ticket stock and its LED. It fills whole fields; it is never a border tint, icon colour or decorative stripe. The one exception is a 2-4px underline marking the current or hovered link.

**The Derived Hue Rule.** Never hard-code the ticket colour. Derive every ticket and LED value from `--color-accent` with relative colour syntax at fixed lightness, so every preset reads.

**The Meaning-Only Status Rule.** On the floor, colour appears only as status: a dot beside a word, a lane block's state, the now-line. Everything else is the shell's neutrals.

## Typography

**Display Font:** Big Shoulders (variable, optical sizes on; `next/font/google`, `--font-big-shoulders`) with Arial Narrow
**Body Font:** Public Sans (`--font-public-sans`) with ui-sans-serif, system-ui
**Floor Font:** Geist, the shell's sans (inherited, not set by the floor)

**Character:** A condensed signage grotesk set uppercase and very heavy (780-900) for numerals, names and prices, against a plain workhorse grotesk for everything a customer reads. On the floor, one sans with tabular numerals.

### Hierarchy
- **Numeral** (900, `{typography.numeral}`, line-height 0.8, tabular): the wait on a walk-in ticket; the seven-segment board renders at the same size in SVG.
- **Display** (850, clamp(2.9rem, 10vw, 5.75rem), 0.86, uppercase, balanced): page H1s; the home sign uses its own larger clamp(2.6rem, 11vw, 6.5rem).
- **Headline** (850, clamp(2.1rem, 5.6vw, 3.4rem), 0.9, uppercase): section titles.
- **Title** (780, clamp(1.4rem, 3vw, 1.75rem), 0.95, uppercase): subtitles and list-item names. Price-board names and prices sit between Title and Headline at clamp(1.45rem, 3.6vw, 2.1rem).
- **Lead** (400, clamp(1.06rem, 1.5vw, 1.2rem), 1.5): intro paragraphs, max 40rem.
- **Body** (400, 1rem, 1.55): running text; small text is 0.9rem.
- **Label** (700, 0.8125rem, sentence case, no tracking, Ink Muted): field labels such as "Address", "Phone", "Total". It sits beside or above a value, never above a heading.
- **Floor Title** (600, 1.25rem rising to 1.375rem at md, tracking-tight): page title, optionally led by a status dot.
- **Floor Body** (400, 0.875rem): table cells and forms. **Floor Label** (500, 0.75rem, tabular): table heads, counts, chair-strip captions.

### Named Rules
**The One Face Hierarchy Rule.** Storefront hierarchy is width and weight of Big Shoulders alone. No tracked-caps labels above headings, no second display face.

**The Tabular Rule.** Every time, wait, count and price on either surface sets `tabular-nums` so columns of numbers align.

## Layout

**Storefront.** One centred container, `min(100% - 2rem, 78rem)` (3rem of gutter from 40rem), with a 40rem narrow measure for forms and prose. Sections pad `clamp(3rem, 7vw, 5.5rem)` vertically. Breakpoints are 40rem, 64rem and 80rem. The nav band is sticky at 3.5rem (4rem from 64rem); links appear from 64rem, the open/closed status from 80rem; below that, a phone sheet lists pages in 1.75rem display type.

The home first viewport is the dispenser: on desktop the board sits beside two stacked tickets (1.25fr : 1fr, the tickets splitting the height); on phone the board runs full width with both tickets stacked beneath; a shop-floor photograph band, clamp(13rem, 34vw, 24rem) tall, sits below as the board's backdrop.

**The Price-Board Rail.** Services and shop products run on one fixed three-column rail, `name · duration · price`: `minmax(0, 1fr) 4.25rem 5.25rem` with a 0.75rem gap on phones, widening to `1fr 6rem 7rem` with 1.25rem from 40rem. Duration and price are right-aligned and tabular so they align down every row; meta and descriptions span the full row beneath. Groups open on a 3px ink rule; rows divide with 1px rules. A lead row (featured item) drops to two columns and sets name and price at clamp(2.2rem, 7vw, 3.6rem) between 3px rules.

Booking is a form column plus a sticky black summary (19-23rem) from 64rem; below 64rem the summary is replaced by the dock. Chairs (barbers) grid 1, 2, then 3 columns; products 2, then 3.

**Floor.** Inside the shell, pages stack title row, readouts or chair strip, underline tabs, then the table. Rows are dense (about 40px: 0.625rem padding on 0.875rem type); table heads are 36px. Tables scroll horizontally inside their own relative wrapper, or (the `stack` variant) fold into two-column stacked rows under md. The barber lanes need 720px and show from md; phones get the time-ordered table only.

## Elevation & Depth

Both worlds are flat; there are no shadows anywhere. On the storefront, depth is a contrast plane: black sign panels (the band, the board, the summary, the dock, the footer) sit on the enamel ground, and ticket stock is the only other solid field. The notches on ticket documents are cut by painting the enamel ground through them, so the ticket reads as paper lying on the sign. On the floor, depth is hairlines: 1px borders, `gap-px` grids over a border-coloured ground (the readouts ledger, the chair strip), a muted header row, and a faint muted fill on free chairs.

### Named Rules
**The Flat Sign Rule.** No `box-shadow`, no blur, no gradient surfaces. Separate planes by black-on-enamel contrast (storefront) or a hairline (floor).

## Shapes

**Storefront: square.** Every button, input, slot, card, tag, lamp and panel has a 0 radius; even the status lamp is a square (0.6em). The only curves are the world's own paper devices:

- **Ticket notches.** On ticket links, two semicircle bites (0.7rem radius) are masked out of the top and bottom edges where the stub meets the body (at 5.75rem, 7rem from 40rem). On ticket documents (your walk-in ticket, the booking request), two 0.85rem circles in the enamel ground cut the left and right edges at the tear line under the head.
- **Perforation.** A dotted line of 1.5px dots in Ticket Ink at 55% alpha: vertical along the stub's right edge (4px x 9px tile), horizontal under a ticket document's head (9px x 4px tile). On black stock the dots are Sign Ink at 45%.

Heavy rules (2-3px Ink) mark the top of lists, option groups and page heads; 1px Rule divides rows.

**Floor: tight pixels.** Radii are explicit because the shell's `--radius` is 10px (and its `rounded-md` resolves to 8px): 6px (`{rounded.floor-control}`) for buttons, inputs, selects, segmented controls, menus, notices, table wrappers, the readouts ledger and the chair strip; 4px (`{rounded.floor-inset}`) for things inside them: tags, the "Next" marker, lane blocks and menu items. Status dots are the only round shape (8px).

## Components

### Buttons
Square sign plates on the storefront; flat 6px controls on the floor.
- **Shape:** storefront 0 radius, 2px border, 3rem tall, 0.55rem x 1.25rem, Public Sans 700 1rem. Floor 6px, 36px tall at sm and up (40px on phones), 0.875rem medium; a small size at 32px.
- **Primary:** storefront Sign Black with Sign Ink (inverted to Sign Ink on black panels). Floor: filled ink (`foreground`) with `background` text.
- **Ticket button:** ticket stock with Ticket Ink, set in Big Shoulders 800 at 1.35rem uppercase. On a ticket document the roles swap (Sign Black on stock).
- **Hover / Focus:** hover only on fine pointers (outline to Enamel 3, primary to Sign 2, ticket to Ticket Press). Press scales to 0.97 over 140ms. Focus is a 3px outline in the focus hue, offset 2px (LED on black). Floor: hover darkens the border and fills muted; press 0.98; focus is the shell's 2px ring.
- **Secondary:** storefront outline (transparent, 2px Ink), quiet (underlined text), danger (Alert outline). Floor raised (1px border on background), flat (borderless muted text), danger (red outline).

### Segmented choice
- **Storefront:** square segments in one 2px Ink frame; the pressed segment fills Sign Black.
- **Floor, records** (`records/lib/controls.tsx`): one 6px bordered group, segments divided by 1px left borders, the checked one filled ink; radio semantics with arrow-key roving focus.
- **Floor, booking** (`FloorKit` Segmented): separate 6px bordered buttons 6px apart; checked is ink-filled at the large (48px) size and a muted fill with an ink border at the small (32px) size. Never a recessed pill track.

### Inputs / Fields
- **Style:** storefront 2px Ink 2 border, 0 radius, Field White, 3rem tall, 1rem Public Sans; label above in 0.9rem 700. Custom select chevron drawn with two gradients. Floor: the shell's Input at 36px, selects matched to it with a 6px radius.
- **Focus:** storefront border turns Ticket Stock with the focus outline flush (offset 0).
- **Error / Disabled:** `aria-invalid` turns the border Alert; disabled is 45% opacity. Floor errors are a destructive notice or a line of red text under the control.
- **Forms on the floor** open in a right-hand drawer (up to 32rem) from the row or page action that needs them, never inline by default.

### Navigation
- **Storefront nav band:** sticky black band; brand in Big Shoulders 850 at 1.45rem; links Public Sans 650 0.9rem in Sign Muted; the current page goes Sign Ink with a 4px ticket-stock bar on the bottom edge; a ticket-stock "Book" plate at right. Phone: a menu toggle opens a sheet of 1.75rem display links, the current one lit in LED.
- **Floor StatusTabs / LocalTabs:** flat underline tabs, 36px tall, 20px apart on one bottom border; active is a 2px foreground underline and foreground text; counts follow in tabular 0.75rem at 70% foreground; optional status dot. They scroll horizontally on phones and bleed to the screen edge.

### Ticket link (signature)
The storefront's primary action. A ticket-stock grid (stub plus body), at least 6.5rem tall (7.5rem from 40rem), with notches masked at the stub line and a vertical perforation down the stub's edge. The stub carries a heavy numeral (Big Shoulders 900, 3.4rem, 4.25rem from 40rem; 2.1rem for words) and an optional unit; the body carries an uppercase title at clamp(1.9rem, 7vw, 2.6rem) with a trailing arrow, and a 1.02rem sub-line. A black-stock variant serves the secondary ticket ("Book a time" beside "Join the line"). Hover goes to Ticket Press and nudges the arrow 3px.

**The tear.** Pressing a ticket link sets `data-torn` and the body rips away along the perforation over 260ms (out-expo `cubic-bezier(0.23, 1, 0.32, 1)`): translate(0.35rem, -0.15rem) rotate(1.2deg), then translate(0.9rem, 0.45rem) rotate(3deg) at 70% opacity, while the page navigates. The stub stays.

### Ticket document
Your walk-in ticket and the booking request: ticket stock with a head separated by a horizontal perforation, enamel-circle notches at both ends of the tear line, the wait in the Numeral role with a 0.35em unit, and a definition list ruled in perforation colour.

### Seven-segment board (signature)
**Now serving.** A black panel (1.25rem padding, 1.5rem x 1.75rem from 40rem) with a plate row (title "Now serving" in Big Shoulders 850 at 1.6rem and an open/closed lamp with its word), two readouts (people waiting; minutes of estimated wait), and a note row (in the chair, barbers on the floor), divided by 1px Sign 3 rules. Numerals are inline SVG: seven hexagonal segments per digit on a 60 x 100 grid, skewed -6deg, digits 0.12em apart, right-aligned and padded with blanks like a real readout. Lit segments fill LED; every unlit segment is drawn as a ghost with a 1px ghost edge. Unknown values show ghost-dim dashes. When walk-ins are closed with posted hours, the board spells the opening hour in lit segments. The SVG is `aria-hidden`; a status line speaks the real values.

### Price-board row
A row on the rail (see Layout): uppercase name and price in Big Shoulders (780 and 850), duration in Public Sans 600 small, tabular, Ink Muted. Hover underlines the name in ticket stock (3px). Products use the same rail, and a product image only ever shows the product itself (the merchant's upload or a product drawing it explicitly names), never a shop photo.

### Option rows and time slots
Choose-a-service and choose-a-barber rows sit on the rail under a 2px Ink rule; the chosen row turns entirely to ticket stock. Time slots are grouped by part of day under a 2px Ink rule with a display-face heading; each slot is a square 2.9rem field (1px Ink 2 border, 0.95rem 650 tabular) in an auto-fill grid of 5.5rem minimum; the chosen slot turns to ticket stock; press scales to 0.96.

### Sticky ticket dock (signature)
Below 64rem the booking summary becomes "your ticket": a black bar stuck to the bottom of the viewport (respecting the safe-area inset), bleeding to the screen edges, holding the choice in a 1.35rem uppercase line, the total at 1.9rem 900 tabular, and the submit. **The dock:** each new time choice re-keys the bar and it arrives over 280ms on the same out-expo curve, from translateY(0.9rem) rotate(-0.6deg) at 60% opacity, as if a torn ticket landed. Hidden from 64rem, where the sticky summary takes over. Reduced motion collapses both the tear and the dock to instant.

### Status lamp
Storefront: a 0.6em square lamp before its word (Live, Wait, Alert, ticket stock, or Ink Muted; the on-sign variants on black). Floor: an 8px round dot before its word (`StatusDot`, `StatusCell` at 13px medium). On both, the word always carries the meaning; the colour never stands alone.

### Floor tables
Dense operator tables in a 6px bordered wrapper: 36px heads on a 40% muted fill in 0.75rem medium muted text, cells at 0.625rem x 0.75rem with 1px row borders and none on the last row, a Status column rendered as dot plus word, a right-aligned tabular Price column, and a final actions column holding the row menu. The `stack` variant turns each row into a two-column card-free block under md.

### Row menu
One "more" button per row (36px square, flat variant; muted fill while open) opening a 6px menu at least 11rem wide, with 4px items. Safe actions first; destructive actions last, behind a separator, in destructive text. Server errors appear as red text under the trigger.

### Chair strip (signature, floor)
One cell per chair across the top of Queue and Booking: a wrapping flex of growing cells (half width on phones, a third from sm, 12rem basis from lg) joined by 1px gaps over the border colour in one 6px frame, so every row spans the full width. Each cell: barber with status dot and "Chair N" in 0.75rem muted, the occupant in 0.875rem (semibold when occupied, muted with a faint fill when free), the service, and "since 2:10 PM · 24 min" in tabular muted type.

### Barber lanes (floor)
On Booking from md: one 48px lane per barber (a 9rem name column with chair number), a 32px muted hour header, 1px hour gridlines at 70% border, and appointments as absolutely placed 4px blocks coloured by status, labelled with start time and the name (initials when short). A 1px red now-line crosses all lanes. The time-ordered table below remains the full list. On Queue, the next customer's row carries a 4px ink "Next" marker.

## Do's and Don'ts

### Do:
- **Do** derive ticket and LED colours from `--color-accent` with relative colour syntax at fixed lightness (`46%`, `40%`, `84%`, `21%`).
- **Do** print the primary action of a storefront screen as a ticket link with a stub numeral, notches and a perforation.
- **Do** draw every seven-segment segment, lit or ghost, and give the board's values as text for screen readers.
- **Do** align every price board, service list and product list to the `name · duration · price` rail with tabular numerals.
- **Do** keep storefront corners at 0 and floor corners at explicit `rounded-[6px]` (controls, frames) or `rounded-[4px]` (inside them).
- **Do** show status as a lamp or dot followed by its word.
- **Do** open floor screens on the chair strip or the open work, then underline tabs with counts, then the table.
- **Do** put row actions in one row menu, destructive items last and separated.
- **Do** honour `prefers-reduced-motion`: the tear and the dock become instant.

### Don't:
- **Don't** use pill-shaped or heavily rounded buttons, tabs, chips or cards on either surface; the only curves are ticket notches, perforation dots and the floor's status dots.
- **Don't** use the shell's `rounded-md`/`rounded-lg` utilities on the floor; they resolve to 8px and 10px from the shell's `--radius`.
- **Don't** set tracked uppercase labels above headings on the storefront; a label names a field value.
- **Don't** scatter the merchant colour as accents, borders or icon tints; it is a whole field or nothing.
- **Don't** add shadows, blur or gradient surfaces to either world.
- **Don't** show queue counts, waits or positions that are not from live data; show ghost dashes instead.
- **Don't** reuse a shop or barber photograph as a product image.
- **Don't** use the barber-pole stripe as decoration.
- **Don't** edit the shared dashboard shell or its theme tokens to suit the floor.
