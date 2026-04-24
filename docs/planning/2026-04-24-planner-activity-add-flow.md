# Planner +Add flow redesign & camp → activity rename

**Date:** 2026-04-24
**Status:** Design approved, ready for implementation plan

## Problem

The `+Add` button on empty week cells opens a modal that only offers *adding a brand-new camp*. Users who haven't discovered the drag-and-drop affordance on the My Camps rail have no path from the cell's `+Add` to their existing saved activities. Symptom: users expect `+Add` to surface a list, don't find one, and either bounce or re-add activities they've already saved.

Secondary issue uncovered during design: the product has inconsistent nomenclature. The canonical DB entity is `activities`, but the UI layer uses "camp" in buttons, module titles, and code identifiers. We're unifying on **activity** at the UI + code-identifier layer; the DB schema stays.

## Goals

1. Make the user's saved activities discoverable directly from the cell `+Add` flow.
2. Preserve the existing "add new" path inline so it's still one modal, not a chooser step.
3. Mirror drag-drop behavior — one tap places at default status.
4. Rename `camp` → `activity` in button copy, module titles, and code identifiers. Keep DB schema and descriptive marketing copy untouched.

## Non-goals

- No change to the header's global `+Add` (no week scope). Stays as add-new-only.
- No change to the `Block` tab.
- No change to DnD rail behavior.
- No DB migration.
- No search/filter inside the in-modal list. If the rail grows long, revisit later.
- No status picker in the modal. User picks status after placement, same as today.

---

## Part 1: +Add flow redesign (cell-scoped)

### Trigger condition

The new layout applies only when the modal opens with a defined `scope.childId` AND `scope.weekStart` — i.e., the user clicked `+Add` on an empty cell, or dropped onto it via keyboard flow. Top-level header `+Add` (scope nulls) keeps the current layout.

### Structure of the `Activity` tab (renamed from `Camp`)

```
┌─────────────────────────────────────────────┐
│  [ Activity ]  [ Block ]              ✕     │
├─────────────────────────────────────────────┤
│  FROM MY ACTIVITIES                         │   ← section header, uppercase tracking
│  ┌─────────────────────────────────────┐    │
│  │ ● Camp Kanata                       │    │   ← tappable row, same visual as rail
│  │   YMCA of the Triangle              │    │     (color dot, name, org, badges)
│  │                     2x · verified   │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ ● Robotics at Blue Ridge            │    │
│  │   Blue Ridge School                 │    │
│  └─────────────────────────────────────┘    │
│   …scrollable, max-height ~240px            │
│                                             │
│  ─────────────  OR ADD NEW  ─────────────   │   ← divider
│                                             │
│  [URL field + Org + Activity name form]     │
└─────────────────────────────────────────────┘
```

### Behavior

- List items render the same info as the rail (color dot, activity name, org name when distinct, `Nx` placement count, verified badge).
- **Tap = place at default status ("considering").** One tap on a row places the entry and closes the modal. No status-picker popover, no confirm step. The user can change status afterward via the existing entry's status picker.
- **Note on divergence from DnD:** today, a drag-drop (and mobile tap-to-place) opens the cell-anchored `StatusPickerPopover` so the user picks status at drop time. The modal flow intentionally skips this popover — the user already committed to placement by opening the modal and tapping a row, so an additional status step adds friction without value. Status is still mutable after placement.
- List is scrollable internally with a bounded max-height (~240px) so the "add new" form stays in view.
- **Empty My Activities:** hide the "FROM MY ACTIVITIES" section entirely and render only the add-new form (no empty-state noise — the user is already in "add new" mode at that point).
- **Loading/stale state:** list is server-rendered from the same `userCamps` prop the rail consumes, so no async fetch — renders instantly.

### Placement pathway

Call `assignCampToWeek(plannerId, userCampId, childId, weekStart)` directly with no `status` arg (defaults to `"considering"`). Close the modal on success; `router.refresh()` to re-render with the new entry. This is the same server action DnD uses — the only difference is the modal path skips the intermediate popover.

### Mobile

