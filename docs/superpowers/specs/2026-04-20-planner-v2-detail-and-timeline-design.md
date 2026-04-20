# Planner v2: Detail Drawer + Timeline Cells — Design Spec

**Status:** draft for review
**Date:** 2026-04-20
**Context:** Follow-up to the Planner Hero Redesign (spec `2026-04-20-planner-hero-redesign-design.md`). Adds per-entry granularity, a side-drawer detail view, timeline-grid cells, a single-planner-with-time-range foundation, and a considering/waitlisted/registered status workflow that's explicit at drop time.

## Problem

Planner v1 treats each (kid, week) slot as a single entry: either empty or one camp. Real planning is richer — a kid might have morning camp + afternoon camp same week; camps might run only M/W/F; parents are actively weighing 3-4 options before committing. The current card-click does nothing, so parents can't see or edit per-week details (price they actually paid, extras like lunch, notes).

## Goals

1. Every (kid, week) cell renders the same **7-day × AM/PM timeline grid**. Filled = committed, dotted = vacancy.
2. A **detail drawer** slides in on cell click for in-place editing of schedule, price, extras, notes, and status.
3. Parents choose initial status explicitly at drop time — **three drop zones per cell: Register / Waitlist / Consider.**
4. Waitlisted paints in the grid with a hatched pattern so uncertainty is visible at a glance.
5. **Considering** entries don't paint into the grid; they live as chips below, to handle the "weighing 4 options" case without grid overload.
6. The planner has a **configurable time range**. Introduces a `planners` table with one default planner per user. (Full multi-planner UX deferred to Spec B.)
7. **Blocks** (school/travel/at-home/other) also get a detail drawer.

## Non-Goals

- Multi-planner UX (create/name/switch between planners) — Spec B.
- Public sharing overhaul — separate future spec.
- Friends-in-camp indicator — depends on sharing; future.
- Visual design system overhaul (colors/typography) — separate future brainstorm.
- Scraped schedule richness (per-day camp hours) — camp info drawer just shows URL + short description for now.
- Per-day drag targeting (dropping on a specific square) — drop targets zones only; refine in drawer.

## Key User Flows

### Flow 1: Add a camp with initial status

1. Parent drags a camp from the My Camps rail. As the cursor enters a cell, the cell's grid fades and **three drop zones** overlay: **Register / Waitlist / Consider**.
2. Parent drops on one. The server creates a `planner_entry` with `status` matching the zone and defaults:
   - **Register / Waitlist:** `session_part: "full"`, `days_of_week: ["mon","tue","wed","thu","fri"]`, `price_cents: null`.
   - **Consider:** same field defaults; status `considering` means it doesn't paint into the grid — it appears as a chip below.
3. Cell re-renders. Register = solid color squares; Waitlist = diagonal-stripe squares of the same color; Consider = chip below grid.

### Flow 2: Edit schedule + price in detail drawer

1. Parent clicks a filled square, a legend row, or a considering chip.
2. A right-side drawer slides in (~480px wide). Planner dims in the background. Clicking outside or pressing Esc closes it.
3. Drawer header: kid name + week + camp name + scraped org info + status dropdown + ✕ close.
4. Sections:
   - **Schedule** — segmented control (`Full day` / `AM only` / `PM only`) + 7-day checkbox row (M–Su).
   - **Price** — base price input with unit toggle (`per week` / `per day`). Below: collapsible **Extras** row showing summary ("2 added · $65"); expanded reveals line-item editor (label + cost + unit per line; `+ Add another`).
   - **Total for this week** — computed line like `$385 + $65 extras` or `$85/day × 3 days = $255`.
   - **Notes** — optional textarea.
   - **Also add for** — sibling chips. Click a chip → copies schedule, price, extras to that kid's (same week) entry.
   - **Camp info** — short scraped description + URL link + placeholder for future richness.
5. All edits autosave on blur or debounce (~800ms). No save button.

### Flow 3: Promote considering → waitlisted/registered

1. Parent opens a considering chip's drawer (or uses the status dropdown on the chip itself).
2. Changes status to Waitlisted or Registered.
3. Entry inherits defaults (`session_part: "full"`, `days_of_week: mon–fri`) if not yet set, paints into the grid.

