---
version: 1
slug: "features-platform"
primary_target: "features/platform"
related_targets: ["app/dashboard/(admin)/platform"]
---

# Platform pages (features/platform, /dashboard/platform/*)

Mode: Operate. Users: front desk, owner, barbers. Inside the fixed shared dashboard shell, byte-identical to E-commerce.
Rules (owner, 2026-10-25): no pill or heavily rounded tabs, chips or cards; radii at most 6px (`rounded-md`); flat underline tabs; dense tables with real status columns; each page opens on the operator's first-10-seconds task.

## Direction contract

THESIS: The floor. Every screen opens on what is happening at the chairs and in the line right now, and refuses the tile-strip-over-pill-tabs template.

OWN-WORLD: The shell's neutral palette; status colour only where it carries meaning (dot + word); one sans with tabular numerals for times, waits and money; dense 40px rows; flat 6px buttons with a filled ink primary; underline tabs with counts; hairline panels; forms collapsed behind the row action that needs them.

STORY: See who is in each chair and who is next, act from the row (check in, seat, finish, take payment), drill into a record only when needed.

FIRST VIEWPORT: Title with one truthful status and the primary action at right; underline tabs; then the work: on Queue and Booking a chair strip (one cell per chair: barber, who is in it, since when) above a time-ordered table; on POS the open tickets first.

FORM: Extension of the established shell world. The concept roll was skipped on purpose: the owner's brief pins this surface's structure (task-first pages, dense tables with a status column, flat underline tabs, radii at most 6px), and a pinned brief outranks the roll. Owner's words (brief batches-2-6-full-redesign-2026-10-25.md): "No pill-shaped or heavily rounded tabs, chips or cards. Use tight radii (≤6px), flat or underline tabs, dense readable tables and lists, clear hierarchy, real status columns." and "Rebuild each page around the operator's main tasks (what they open it to do in the first 10 seconds), not around the data model." seed: seed:eb9e04e3b592d4cd (surface roll, run after the build at the finish review's request). It dealt my grounded structures 7 (a command-first next-action bar over the list), 3 (lanes by barber) and 6 (a ticket rail per chair) from: 1 status table with underline tabs, 2 chair strip over a time-ordered line, 3 lanes by barber, 4 status kanban, 5 list and detail split, 6 ticket rail per chair, 7 command-first next-action bar. The build carries 3 on Booking (barber lanes with a now-line) and a slice of 7 on Queue (the marked Next row); everything else stays on the owner-pinned table-first structure, which outranks the roll. Signature move: the chair strip.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