Cells still render `+Add` on mobile; tapping it opens this same modal. The list-in-modal flow becomes an *alternative* to the bottom-sheet tap-to-place flow — both converge on the same placement action. No behavior removal.

### Component boundary

- **`AddEntryModal`** — accepts `scope` (already does). Decides whether the scoped layout applies by checking `scope.childId && scope.weekStart`.
- **New: `ActivityPickerSection`** — receives `userActivities` and `onPick(userActivityId)`. Pure presentation; renders the list or nothing.
- **`AddActivityModal`** (renamed from `AddCampModal`) — accepts an optional `embeddedPicker?: React.ReactNode` slot to render above the form, so the modal composes picker + form without tightly coupling them.
- **`AddEntryModal`** wires them: passes the picker to `AddActivityModal` only when the scope is cell-scoped.

---

## Part 2: camp → activity verbiage rename

### Rule

Button copy and module/component titles use `activity`. Descriptive copy where "summer camps" is a natural example stays as-is. Code identifiers (files, exports, props, variables) match the UI change. DB schema does not change.

### UI copy changes

| Location | Before | After |
|---|---|---|
| Rail title | `My camps` | `My activities` |
| Rail add button | `+ Add camp` | `+ Add activity` |
| Mobile sheet pill | `My Camps` | `My Activities` |
| Add-entry modal tab | `Camp` | `Activity` |
| Add modal title | `Add a camp` | `Add an activity` |
| Camp-name form field | `Camp name` | `Activity name` |
| Remove confirm | `…from your My Camps list` | `…from your My Activities list` |
| Cell placement banner | any `camp` → `activity` | — |
| Scrape confirm drawer | any user-facing `camp` → `activity` | — |

### UI copy that stays

- Landing page copy that references "summer camps" as an example category.
- Any hero/marketing blurbs where "camp" is content, not UI chrome.
- Email templates — audited case-by-case with the same rule.
- Add modal tagline (`Drop a URL and we'll fill in the rest…`) — no "camp" word in it anyway.
- Empty rail hint (`Nothing yet — add one above.`) — descriptive.

### Code identifier renames (module-level)

| Before | After |
|---|---|
| `src/components/planner/my-camps-rail.tsx` | `my-activities-rail.tsx` |
| `src/components/planner/add-camp-modal.tsx` | `add-activity-modal.tsx` |
| `MyCampsRail` | `MyActivitiesRail` |
| `AddCampModal` | `AddActivityModal` |
| `onAddCampClick` prop | `onAddActivityClick` |
| `onCampSubmitted`, `onCampPlacementTap` | `onActivitySubmitted`, `onActivityPlacementTap` |
| `userCamps`, `UserCampWithActivity` | `userActivities`, `UserActivityWithDetails` |
| `submitCamp`, `removeCampFromShortlist` actions | `submitActivity`, `removeActivityFromShortlist` |
| `quickViewCampId`, `placementCamp` state | `quickViewActivityId`, `placementActivity` |

### Code identifiers that stay

- DB schema: `user_camps` table, `user_camp_id` columns, Supabase RLS policies — untouched.
- `activities` canonical table — already correctly named.
- API routes: `/api/activities/search` already right; any `/api/camps/...` routes get renamed (no external consumers expected — internal to app). If external consumers exist, leave the old path behind a redirect stub.
- Scrape job DB-adjacent fields (e.g. any `camp_url` column) — stay at DB boundary.

---

## Implementation sequencing

Intended as separate commits to keep the diff reviewable. Exact grep lists deferred to the implementation plan.

1. **Add-flow redesign (pre-rename).** Implement `ActivityPickerSection` and wire it into `AddEntryModal` / `AddCampModal`. Component still named `AddCampModal` at this stage — rename happens in later commits. Verifies the new behavior in isolation.
2. **Rail rename.** `my-camps-rail.tsx` → `my-activities-rail.tsx`; component + props renamed; call sites updated.
3. **Modal + action rename.** `add-camp-modal.tsx` → `add-activity-modal.tsx`; `submitCamp` / `removeCampFromShortlist` renamed; all imports/call sites updated.
4. **State + variable rename.** `userCamps`, `UserCampWithActivity`, `quickViewCampId`, `placementCamp`, etc. across client.tsx and related files.
5. **Copy sweep.** Remaining UI copy hits across the app per the rule above. One final grep for remaining `camp` occurrences to audit each as UI-copy / descriptive / code-identifier already handled / DB-boundary-keep.