### Flow 4: Planner time range

1. Planner header shows current range as a button: `[📅 Jun 15 – Sep 5 ▾]`.
2. Click → popover with start/end date pickers.
3. Changing the range triggers a re-render; out-of-range days within boundary weeks get hatched + struck-through labels.

## Layout

### Timeline cell

Each (kid, week) cell renders:

```
        M    T    W    Th   F    Sa   Su   (Sa/Su muted by default)
AM     ██   ██   ██   ██   ██   ░░   ░░   
PM     ▧▧   ▧▧   ▧▧   ▧▧   ▧▧   ░░   ░░   
──────────────────────────────────────────
● Camp Kanata                     AM · registered
● Camp Kanata                     PM · pending
──────────────────────────────────────────
CONSIDERING (3)
[● Science Camp] [● Rock Climbing] [● Tennis]
```

- **Filled square** = camp's color (solid for registered, diagonal stripe for waitlisted).
- **Dotted square** = vacancy. Not clickable directly; click "+ Add camp" below or drag from rail.
- **Weekend squares** = muted tan/faded (different from dotted — weekends aren't inviting adds by default).
- **Out-of-range squares** = hatched pattern with struck-through day labels.
- **Legend row per camp** — color dot + camp name + compact schedule description + "pending" badge for waitlisted.
- **Considering section** — separator line + small `CONSIDERING (N)` label + horizontal chip row; chips show color dot + camp name.

### Drop zones during drag

When a camp from the rail is dragged over a cell:
- The grid + legend + considering section fade to 25% opacity.
- A 3-cell overlay grid replaces them: `[Register]` (green) · `[Waitlist]` (amber) · `[Consider]` (neutral).
- Dropping on any zone creates the entry with that status.

### Planner header

```
Planner                                    [📅 Jun 15 – Sep 5 ▾]  [+ Add camp]  [+ Add block]
3 kids · 12 weeks
```

- Date-range button opens a small popover with two date inputs. Persist to the user's default planner row.

### Camp detail drawer — layout

~480px wide, slides in from right, fixed. Header has grey-bg strip. Body scrolls.

```
┌──────────────────────────────────────────┐
│ CAMILA · JUN 22 – 26                 [✕] │
│ YMCA Camp Kanata                         │
│ Raleigh YMCA · verified ✓                │
│ ● Registered ▾                           │
├──────────────────────────────────────────┤
│ SCHEDULE                                 │
│ [Full day] [AM only] [PM only]           │
│ [M] [T] [W] [Th] [F] [Sa] [Su]           │
│                                          │
│ PRICE                                    │
│ $ [385]  [per week ▾]                    │
│ + Extras (2 added · $65)  ▾              │
│   Lunch           $ 25  [per week]       │
│   After care      $ 40  [per week]       │
│   + Add another                          │
│ ─────────────────────────────            │
│ THIS WEEK       $385 + $65 extras        │
│                                          │
│ NOTES (OPTIONAL)                         │
│ [  textarea  ]                           │
│                                          │
│ ALSO ADD FOR                             │
│ [M Mateo +]  [S Sofia (already added)]   │
│                                          │
│ CAMP INFO                                │
│ Week-long overnight camp…                │
│ camp-kanata.org ↗                        │
└──────────────────────────────────────────┘
```

### Block detail drawer — layout

Similar pattern, simpler body:

```
┌──────────────────────────────────────────┐
│ BLOCK                                [✕] │
│ ✈ Outer Banks trip                       │
├──────────────────────────────────────────┤
│ TYPE                                     │
│ [🏫 School] [✈ Travel] [🏡 Home] [⭐ Other] │
│                                          │
│ DATES                                    │
│ [Jul 6]  [Jul 17]                        │
│                                          │
│ WHO                                      │
│ [C Camila ✓] [M Mateo ✓] [S Sofia ✓]     │
│                                          │
│ NOTES (OPTIONAL)                         │
│ [  textarea  ]                           │
└──────────────────────────────────────────┘
```

## Status Dropdown

- Used in two places: drawer header + planner card legend row.
- Trigger: pill with color dot + label + ▾.
- Open: floating menu with 3 options; current has ✓.
- Options: Considering · Waitlisted · Registered. Each row has its color dot.
- Changing status in the menu persists immediately. If promoting considering → registered and `days_of_week` is empty, set default `mon–fri, full`.

## Data Model

### New table: `planners`

```sql
create table planners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null default 'My planner',
  start_date date not null,
  end_date date not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index idx_planners_user on planners(user_id);
create unique index idx_planners_one_default per user
  on planners(user_id) where is_default = true;

alter table planners enable row level security;
create policy "Users read own planners"
  on planners for select using (auth.uid() = user_id);
create policy "Users insert own planners"
  on planners for insert with check (auth.uid() = user_id);
create policy "Users update own planners"
  on planners for update using (auth.uid() = user_id);
create policy "Users delete own planners"
  on planners for delete using (auth.uid() = user_id);
```

### Auto-create default planner

Hook on profile insert (same trigger style as `handle_new_user`): after a profile is created, insert a default planner with `name='My planner'`, `start_date=today`, `end_date=today + 90 days`, `is_default=true`.

For existing users with no planner: migration backfills one default planner per user in the same migration file.

### Modified: `planner_entries`

```sql
alter table planner_entries
  add column planner_id uuid references planners(id) on delete cascade,
  add column price_cents int,
  add column price_unit text check (price_unit in ('per_week', 'per_day')),
  add column extras jsonb not null default '[]'::jsonb,
  add column session_part text not null default 'full'
    check (session_part in ('full', 'am', 'pm')),
  add column days_of_week jsonb not null default '["mon","tue","wed","thu","fri"]'::jsonb;

-- Backfill planner_id: all existing entries go to the user's default planner
update planner_entries pe
set planner_id = p.id
from planners p
where p.user_id = pe.user_id and p.is_default = true;

alter table planner_entries
  alter column planner_id set not null;

create index idx_planner_entries_planner on planner_entries(planner_id);
```

**`extras` JSON shape:**
```json
[
  { "label": "Lunch", "cost_cents": 2500, "unit": "per_week" },
  { "label": "After care", "cost_cents": 4000, "unit": "per_week" }
]
```

**`days_of_week` JSON shape:**
```json
["mon", "wed", "fri"]
```

Possible values: `"mon"`, `"tue"`, `"wed"`, `"thu"`, `"fri"`, `"sat"`, `"sun"`.

### Modified: `user_camps`

```sql
alter table user_camps
  add column color text not null default '#f4b76f';
```

On insert, the server action picks the next color from the palette (by sort-by-created-at index modulo palette length) unless explicitly set.

**Camp palette (8 colors):** `#f4b76f`, `#7fa06a`, `#8fa4c8`, `#d4a1c8`, `#c8a76a`, `#9fc8b8`, `#e89b7a`, `#b5a8d4`. Revisited in future design overhaul.

### Modified: `planner_blocks`

```sql
alter table planner_blocks
  add column planner_id uuid references planners(id) on delete cascade;

update planner_blocks pb
set planner_id = p.id
from planners p
where p.user_id = pb.user_id and p.is_default = true;

alter table planner_blocks
  alter column planner_id set not null;

create index idx_planner_blocks_planner on planner_blocks(planner_id);
```

### Migrations

- `013_planner_v2_schema.sql` — everything above in one migration:
  1. Create `planners`
  2. RLS policies
  3. Backfill: one default planner per user
  4. Trigger for new profile → default planner
  5. Alter `planner_entries`, `user_camps`, `planner_blocks`
  6. Backfill `planner_id` on existing rows

## Component Architecture

### New / heavily-modified files

- `src/components/planner/cell-timeline-grid.tsx` — the 7-day × AM/PM grid rendering (replaces the current `planner-cell.tsx` content when the cell has at least one committed entry; `planner-cell.tsx` still wraps it and handles the droppable shell).
- `src/components/planner/considering-chips.tsx` — chips list for considering entries under the grid.
- `src/components/planner/cell-drop-zones.tsx` — 3-zone overlay rendered during drag.
- `src/components/planner/camp-detail-drawer.tsx` — right-side drawer (new).
- `src/components/planner/block-detail-drawer.tsx` — right-side drawer for blocks (new).
- `src/components/planner/extras-editor.tsx` — collapsible extras line-item editor inside the drawer.
- `src/components/planner/schedule-editor.tsx` — session_part + days_of_week control inside the drawer.
- `src/components/planner/status-dropdown.tsx` — reused in drawer + card legend.
- `src/components/planner/planner-range-picker.tsx` — date-range popover in the planner header.
- `src/lib/camp-palette.ts` — color palette + assigner by index.

### Modified

- `src/components/planner/planner-cell.tsx` — refactored: owns droppable, renders either empty-cell placeholder, `cell-timeline-grid` for committed entries, `considering-chips` for considering entries, `cell-drop-zones` during drag.
- `src/components/planner/camp-card.tsx` — retire or refactor: replaced by the timeline grid + legend rows. Status dropdown component extracted.
- `src/components/planner/block-card.tsx` — add click handler → opens block detail drawer.
- `src/app/planner/client.tsx` — expand drag-end handler to accept drop-zone data (`status: considering | waitlisted | registered`) and pass through to `assignCampToWeek`. Own drawer state (which entry is open, which block is open).
- `src/app/planner/page.tsx` — fetch user's default planner, pass its `start_date`/`end_date` + `id` to client.
- `src/lib/queries.ts` — new `fetchDefaultPlanner(userId)`. Extend `fetchPlannerEntries` and `fetchPlannerBlocks` to scope by `planner_id`. Extend `fetchUserCamps` to include `color`.
- `src/lib/actions.ts` — `assignCampToWeek` accepts `status` arg; `submitCamp` writes `planner_id` and chooses camp color. Add `updateEntrySchedule`, `updateEntryPrice`, `updateEntryExtras`, `updateEntryNotes`, `updatePlannerRange`, `createPlanner` (stub for Spec B).
- `src/lib/ics.ts` — use `session_part` + `days_of_week` to generate more accurate calendar events (one VEVENT per active day, with AM/PM hours if scraped camp info supplies hours).

### Drag-end data payload

```ts
// camp rail item data (unchanged)
{ type: "camp", userCampId, activityId, name }

// drop target data — now with status
{ type: "cell-drop", childId, weekStart, status: "registered" | "waitlisted" | "considering" }
```

Handler sketch:
```ts
if (activeData?.type === "camp" && overData?.type === "cell-drop") {
  await assignCampToWeek(
    activeData.userCampId,
    overData.childId,
    overData.weekStart,
    overData.status,
  );
  router.refresh();
}
```

## Error Handling & Edge Cases

- **Conflict detection**: if two camp entries for the same (kid, week) fill the same square (same day + session_part), show a red outline around the conflicting squares and a warning badge on the cell. Don't block the save.
- **Dropping considering on an out-of-range week**: allowed (parent might extend range later). No special treatment.
- **Parent changes planner range and existing entries fall outside**: entries stay in the DB; they just don't render. If range is re-expanded, they reappear.
- **Deleting the default planner**: prevented by UI — default planner's delete button is hidden. (Spec B handles multi-planner delete.)
- **Autosave race**: drawer input debounced at 800ms; optimistic UI updates; if the server rejects, revert the field and toast the error.

## Testing Strategy

- **Unit**: `days_of_week` serialization, session_part state machine, camp palette index assignment, extras cost summation, conflict detection helper.
- **Integration**: schedule editor ↔ DB round-trip, considering → registered promotion defaults, planner range backfill migration.
- **E2E (manual)**: full drawer flow, drag-drop onto each of the 3 zones, waitlisted rendering, out-of-range week display, block drawer.

## Out of Scope (explicit)

- Multi-planner UX — spec B (create additional planners, switcher, archive).
- Per-square drag targeting — drop on a zone, refine in drawer.
- Scraped per-day hours — placeholder, future work with scraper refinement.
- Sharing overhaul — separate brainstorm (including friends-in-camp indicator).
- Visual design system — future brainstorm.
- Mobile drawer interaction — mobile ships with drawer as a full-screen bottom sheet (simpler than side drawer); same content, different chrome.

## Open Questions

None — all resolved during brainstorming.

## Sequencing

1. Plan + build Spec A (this doc).
2. Validate in prod.
3. Spec B: full multi-planner UX (create/name/switch/archive).
4. Sharing overhaul spec.
5. Visual design system overhaul.
