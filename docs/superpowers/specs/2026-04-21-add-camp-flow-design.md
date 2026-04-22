# Add Camp Flow Overhaul — Design

**Date:** 2026-04-21
**Branch:** `add-camp-flow-overhaul`
**Status:** Approved, ready for implementation planning

## Context

Today's add-camp flow uses a single free-text input that auto-detects URL vs. name via regex, with live autocomplete against a seeded/mystery `activities` table. We are overhauling this to:

1. Give users explicit **organization** and **camp name** fields, or an alternate **URL** path.
2. Reset the `activities` + `organizations` tables and begin populating them exclusively from user submissions, tagged with a `source` enum so user-generated and future curated content can coexist.
3. Let users edit camp name, organization, and URL after the fact in the camp details drawer.
4. Collect `shared` (share-with-directory) consent on a durable per-activity field, even though autocomplete won't consume it until verification ships.

The explore feature will be overhauled separately and is out of scope for this spec.

## Non-goals

- Verification pipeline (separate workstream).
- Fuzzy organization/camp-name matching across submissions — "YMCA" vs. "YMCA of the Triangle" vs. "The Y" all stay distinct for now. Handled later alongside verification.
- Per-user overrides for activity fields. In v1, edits write directly to the shared `activities` row. This is safe while everything is `source='user'`, unverified, and there is no cross-user matching. Flagged as a known follow-up.
- Block tab and explore page UI.

## Section 1 — Data model & seed state

One-off migration (pre-launch; no user data to preserve):

```sql
-- Truncate in dependency order; CASCADE handles sessions → planner_entries
TRUNCATE activities, organizations, sessions, planner_entries, user_camps, scrape_jobs
  RESTART IDENTITY CASCADE;

-- Shared enum for provenance
CREATE TYPE entity_source AS ENUM ('user', 'curated');

-- activities
ALTER TABLE activities ADD COLUMN source entity_source NOT NULL DEFAULT 'user';
ALTER TABLE activities ADD COLUMN shared boolean NOT NULL DEFAULT false;
ALTER TABLE activities ALTER COLUMN organization_id DROP NOT NULL;

-- organizations
ALTER TABLE organizations ADD COLUMN source entity_source NOT NULL DEFAULT 'user';

-- Case-insensitive org dedup within source='user'
CREATE UNIQUE INDEX organizations_user_name_ci
  ON organizations (LOWER(name))
  WHERE source = 'user';
```

Notes:
- `planner_blocks` is untouched.
- Explore will render empty until verified data accrues.
- Existing code that creates the `"User-submitted"` placeholder org is removed in Section 3.

## Section 2 — Add-camp form UI

File: `src/components/planner/add-camp-modal.tsx`.

Layout inside the existing "Camp" tab (overlay and camp/block tab chrome unchanged):

```
Add a camp
Tell us who's hosting and what it's called — or drop a URL and we'll fill in the rest.

Organization         [ text input                       ]  ← autocomplete dropdown
Camp name            [ text input                       ]  ← autocomplete dropdown

───────────────── OR ─────────────────

URL                  [ text input                       ]
We'll populate the rest of the details for you.

☐ Share this camp with Kidtinerary's directory so other parents can find it.
   We'll verify the details before publishing.

                                             [ Cancel ] [ Add camp ]
```

Behavior:
- Three fields always visible; neither path disables the other. User may fill either side or both.
- Submit requires **either** (`organization` + `camp name`) **or** `url`. Inline error otherwise.
- Org and camp-name inputs both show autocomplete suggestions filtered to `source='user' AND shared=true AND verified=true` (Section 5). Fields behave as plain text until verified data exists.
- Consent checkbox preserved; default follows existing `shareCampsDefault` prop.
- "Got a link handy? Paste it for the best match" copy is replaced by the new URL helper line.

## Section 3 — Submit behavior

File: `src/lib/actions.ts` — rewrite `submitCamp`.

New input shape:

```ts
type SubmitCampInput = {
  orgName?: string;
  campName?: string;
  url?: string;
  shared: boolean;
  // When user picks an autocomplete hit (day 2+), form passes existing ids directly:
  activityId?: string;
};
```