---

## Testing

- **Unit/component:** `ActivityPickerSection` renders rows, tap fires callback, empty state hides header.
- **Integration:** cell `+Add` modal with a seeded `userCamps` list shows the picker; top-level `+Add` modal does not.
- **E2E (existing planner tests):** tap a list item in the scoped modal → entry appears on the correct week for the correct kid with default status.
- **Rename verification:** `rg -i '\bcamp\b' src/` pass, with each remaining hit categorized (DB-boundary / descriptive-copy / intentional).

---

## Open questions

None at design-approval time. Any ambiguity on a specific copy or identifier location gets resolved in the implementation plan's grep-sweep step against the rule in Part 2.

---

## Rename audit — 2026-04-24

Final grep for `camp[s]?` across `src/` after B1–B7. Every remaining hit falls into one of the allowed "keep" categories:

### DB enum / routing (stays)
- `src/lib/actions.ts:1684` — `scope: "camp"` share-scope enum value
- `src/lib/queries.ts:483,503,506` — share-scope enum value / discriminated-union literal
- `src/app/schedule/[token]/page.tsx:19-20` — matches on `result.type === "camp"` and redirects to `/camps/{id}` path (URL scheme is a larger rename out of scope)

### Descriptive / marketing copy (stays per spec rule)
- `src/app/layout.tsx:22,24` — meta title + description, "summer camps" as example category
- `src/app/page.tsx:12,49` — landing page marketing copy
- `src/app/catalog/page.tsx:8` — catalog landing descriptive text
- `src/components/account/edit-profile-form.tsx:76` — "Used to find nearby camps." hint text below home-address field

### Scraper / infrastructure (stays — internal to pipeline, prompts, DOM selectors, URLs)
- `src/app/globals.css:21-25` — `--color-camp-*` design tokens (compiled CSS refs)
- `src/lib/camp-palette.ts` — whole module: rail palette generator (file name + internal comments)
- `src/lib/actions.ts:5,11` — imports from `camp-palette` and `submit-camp-validation` infra modules
- `src/lib/queries.ts:592` — internal code comment
- `src/lib/ics.ts:40` — internal code comment
- `src/scraper/**` — all entries (URL templates, DOM selectors, LLM prompt text, stopword lists, search query strings, internal comments). LLM prompt text must not change or the extractor breaks.

### Component-local plain-data `camp` prop (stays per spec)
- `src/components/planner/shared-activity-detail-panel.tsx` — the `camp` prop on `SharedActivityDetailPanel` takes a plain `{ org, name, location, url, about, weeklyCostCents? }` shape. Not a `UserActivity`-adjacent structure. Component name renamed (B7); prop name intentionally left for shared-view stability.
- `src/components/planner/shared-planner-view.tsx:363` — passes `camp={openCamp}` matching the above prop
- `src/components/planner/shared-planner-view.tsx:177` — internal dev comment

### Placeholder example text (stays)
- `src/components/planner/add-activity-modal.tsx:202` — `placeholder="Camp Kanata"` is an example camp name in the form hint, not UI chrome

### Comments that reference the old mental model (stays)
- `src/components/planner/scrape-confirm-drawer.tsx:284` — `{/* 1. Camp name */}` internal dev comment adjacent to `<Field label="Activity name">` (the label itself was updated in B6)

### Out-of-scope duplicate files (ignored)
- `src/app/catalog/page 2.tsx`, `src/components/catalog/activity-list 2.tsx` — `" 2"`-suffixed duplicates from a merge-adjacent event, pre-existing before this work; not part of this refactor

### Out-of-scope adjacent modules (deferred)
- `src/components/catalog/activity-list.tsx:4` — imports `CampCard` from `@/components/activity/camp-card`. The catalog module uses a `CampCard` component outside the planner scope; renaming it belongs to a follow-up catalog-layer refactor.
