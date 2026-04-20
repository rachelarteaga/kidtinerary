# Planner Hero Redesign — Design Spec

**Status:** draft for review
**Date:** 2026-04-20
**Context:** scraping/discovery moves to a secondary future feature; the planner becomes Kidtinerary's hero.

## Problem

The current planner requires parents to favorite camps from the Explore page before they can drag them into weeks. That two-step flow assumes discovery is the primary job. In practice, parents usually already know which camps they're considering (kids went there before, a friend mentioned it, etc.) — they just want to tell Kidtinerary and have it populate the plan. The current planner also shows one child at a time via tabs, which hides the parent's key challenge: matching camps across multiple kids.

## Goals

1. Make the planner the primary entry point. Users never need to leave it to add a camp.
2. Add a camp with minimum input — name or URL — and let the scraper fill in details asynchronously.
3. Make multi-kid planning first-class — visible cross-kid matching, per-kid independent states.
4. Accommodate non-camp time (school, travel, at-home, other) without hacks.
5. Crowd-source the verified camp directory as a side effect of normal use.

## Non-Goals

- Rebuilding the public sharing flow (`/schedule/[token]`) — unchanged in this release, revisited in a follow-up brainstorm.
- Overhauling visual design (colors, typography, motion) — separate brainstorm + pass after this lands.
- Expanding discovery (Explore page stays behind a "coming soon" state; we quietly build the directory from user-added camps).
- Replacing the favorites table with a migration — data migrates but no user-visible favorites UI survives.

## Key User Flows

### Flow 1: Parent already knows the camp

1. Parent lands on `/planner`. Sees weeks × kids matrix.
2. Clicks `+ Add camp` in a specific kid's cell for a specific week (or the global `+ Add camp` button).
3. Types "Camp Kanata" (or pastes a URL) and submits.
4. Camp card appears **immediately** with just the name and a loading state. Status = considering.
5. Scrape runs in the background (optimistic async). Within ~10–15s, details populate: price, time, location, age range, session dates.
6. Parent sees final card; can change status to waitlisted or registered; can click for details.

### Flow 2: Same camp for multiple kids

1. Parent adds "Camp Kanata" for Camila on week of Jun 22. Scrape returns all 8 weekly sessions.
2. Parent clicks `+ Add camp` in Mateo's cell for the same week; autocomplete suggests Camp Kanata (already scraped, cached).
3. One click, Mateo's cell fills with the age-appropriate session variant (junior track, since Mateo is 5).
4. Both cells show a **✦ shared w/ [name]** badge; subtle green background across the row.

### Flow 3: Non-camp block

1. Parent clicks global `+ Add block` or `+ Add` in a specific cell and picks "Block".
2. Picks type: 🏫 School · ✈ Travel · 🏡 At home · ⭐ Other.
3. Fills title, date range (may span multiple weeks), selects which kids it applies to (multi-select chips).
4. Block renders across affected weeks for affected kids. Year-round school is one long-range entry rendered on every week within range.

### Flow 4: Scrape confidence fallbacks

- **High confidence** — card populates, no question asked.
- **Partial** — card populates with what we have; inline "Add missing details?" prompt on the card.
- **Ambiguous** — card shows "We found 3 camps matching — is it this one?" with candidate chips.
- **Nothing found** — card stays as a stub with just the name; "Paste a URL or fill in manually" prompt on the card. Parent can still use it in the planner.

## Layout

**Desktop (≥768px):** weeks-down × kids-across matrix.

```
              [Camila ⋮⋮]   [Mateo ⋮⋮]    [Sofia ⋮⋮]
              avatar         avatar         avatar
Jun 22–26     Camp Kanata    Camp Kanata    + Add
              ✦ shared       ✦ shared
Jun 29–Jul 3  Art Studio     + Add          Sailing Camp
Jul 6–17      ✈ Family trip — Outer Banks (spans all columns)
Jul 20–24     + Add          🏡 Grandma      + Add
```