Server-side logic:

1. **Validate:** require `activityId`, or (`orgName && campName`), or `url`. Reject otherwise.
2. **If `activityId` provided (autocomplete hit):** skip activity/org creation; jump to step 5.
3. **Resolve organization + name:**
   - Org+name path: upsert `organizations` (SELECT WHERE `LOWER(name)=LOWER(orgName) AND source='user'`, else INSERT with `source='user'`). Activity `name = campName`.
   - URL-only path: `organization_id = NULL`; activity `name = "New camp"` (placeholder rendered muted/italic in UI).
4. **Insert `activities`:**
   ```
   organization_id     = resolved org id or NULL
   name                = resolved name
   slug                = generated from name + short hash
   source              = 'user'
   shared              = input.shared
   verified            = false
   registration_url    = input.url (nullable)
   is_active           = true
   categories          = []
   ```
5. **Upsert `user_camps(user_id, activity_id)`** with next color in palette.
6. **If scoped** (`childId` + `weekStart`): create placeholder session (POINT(0 0), full week, `full_day`) and insert `planner_entry` with today's defaults (`status='considering'`, `session_part='full'`, weekday `days_of_week`, etc.).
7. **Enqueue `scrape_jobs`** only if `url` is present:
   ```
   input         = url
   context       = { child_id, week_start, activity_id }
   consent_share = input.shared    // parity; activities.shared is authoritative
   status        = 'queued'
   ```
8. **Return** `{ userCampId, activityId, plannerEntryId?, jobId? }`.

Removed behavior:
- Regex URL-vs-name detection on a single input.
- `"User-submitted"` placeholder org creation.
- Unconditional scrape job enqueue.

## Section 4 — Drawer editability

File: `src/components/planner/camp-detail-drawer.tsx`.

Convert the read-only header and add a URL row:

- **Camp name:** click-to-edit input. Blur or Enter saves; Escape reverts.
- **Organization:** same inline-edit pattern.
- **URL:** new row under org. Shows as a link (opens in new tab) when populated, placeholder "Add a URL" when empty. Click to edit.
- **Placeholder state:** if `name = "New camp"` and scrape unresolved, render italic/muted with helper text "We're fetching details…" — still editable.

Persistence: new server action `updateActivityFields({ activityId, name?, orgName?, url? })`.
- Writes directly to `activities`; upserts the organization the same way `submitCamp` does.
- Auth guard: caller must own a `user_camps` row for this activity. Fine in v1 (everything unverified + source='user', no cross-user matching).
- **Future work:** once fuzzy matching + verified shared activities exist, edits need to become per-user overrides on `user_camps` so one user's typo fix doesn't mutate another user's view.

Untouched editors: status, schedule, price, extras, notes, "also add for".

## Section 5 — Autocomplete wiring

**Activities search** (`/api/activities/search?q=...`): add filter to existing query.

```sql
WHERE source = 'user'
  AND shared = true
  AND verified = true
  AND name ILIKE '%' || $q || '%'
```

**Organizations search** (new `/api/organizations/search?q=...`): filter to orgs that have at least one shared+verified activity. Avoids adding a `shared` flag to organizations.

```sql
WHERE source = 'user'
  AND EXISTS (
    SELECT 1 FROM activities a
    WHERE a.organization_id = organizations.id
      AND a.shared = true
      AND a.verified = true
  )
  AND name ILIKE '%' || $q || '%'
```

When a user picks a suggestion:
- The form captures the `activity_id` (or `organization_id` if picking from the org field and then filling a distinct camp name).
- If `activity_id` is set on submit, `submitCamp` skips INSERT and only upserts `user_camps` (see Section 3 step 2).

Day 1 state: both endpoints return empty because nothing is `verified=true`. Fields behave as plain text inputs.

## Known follow-ups (out of scope)

- Verification pipeline (admin review / automated scrape confidence).
- Fuzzy organization + camp-name matching across user submissions.
- Per-user overrides for activity fields once cross-user matching is live.
- Explore feature overhaul to render the new user-submitted → verified funnel.
