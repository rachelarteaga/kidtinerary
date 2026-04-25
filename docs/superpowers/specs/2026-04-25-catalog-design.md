# Catalog — Design

**Branch:** TBD (suggested `catalog`)
**Date:** 2026-04-25
**Scope:** Build out `/catalog` from placeholder to the user's master library of activities, with filters, sorts, manual add flows, and an LLM-backed "Help me find" web-search surface. One bundle.

---

## Context

`/catalog` today is a placeholder: a centered "Your Catalog — coming soon" page ([src/app/catalog/page.tsx](src/app/catalog/page.tsx)) pointing the user back to the planner. The home page primary CTA is **"Start your Catalog"**, so this is the front door — and the front door is empty.

The data model already supports the catalog as a master library:

- [supabase/migrations/002_create_tables.sql](supabase/migrations/002_create_tables.sql) — `user_activity` is account-wide; `planner_entry` references it by id; `kids.interests text[]` exists; `activities.categories text[]` exists.
- The planner's [my-activities-rail.tsx](src/components/planner/my-activities-rail.tsx) already lists every `user_activity` for the account, regardless of placement (per [feature ideas/planner.md](feature%20ideas/planner.md)).
- Friend sharing is wired at the planner level via `shared_schedules`; per-camp sharing is in the data model but blocked on a public camp page (per [feature ideas/camp-detail.md](feature%20ideas/camp-detail.md)) — that's separate work.
- `src/components/catalog/*` contains stale components (`search-bar`, `filter-sidebar`, `sort-bar`, `address-input`, `search-filter-panel`, `activity-list`) from an earlier "browse public camps" direction. Those will be **deleted** at the end of this work — none survive into v1.

The visual treatment lifts from prod surfaces:

- Page chrome: [account/planners/client.tsx](src/app/account/planners/client.tsx) (My Planners) — `font-display font-extrabold text-3xl/4xl tracking-tight` h1, `text-ink-2` lede, primary pill `font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-ink text-ink-inverse border border-ink`.
- Row treatment: rounded-lg `border-ink-3 bg-surface p-4`, no drop shadow.
- Status pill spec (used inside the detail drawer, not the catalog row): [state-badge.tsx](src/components/planner/state-badge.tsx) — `font-sans text-[10px] uppercase tracking-wide px-2.5 py-1 rounded-full border border-ink font-semibold`, **black text on every variant**, status backgrounds from `--color-status-considering / -waitlisted / -registered`.
- Kid identity: [kid-shape.tsx](src/components/ui/kid-shape.tsx) — geometric shape (circle / square / triangle / diamond) by index, black-filled, white initial when size ≥ 20px.
- Hero yellow `--color-hero` is reserved for nav, the Registered pill, and rare featured moments. The "Help me find" CTA qualifies for one of those rare moments.

---

## Mental model (the load-bearing piece)

**Catalog = the master library.** Permanent, multi-year, all kids, durable. An activity exists here once.

**A planner = a focused working set** pulled from the catalog for a specific window (e.g., "Summer 2026"). The planner's "my activities" rail shows what's been pulled into *this* planner.

**Activities can live in the catalog without being on any planner.** Friend-shared items, Help-me-find results saved but not yet placed, last summer's camp you might rebook.

**Auto-add rule:** any activity placed on a planner without first being saved to the catalog auto-lands in the catalog. The catalog is the superset of (a) everything ever placed on any planner and (b) everything saved / shared / found via Help-me-find that hasn't yet been placed. This is already structurally true — `planner_entry` requires a `user_activity` — but the spec spells it out as a guarantee and verifies all add flows respect it.

**The "pull from catalog into a planner" flow** — used at planner creation and as an ongoing affordance — is **explicitly out of scope** for this spec. It's a planner-side change and gets its own design pass.

---

## In Scope (v1)