- Kid columns are **reorderable** via drag handle (⋮⋮) in header. Order saved to parent's profile.
- Each kid has an **avatar** — auto-generated initial + assigned color, optionally replaced with an uploaded photo. Color is used as a subtle accent throughout the UI (column stripe under header, consent chip colors).
- Shared camps (same camp/session family across kids in same week) get a **✦ shared w/ [name]** badge and a soft green background tint.
- Blocks that apply to all kids span the full row as a single cell. Partial-kid blocks fill only the targeted kid columns.
- Per-cell **`+ Add`** button on empty cells — opens a modal pre-scoped to that kid × week, with a Camp/Block toggle.

**Mobile (<768px):** collapses to single-kid view with a kid selector at top (chips or horizontal scroll tabs). Same data, different rendering — all reorder/add actions preserved.

**Global actions** above the matrix: `+ Add camp`, `+ Add block`. These open the add flows without pre-scoping kid or week (parent chooses in the modal).

## Add Camp Flow

### Input
Single field. CTA: **"Tell us the camp name or drop a URL."** Placeholder: `"YMCA Camp Kanata · sciencecamp.com · Art Studio Summer"`.

If input looks like a URL (starts with http, contains a dot + no spaces) → scrape that URL directly. Otherwise → treat as search text, web search + scrape the best result.

### Upfront guidance (passive / free)
- **Location**: parent's address from profile fed to the scraper as a regional disambiguator. If parent hasn't set an address, prompt once on first add.
- **Kid age**: the target kid's birthday fed to the scraper/session-matcher to pick the right age-track.
- **Week context**: when adding from a specific cell, we already know the target week — scraper prioritizes sessions overlapping that week.

### Upfront guidance (active)
- **DB autocomplete** — debounced (~200ms) query against `activities` table as parent types. Hits render as chips; one click uses the cached camp and skips scraping entirely.
- **Optional URL helper text** under the input: "Got a link handy? Paste it for the best match." No separate field — same input.

### Optimistic async scrape
1. On submit, immediately create a planner entry with status `considering` and a temporary activity stub (name = user input, other fields null).
2. Add a row to a new `scrape_jobs` table (or reuse existing scraper queue) with the input and context (location, kid age, target week).
3. UI shows the entry with a loading skeleton for fields that are scraping.
4. When the scraper completes, it upserts into `activities`/`sessions` as usual, then the planner entry is updated to point at the real session. UI updates via polling: client polls the scrape_job status every 2s for up to 90s on the active entry; after that, falls back to a manual refresh affordance. (Realtime subscriptions deferred — polling is simpler for MVP and the wait is bounded.)
5. If scrape confidence is low or ambiguous → fallback UX (see "Scrape confidence fallbacks" below).

### Scrape confidence fallbacks
| Scenario | Treatment |
|---|---|
| High confidence, 1 match | Silently finalize. |
| Partial (missing fields) | Finalize with nulls. Card shows "Add missing details?" prompt. Parent can tap to manually fill or paste a URL for re-scrape. |
| Ambiguous (multiple candidates) | Card shows 2–3 candidate chips inline: "We found — pick the right one?" One click resolves. |
| Nothing found / very low confidence | Card stays as stub. Prompt: "We couldn't find details. Paste a URL or fill in manually." Parent can use the stub in the planner as-is. |

### Consent to share
When the parent submits, a small inline checkbox appears below the input:
> "Share this camp with Kidtinerary's directory so other parents can find it. We'll verify the details before publishing. ☑ Yes (default)"

Parent can uncheck. A global "Always share camps I add" toggle in settings. The flag is stored per-submission on `scrape_jobs` (or whatever queue table) — camps with consent go into a moderation queue; camps without consent stay private to the user.

## Add Block Flow

Button: **`+ Add block`** (top-level) or pick "Block" in the per-cell modal.

### Step 1: pick type
Four preset cards:
- 🏫 **School** — year-round school overlapping camp season
- ✈ **Travel** — trips, visiting family
- 🏡 **At home** — parent time, off weeks
- ⭐ **Other** — custom label + emoji

### Step 2: fill details
- **Title** (text, required) — e.g., "Outer Banks trip", "Year-round school"
- **Date range** (start + end, required) — can span multiple weeks
- **Who it applies to** (kid multi-select chips, pre-filled to all kids for global add, pre-filled to current kid for per-cell add)
- **Custom emoji** (only for "Other" type)