1. `/catalog` page: header, filter chip row, sort selector, unified list of two-row catalog cards.
2. Five filters: **Kid**, **Source**, **Type**, **Season**, **Category**. Three sorts: **Recently added** (default), **A→Z**, **Registration deadline**.
3. Kid attribution model: hybrid (manual + auto-tag on planner placement), with shape-marker + full-name visual.
4. Two intake CTAs: `+ Add activity` (paste URL or type manually — reuses existing flows) and `Help me find` (new LLM-backed web-search slide-over panel).
5. The Help-me-find slide-over — prompt input, opt-in context toggle with location-only fallback, draft results with per-result Save, plain-language web caveat. Hero yellow + sparkle treatment.
6. Detail view on row click — reuse [activity-detail-drawer.tsx](src/components/planner/activity-detail-drawer.tsx).
7. Empty state for the "Start your Catalog" landing.
8. Mobile responsive treatment (CTAs collapse, chips horizontal-scroll, sort selector compacts).
9. Delete the stale `src/components/catalog/*` files.

## Out of Scope / Deferred

- **Pull-from-catalog → planner flow.** Separate planner-side spec. The catalog spec stops at the catalog; the planner work is downstream.
- **Status as a catalog filter.** Status is planner-specific (lives on `planner_entry`). It's surfaced in the row's detail drawer per planner placement, never as a catalog-row pill or filter.
- **Cost / age / location filters.** Won't gate on optional fields users aren't required to populate.
- **Email forwarding as an intake path.** Post-v1; will slot in as a third "way" under `+ Add activity` when inbound email plumbing exists.
- **Per-camp share link.** Already deferred separately ([feature ideas/camp-detail.md](feature%20ideas/camp-detail.md)) — needs a public `/camps/[activityId]` route first.
- **Pagination / virtual scroll.** Catalogs at v1 launch are unlikely to hit a count where this matters. Re-evaluate if real users push 100+ rows.
- **Search input** for searching saved items. Filters do the work for v1.
- **Ranking / prioritization.** No "smart sort" on registration urgency until the deadline data is reliably populated.

---

## Feature 1: Page chrome

### Layout (desktop)

```
┌─────────────────────────────────────────────────────────────┐
│  Your catalog                          [+ Add activity]     │
│  Every camp, class & lesson —          [✦ Help me find ]    │
│  past, present, considering.                                │
├─────────────────────────────────────────────────────────────┤
│ [All kids] [Added by me] [Camp] [Summer] [Arts] [+ Filter]  │
│                                              Sort: Recents ▾│
├─────────────────────────────────────────────────────────────┤
│ ◯ Camp Galileo                              ◯ Maya          │
│   Galileo Camps · Camp · STEM · Summer 2026                 │
│   ─────────────────────                                     │
│   [On Summer 2026]                                          │
├─────────────────────────────────────────────────────────────┤
│ ◯ Soccer Shots Spring                       ▢ Theo          │
│   Soccer Shots BK · Class · Sports · Apr–Jun                │
│   ─────────────────────                                     │
│   [Shared by Rachel]                                        │
├─────────────────────────────────────────────────────────────┤
│ ◯ Brooklyn Ballet                           Unassigned       │
│   Brooklyn Ballet · Lesson · Arts · Fall 2026               │
│   ─────────────────────                                     │
│   [Reg closes Apr 30]                                       │
└─────────────────────────────────────────────────────────────┘
```

### Title cluster

- `<h1>` "Your catalog" — `font-display font-extrabold text-3xl sm:text-4xl text-ink tracking-tight` (matches My Planners).
- Lede: "Every camp, class & lesson — past, present, considering." — `text-ink-2 mb-8`.

### CTA cluster (top-right of header)

| CTA | Treatment | Behavior |
|---|---|---|
| `+ Add activity` | Outline pill: `bg-surface text-ink border border-ink rounded-full font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2` | Opens existing `add-activity-modal` (paste URL routes to `scrape-confirm-drawer`; type manually goes to manual entry). |
| `✦ Help me find` | **Hero yellow pill:** `bg-hero text-ink border border-ink ...` with leading sparkle SVG. | Opens the Help-me-find slide-over panel (Feature 4). |

### Filter chip row (horizontal)

Five filter chips, in this order: **Kid · Source · Type · Season · Category**. Each is a popover-anchored chip:

- **Default state:** the chip shows the dimension name plus current value (e.g., `All kids`, `Added by me`, `Type: Camp`). When a non-default value is selected, the chip flips to the active treatment (`bg-ink text-ink-inverse border-ink`).
- **Click:** anchored popover opens (reuse [anchored-popover.tsx](src/components/ui/anchored-popover.tsx)) with checkboxes / single-select per dimension.
- **`+ Filter`** trailing dashed-border chip: opens an "advanced filters" sheet for any dimension not already shown, when we have more than the default five (out of v1 — no advanced filters yet, so the chip can be omitted at launch and added when needed).

Specifics per filter:

| Filter | UX | Backed by |
|---|---|---|
| **Kid** | Multi-select checkboxes (one per kid), plus "Unassigned." Default: all selected. | `user_activity.kid_tags` (see Data Model). |
| **Source** | Single-select: "Added by me" / "From friends" / All. Default: All. | `user_activity.source` (see Data Model). LLM-found items count as "Added by me." |
| **Type** | Multi-select: Camp / Class / Lesson / Sport. | Derived from `activities.categories` mapped to type buckets, OR a new `activities.activity_type` if categories don't map cleanly. Decide at implementation. |
| **Season** | Multi-select buckets: This summer · This school year · Past · Custom range. Bucket boundaries derived from today's date. | Computed from `sessions.start_date` (or planner-entry date if no session). |
| **Category** | Multi-select chips matching the `Category` enum. | `activities.categories`. |

Filter state lives in URL search params so a filtered view is shareable and survives refresh.

### Sort selector (right of filter row)

Compact button: `Sort: Recently added ▾`. Clicking opens a small menu with:

- **Recently added** (default) — order by `user_activity.created_at desc`.
- **A → Z** — order by `activities.name asc`.
- **Registration deadline** — order by `activities.registration_end_date asc`, NULLs at the bottom. (Field doesn't exist yet — see Data Model.)

---

## Feature 2: Catalog row (two-row card)

Each row is one `user_activity`. Card shape: `rounded-lg border border-ink-3 bg-surface p-4`, no drop shadow. Spacing follows My Planners pattern (`space-y-3` between rows).

### Top portion

```
[●] Activity name                 ◯ Maya
    Org · Type · Category · Season
```

- **Activity color dot** (`w-2.5 h-2.5 rounded-full`) — uses `user_activity.color` (existing field; per-activity palette pastel).
- **Activity name** — `font-display font-extrabold text-base text-ink leading-tight`.
- **Meta line** — `font-sans text-xs text-ink-2`. Format: `org · type · category · season-or-dates`. Components fall back gracefully when missing.
- **Kid pill(s)** right-aligned at top — small shape marker (10–12px, no initial) + full kid name in `font-sans text-[11px] text-ink font-medium`. When unassigned, italic gray "Unassigned" placeholder. When 2+ kids, render side-by-side with 8px gap.

### Footer (rendered only when at least one badge applies)

`mt-3 pt-3 border-t border-[#eeeeee]` — same divider treatment as My Planners.

| Badge | When | Treatment |
|---|---|---|
| `On <planner-name>` | At least one `planner_entry` exists pointing at this `user_activity` on a non-archived planner. Multi-planner: show `On 2 planners`. | Dashed outline: `border border-dashed border-ink-3 bg-surface px-2 py-0.5 text-[9px] uppercase tracking-wide text-ink`. |
| `Shared by <Name>` | `user_activity.source = 'friend'` and `shared_by_name` populated. | Hero-light tint: `bg-[#fff5d4] border border-ink rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wide text-ink`. |
| `Reg closes <date>` | `activities.registration_end_date` is within 30 days. | Plain bordered pill: `border border-ink bg-surface ...`. |

If no badges apply, the footer (and divider) are not rendered; the card is just the top portion.

### Click behavior

Click the row → open existing [activity-detail-drawer.tsx](src/components/planner/activity-detail-drawer.tsx). Per-planner status (Considering / Waitlisted / Registered) is shown there, scoped to each planner placement, NOT on the catalog row.

The drawer needs a small extension: when opened from the catalog (no `planner_entry` context), it shows aggregate info — all planners this activity sits on, plus per-placement status. From the catalog there's no single status to show; statuses are listed per placement.

### Hover / pointer

- Hover: the row gets `hover:border-ink` (My Planners pattern).
- A small overflow `⋯` menu appears on hover (right side, replacing or below the kid pill on tight widths) with: "Edit," "Tag a kid," "Remove from catalog." Removal warns if `planner_entry` rows exist (same pattern as `MyActivitiesRail`'s remove confirm).

---

## Feature 3: Intake — `+ Add activity`

This reuses existing flows. No new UX surface unless we find friction in dogfooding.

- Click `+ Add activity` → existing `add-activity-modal`.
- The modal has two paths: paste a URL (→ `scrape-confirm-drawer`) and type manually.
- Both paths set `user_activity.source = 'self'`.
- After saving, the new `user_activity` appears in the catalog list immediately. Toast: "Activity added to your catalog."

**No additions in this spec** beyond making sure the toast and the list refresh both work from the catalog page.

---

## Feature 4: Intake — Help me find (the new thing)

### Trigger

`✦ Help me find` button in the catalog header (hero yellow pill with leading sparkle). Opens a right-side slide-over panel — width ~520–600px desktop, full-screen on mobile.

### Surface composition (top → bottom)

1. **Title row:** `Looking for ideas?` (Figtree extrabold, 19–22px) with a leading sparkle icon. Close button (`✕`) right-aligned.
2. **Lede:** *"Tell us what you're hoping to find — we'll pull some options."*
3. **Prompt input:** multi-line textarea (~3 lines visible, autoexpand). Placeholder example: *"Outdoor art camps for the summer, half-day, easy to get to from Park Slope."*
4. **Context opt-in:** a hero-light tinted box (`bg-[#fff5d4] border border-ink-3 rounded-lg`) with a checkbox and the question:

   > *"Use what we know about your **location**, **kids**, and **their interests**?"*

   Below the question, a derived snippet shows what would actually be passed: *"Maya (6) · Theo (4) · Park Slope · interests on file."*

   **Fallback ladder:**
   - No `profiles.address` → show inline mini-form: *"We need a starting point. Where should we look around?"* with an address input. Saving the address persists to `profiles.address` and re-geocodes (same path as the profile screen). Then proceed.
   - No kid details → use location only. Snippet says *"Park Slope · no kid details on file"*. Toast suggests adding kids when the user has time.

5. **Find button:** `Help me find` ink-pill (hero-yellow on the catalog header, but ink inside the panel — keep the panel calm; the marquee moment is the trigger). Full-width on mobile.

6. **Results list** (replaces the input area when populated, but the input stays visible above for refinement):

   - Section label: `Options · 5 found` (Outfit uppercase tracking-widest).
   - Each result card: white, `border border-ink-3 rounded-lg p-2.5`. Shows:
     - Title (Figtree extrabold, 13–14px).
     - Meta line: *"Org · Type · Category · Time-of-day · Age range · neighborhood (distance)"* — fields populated only when the LLM returns them.
     - URL (underlined, `text-[10px]`).
     - Trailing `+ Save` pill. On click → `Saved ✓` (background flips to `--color-status-registered` / `#5ac195`) and the result becomes a real `user_activity` row in the catalog.
   - Per-result *"Show on the web"* link opens the URL in a new tab.

7. **Footer caveat** (italic, ink-2, centered): *"These come from the web — double-check dates and registration before signing up."*

### Save flow per result

Clicking `+ Save` writes a new `user_activity` row with:

| Column | Value |
|---|---|
| `source` | `'self'` (LLM results count as "Added by me") |
| `discovery_query` | the prompt text (new column — see Data Model) |
| `kid_tags` | `[]` (catalog activities can be untagged; user tags after if desired) |
| `color` | next unused palette color (existing helper) |
| `created_at` | now |

The corresponding `activities` row is inserted with `source = 'llm'` and whatever fields the LLM populated. We don't try to canonicalize / dedupe LLM results against existing `activities` rows in v1 — risk of false positives. Dupes within a session are fine; the catalog filter will surface them.

### Backend — LLM call

- Stack: AI Gateway (per Vercel guidance) using `provider/model` strings, defaulting to a current Claude model.
- Endpoint: new `/api/help-me-find` server route.
- Input: prompt text + optional context object (kids, location, existing-catalog summary).
- Output: structured JSON of result objects validated with Zod.
- Tools: web search via the AI SDK web-search provider, scoped to recent results.
- Rate limit per user (e.g., 30 calls/day) — implementation detail, not part of this design.

### Iteration

- The user can edit the prompt and click `Help me find` again — replaces the result list. No multi-turn chat in v1.
- A "Show me more" button at the bottom of the results runs the same prompt again with a "different angle / additional 5" instruction. Out of v1 if it inflates scope; defer.
- No persisted query history in v1.

---

## Feature 5: Detail view (row click)

Reuse [activity-detail-drawer.tsx](src/components/planner/activity-detail-drawer.tsx) with a small extension:

- New entry point: `mode="catalog"` (or no `entryId`) — drawer hides single-status controls and shows an aggregate "On <n> planners" section listing each placement with its per-placement status pill.
- All other content (org, sessions, location, registration link, notes) renders identically to the planner-side drawer.
- The drawer's edit affordances (rename, kid retag, color change, remove from catalog) all work from this entry point and write to `user_activity` / `activities`.

---

## Feature 6: Empty state

When `user_activity` rows count is 0 (first-time user landing from the home `Start your Catalog` CTA):

- The page header renders normally (title, lede, both CTAs).
- The filter row is hidden.
- Below the header, a centered empty-state block:

  ```
  ┌──────────────────────────────────────┐
  │           [icon: stack of cards]     │
  │                                      │
  │  Your catalog is empty.              │
  │  Add an activity, or let us help     │
  │  you find some.                      │
  │                                      │
  │   [+ Add activity]  [✦ Help me find] │
  └──────────────────────────────────────┘
  ```

- Both CTAs duplicate the header CTAs. The hero-yellow Help me find sits beside the outline Add — same spatial relationship as the header.
- No "drag activities here" or "shake your phone to add" cleverness. Simple is fine.

---

## Feature 7: Mobile responsive

| Element | Mobile treatment |
|---|---|
| Title cluster | Stays as-is, font sizes scale via existing `text-3xl sm:text-4xl`. |
| CTAs | Stack below the lede full-width (Add on top, Help me find below — Help me find stays hero-yellow). |
| Filter chips | Horizontal scroll, no wrap. Active chips stay leftmost; the chip row is `overflow-x-auto` with momentum scrolling. |
| Sort selector | Becomes a small icon-button (`↕`) that opens the same menu in a bottom sheet. |
| Catalog rows | Same two-row card; kid pill drops below the meta line if width is too tight. |
| Help me find slide-over | Opens as a full-screen modal-ish sheet (top of the viewport, dismiss by swiping down or tapping `✕`). |

---

## Data Model

### New columns on `user_activity`

```sql
alter table user_activity
  add column source text not null default 'self'
    check (source in ('self', 'friend', 'llm')),
  add column shared_by_name text,
  add column shared_by_user_id uuid references auth.users(id),
  add column kid_tags uuid[] not null default '{}',
  add column discovery_query text;
```

- `source` distinguishes "Added by me" (self / llm) from "From friends" (friend). The Source filter maps `self ∪ llm → "Added by me"` and `friend → "From friends"`.
- `shared_by_name` is the friend's display name at share time (denormalized so we don't need to look up their profile).
- `shared_by_user_id` is the friend's actual user ID when they're a Kidtinerary user (nullable for SMS / email shares from non-users).
- `kid_tags` is the multi-kid attribution. Auto-populated when a `planner_entry` is created in a kid's column (trigger or app-level — implementation detail).
- `discovery_query` keeps the LLM prompt text on results saved from Help me find — useful later for "find more like this" features.

### New column on `activities`

```sql
alter table activities
  add column registration_end_date date,
  add column registration_start_date date,
  add column origin text not null default 'manual'
    check (origin in ('manual', 'scrape', 'llm', 'submit'));
```

- `registration_end_date` — required for the "Registration deadline" sort and the row's `Reg closes` badge. Field is nullable; rows without a value are sorted last and never trigger the badge.
- `registration_start_date` — pairs with end date for future "registration opens" alerts (per [feature ideas/camp-detail.md](feature%20ideas/camp-detail.md)). Included now to avoid a second migration; not surfaced in v1 UI.
- `activities.origin` distinguishes provenance — used for analytics + future scrape vs manual UX (e.g., "verified by org"). Named `origin` (not `source`) to avoid colliding with `user_activity.source`, which describes how *this user* came to have this in their catalog (self / friend / llm), not how the activity row itself was created.

### Auto-tag trigger (or app-level write)

When a `planner_entry` is inserted with `kid_id = X` and the parent `user_activity.kid_tags` does not include `X`, append `X` to `kid_tags`. Implementation can be:

- A Postgres trigger on `planner_entry` insert (cleanest, atomic).
- App-level write inside `placeActivityOnCell` action.

Trigger approach preferred. A migration writes both the trigger and a backfill to populate `kid_tags` from existing `planner_entry` rows.

### Source filter SQL sketch

```sql
-- source = 'me'   → user_activity.source IN ('self','llm')
-- source = 'friends' → user_activity.source = 'friend'
```

### Indexes

```sql
create index idx_user_activity_kid_tags on user_activity using gin (kid_tags);
create index idx_user_activity_source on user_activity (source);
create index idx_user_activity_created_at on user_activity (created_at desc);
create index idx_activities_registration_end on activities (registration_end_date);
```

### RLS

`user_activity` and `activities` already have RLS (per migrations 014, 020, 021). New columns are covered by the existing row policies; no policy changes needed unless `shared_by_user_id` introduces a new visibility case (it doesn't — the friend's id is read-only metadata on the recipient's row).

---

## Component plan

### New files

- [src/app/catalog/page.tsx](src/app/catalog/page.tsx) — replace placeholder with the catalog page (server component fetches `user_activity` joined with `activities`, `sessions`, planner-placement summary).
- [src/app/catalog/client.tsx](src/app/catalog/client.tsx) — client wrapper for filter / sort / row list state. URL search-params backed.
- [src/components/catalog/catalog-row.tsx](src/components/catalog/catalog-row.tsx) — the two-row card.
- [src/components/catalog/filter-bar.tsx](src/components/catalog/filter-bar.tsx) — chip row + sort menu.
- [src/components/catalog/kid-filter.tsx](src/components/catalog/kid-filter.tsx), `source-filter.tsx`, `type-filter.tsx`, `season-filter.tsx`, `category-filter.tsx` — anchored-popover-backed filter chips. (Or one polymorphic component — implementation choice.)
- [src/components/catalog/empty-state.tsx](src/components/catalog/empty-state.tsx).
- [src/components/catalog/help-me-find-panel.tsx](src/components/catalog/help-me-find-panel.tsx) — the slide-over.
- [src/app/api/help-me-find/route.ts](src/app/api/help-me-find/route.ts) — server route that calls AI Gateway.

### Files to delete (old direction)

- `src/components/catalog/activity-list.tsx`
- `src/components/catalog/address-input.tsx`
- `src/components/catalog/filter-sidebar.tsx`
- `src/components/catalog/search-bar.tsx`
- `src/components/catalog/search-filter-panel.tsx`
- `src/components/catalog/sort-bar.tsx`

These are the public-discovery scaffolding from before the model flipped to "personal library." None are imported by anything live.

### Files to extend (small)

- [src/components/planner/activity-detail-drawer.tsx](src/components/planner/activity-detail-drawer.tsx) — add `mode="catalog"` / aggregate-status section for catalog-entry callers.
- [src/lib/queries.ts](src/lib/queries.ts) — `fetchUserActivities` returns the joined shape the catalog needs (kid tags, planner placements, source, shared_by_name).
- [src/lib/actions.ts](src/lib/actions.ts) — `saveHelpMeFindResult(payload)`, `tagKidOnUserActivity(userActivityId, kidId)`, `untagKidOnUserActivity(...)`, `setUserActivitySource(...)` (mostly internal).

### Existing patterns to lift wholesale

- Anchored popovers: [anchored-popover.tsx](src/components/ui/anchored-popover.tsx).
- Toast: [src/components/ui/toast.tsx](src/components/ui/toast.tsx).
- Confirm modals: pattern from `MyActivitiesRail`'s remove-confirm and `DeletePlannerConfirm`.
- Slide-over chrome: there isn't a reusable slide-over yet; build one minimally inside `help-me-find-panel.tsx` first, factor out only if a second consumer appears.

---

## Open implementation questions (not blockers)

1. **`type` filter source.** Whether to derive Camp / Class / Lesson / Sport from `activities.categories` mapping, or add a new `activities.activity_type` column. Decide in a follow-up after looking at how cleanly the existing categories map. If categories cluster cleanly, derivation is cheaper.
2. **LLM web-search reliability.** Help-me-find is at the mercy of the LLM's web-search quality. We accept whatever it returns; sparse fields are OK. Failure mode: "we couldn't find good options — try a different prompt." Worth a quiet QA pass once wired.
3. **Auto-tag trigger vs. app-level write.** Trigger is cleaner but harder to debug / change. App-level write inside `placeActivityOnCell` action is more discoverable. Pick at implementation time after looking at how many entry points place activities.
4. **Kid-tag durability on planner-entry deletion.** If you place Camp Galileo for Maya then remove the placement, does the kid_tag persist? Default: **yes** — historical attribution is durable; user can manually untag via the row overflow menu. Worth confirming during implementation if it feels wrong.
5. **Pagination threshold.** No pagination at v1. Re-evaluate once a user crosses ~80 rows; we'll know from telemetry.

---

## Success criteria

- A user landing on `/catalog` from `Start your Catalog` (home CTA) can: add an activity manually, find one with Help me find, save it, and see both rows in the catalog list within seconds.
- An existing user with 5+ activities can apply two filters (e.g., "Maya" + "Summer") and the URL is shareable.
- The catalog row's `On Summer 2026` badge is in sync with planner placement at all times — placing or removing on the planner updates the catalog row's footer without a refresh (or with a `router.refresh()` round-trip; soft real-time is fine).
- Auto-add rule holds: any planner placement that pre-exists in the database results in a corresponding catalog row.
- Help me find returns 5 options for a representative prompt within ~10s, with a sensible failure state when zero results are found.

---

## Phasing

**One bundle.** All features ship together. Order within the bundle:

1. Migrations (`user_activity` + `activities` columns, indexes, auto-tag trigger, backfill).
2. Catalog page + row + filters + sorts + detail drawer extension.
3. Empty state.
4. Help me find slide-over + `/api/help-me-find` route.
5. Mobile responsive pass.
6. Delete stale `src/components/catalog/*` files.
7. QA: verify all add flows respect the auto-add rule.

Each step ships behind no flag — Kidtinerary doesn't gate features on flags today, and the homepage already promises this surface exists. The goal is for `Start your Catalog` to land on a real catalog the same day this merges.