### Rendering
- Block card uses the type's color family (amber for school, purple for travel, warm neutral for at home).
- Recurring blocks: one long-range entry (e.g., Aug 2026 – May 2027 for school). Renders on every week within the range. No recurrence UI.
- If block applies to all kids: spans full row as single cell.
- If block applies to subset: fills only those columns; other kids see `+ Add` as normal.

## States

Per planner entry (per kid × camp × week):

| State | Meaning | Visual |
|---|---|---|
| `considering` | parent is thinking about it (default on add) | neutral card |
| `waitlisted` | parent applied; pending a spot | amber dot + "pending" pill |
| `registered` | spot confirmed / paid | green accent + check mark |

States are **independent per kid** for the same camp × week — one sibling can be registered while the other is waitlisted. UI reflects this per-cell.

**Removal** is a delete, not a cancelled state (removes the planner entry).

**Export to calendar (.ics)**: only `registered` entries export by default. Waitlisted export is an open question (see below).

## Data Model Changes

### New tables
- `scrape_jobs` — queue for on-demand scraping with optimistic async flow.
  - Columns: `id`, `user_id`, `input` (text: name or URL), `context` (jsonb: target_kid_id, target_week, location_hint), `status` (queued/running/resolved/failed), `activity_id` (set once resolved), `confidence` (high/partial/ambiguous/none), `consent_share` (bool), `created_at`, `resolved_at`.

- `planner_blocks` — non-camp blocks.
  - Columns: `id`, `user_id`, `type` (school/travel/at_home/other), `title`, `emoji` (for "other"), `start_date`, `end_date`, `created_at`.

- `planner_block_kids` — which kids a block applies to (join table).
  - Columns: `block_id`, `child_id`, primary key composite.

### Modified tables
- `children` — add `color` (text), `sort_order` (int), and `avatar_url` (text, nullable). Color assigned on first save from a fixed palette (see Open Questions); avatar photo optional, stored in Supabase Storage `avatars/` bucket.
- `planner_entries` — rename `status` enum from `penciled_in|locked_in|cancelled` to `considering|waitlisted|registered`. Drop `cancelled` — use delete instead. Migrate existing rows: `penciled_in`→`considering`, `locked_in`→`registered`, `cancelled`→delete.
- `profiles` — add `share_camps_default` (bool, default true) for the global consent preference.
- `activities` — add `verified` (bool, default false) and `verified_at` (timestamptz, nullable). User-submitted camps start unverified; moderation flips the flag.

### Migrations
- `010_planner_hero_schema.sql` — creates new tables, modifies existing, migrates data.

### Data migration: favorites
The `favorites` table is retired as user-facing concept. Migration: convert each favorite into a no-session planner entry for the user's first kid with status `considering`. This ensures no data loss; users see their favorites as "My Camps" shortlist entries. (Open: what if a favorite is unmatched to any kid? Default to first kid chronologically; user can reassign.)

## Component Architecture

### New components
- `src/components/planner/matrix.tsx` — the weeks × kids grid shell. Consumes entries + blocks, renders rows.
- `src/components/planner/kid-column-header.tsx` — avatar, name, age, reorder handle.
- `src/components/planner/planner-cell.tsx` — per-cell rendering (empty → "+ Add" button, filled → card view).
- `src/components/planner/add-camp-modal.tsx` — unified add flow with input, autocomplete, consent checkbox.
- `src/components/planner/add-block-modal.tsx` — type picker + details form.
- `src/components/planner/shared-badge.tsx` — "✦ shared w/ X" pill.
- `src/components/planner/block-card.tsx` — block rendering (type-colored, spans full row or subset).
- `src/components/planner/camp-card.tsx` — camp entry with status toggle, loading states, confidence fallback UI.
- `src/components/planner/state-badge.tsx` — 3-state pill (considering / waitlisted / registered).

### New server actions (`src/lib/actions.ts`)
- `submitCampSearch(input, context, consentShare)` — creates scrape_job + placeholder entry; returns job id.
- `addPlannerBlock(blockData)` — creates block + kid join rows.
- `updatePlannerEntryStatus(entryId, status)` — now 3 states; updates accordingly.
- `removePlannerEntry(entryId)` — hard delete (replaces the "cancelled" soft delete).
- `reorderKidColumns(order)` — persists the kid column order for the parent.
- `updateChildColor(childId, color)` — color picker on kid profile.

### Scraper changes (`src/scraper/`)
- New entry point: `scrapeOnDemand(input, context)` — runs immediately rather than queued, short-circuits if cache hit, writes back to `scrape_jobs`.
- Add confidence scoring to the result: `high` / `partial` / `ambiguous` / `none`. Drives the fallback UX.
- Honor the consent flag: non-consented scrape results still cache for the user's personal use but skip moderation queue.

### Retired routes
- `src/app/favorites/page.tsx` — delete. Redirect to `/planner`.
- `src/app/submit/page.tsx` — delete. Redirect to `/planner` with a hint banner "Add camps directly from your planner now."
- `src/app/explore/page.tsx` — replace page contents with a "coming soon" stub.

## Crowd-Sourced Directory

- User-added camps with consent flag = true go into a moderation queue (same scrape_jobs table with a `moderation_status` column).
- Verification pipeline (MVP): a human reviewer (you) spot-checks borderline ones; high-confidence scrapes auto-approve.
- Once verified, the camp flips `activities.verified = true` and appears in autocomplete for other users.
- Future: build out a proper moderation dashboard. For MVP, a simple CLI script listing unverified camps is enough.

## Error Handling & Edge Cases

- **Scrape fails entirely (404, timeout, LLM error)**: mark scrape_job as failed, leave the planner entry as a stub, show the "nothing found" fallback UX. Parent's entry is not lost.
- **Duplicate camp**: if a parent adds a camp that matches an existing `activities` row (slug match or fuzzy name+location match), reuse the existing activity; don't re-scrape.
- **Multi-kid same session**: when a parent adds a camp for Kid A, and then for Kid B in the same week, link both entries to the same `session` row (or the age-appropriate variant). Shared badge appears automatically.
- **Block collides with camp**: parent adds a travel block for a week where a camp is also registered. Show a warning: "Camp is still registered for this week — remove?" Don't auto-delete.
- **Kid has no birthday set**: block age-based session matching; prompt user to fill in.
- **Parent has no address**: scraper runs without location hint; may return ambiguous results more often. Prompt for address on first add.

## Testing Strategy

- **Unit tests**: confidence scoring, session matching across ages, block date-range rendering logic, shared-badge detection.
- **Integration**: scrape_job lifecycle (queued → resolved/failed → entry updated), favorites migration.
- **E2E (manual for MVP)**: add camp by name → entry appears → scrape completes → card populates. Repeat for URL, ambiguous, partial, failed.

## Out of Scope (explicit)

- Public sharing flow overhaul — follow-up brainstorm.
- Visual design system overhaul (colors, typography, motion) — follow-up brainstorm + application pass after this ships.
- Recurrence beyond "one long-range block" — no daily/weekly recurrence patterns.
- Granular registration workflow (deposit, paid-in-full, etc.) — 3 states is the MVP.
- Moderation dashboard UI — CLI script suffices for MVP.

## Open Questions

- **Favorites migration ambiguity**: if parent has multiple kids and favorited a camp before this release, which kid does the migrated planner entry attach to? Proposed: first kid by `sort_order`; parent can reassign. Confirm or propose alternative.
- **Waitlist in .ics export**: export tentative events or skip? Proposed: export with `STATUS:TENTATIVE`. Confirm.
- **Default kid colors palette**: pick a 6–8 color palette upfront or defer to design overhaul? Proposed: ship a simple palette now (orange, green, blue, purple, teal, rose), revisit in design pass.

## Sequencing

1. Plan + build the planner against current design tokens *(this spec)*.
2. Launch to self + friend. Get feedback.
3. Separate brainstorm: full design system overhaul.
4. Apply new design to planner + rest of app.
5. Separate brainstorm: sharing flow overhaul.
