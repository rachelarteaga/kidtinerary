# Activity Canonicalization Plan

## Context

Users submitting custom activities today get a fresh `activities` row per submission ([actions.ts:620-634](src/lib/actions.ts:620)). Two parents adding the same real-world camp produce different `activity_id`s, so `computeFriendOverlaps` ([overlap.ts:84](src/lib/overlap.ts:84)) — which keys on exact `activity_id` — silently fails to detect overlap across shared planners.

Confirmed in prod: Rachel's "Lions Park X-Press" (`1eee312c…`) and her friend's "Summer X-Press Day Camp at Lions Park" (`72b53325…`) both fall in ISO week `2026-W32` with sessions on `2026-08-03`, but never match because the activity_ids differ.

The fix: each user keeps their own activity row with their own typed name, but every row gets a server-derived `canonical_fingerprint` that groups rows referring to the same real-world activity. The overlap matcher reads the fingerprint instead of the raw activity_id. Two parents independently submitting the same camp converge invisibly.

## Design Summary

| Decision | Locked value |
|---|---|
| Identity model | Each user keeps their own `activities` row. Rows referring to the same real-world thing share a `canonical_fingerprint`. No shared mutation. |
| Fingerprint inputs | Activity: `hash(canonical_org_fingerprint, normalize(program_name))`. Org: `hash(normalize(name), region)`. Region: `"{lowercased city}, {state}"` or `"online"`. |
| Form changes | Required city text input + state dropdown (2-char USPS) + "This is online" toggle. Drop the existing "share with directory" consent checkbox. Add "Keep this one private" toggle (default off). |
| Normalization | Deterministic on insert: lowercase, strip punctuation, expand abbreviations, sort tokens, aggressively strip generic/temporal words. Async LLM resolver pass with corpus as candidate context (ZDR enabled). |
| Matcher | `computeFriendOverlaps` keys on `canonical_fingerprint`. `activity_id` fallback during rollout, retired after backfill verified. |
| Overlap popover | Kid + parent + "View on Sarah's planner →" link. Friend's actual label only appears when viewer opens that planner. Plus per-friend-kid "Unmatch" affordance. |
| Escape hatch | `canonical_exclusions(viewer_id, activity_a_id, activity_b_id)` per-viewer, RLS-locked. Matcher filters at query time. "Hidden overlaps" section in popover for re-linking. |
| Privacy | Drop `activities.shared`. New `activities.private` (default false). `private=true` → permanent singleton, skips dedup + resolver index + future catalog. |
| Catalog visibility | Aspirational for v1 (UI not built). When built: surface activities once canonical group has ≥3 distinct users + region match. Resolver index runs for everyone regardless. |
| Add flow (v1) | Two explicit entry points: **"Add an activity I know about"** (description-first → corpus search → external fallback → structured form fallback) and **"Help me find activities"** (v2 fast follow). |
| Discovery (v2) | Separate UI funneling into same add pipeline. Filters, ranking, multi-pick, source attribution. Reuses v1 resolver layer. |

## Schema Changes

### New columns

```sql
-- organizations
alter table organizations
  add column canonical_fingerprint text,
  add column region text,
  add column canonical_label text;

create index on organizations (canonical_fingerprint);
create index on organizations (region, canonical_fingerprint);

-- activities
alter table activities
  add column canonical_fingerprint text,
  add column region text,
  add column private boolean not null default false,
  add column canonical_resolved_at timestamptz;

create index on activities (canonical_fingerprint);
create index on activities (region, canonical_fingerprint);
```

### Drop (after v1 ships clean)

```sql
alter table activities drop column shared;
```

Keep `verified` for now — repurpose as a ranking signal for the future catalog, not a visibility gate.

### New tables

```sql
create table canonical_exclusions (
  viewer_id     uuid not null references auth.users(id) on delete cascade,
  activity_a_id uuid not null references activities(id) on delete cascade,
  activity_b_id uuid not null references activities(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (viewer_id, activity_a_id, activity_b_id),
  check (activity_a_id < activity_b_id)
);

create index on canonical_exclusions (viewer_id);

alter table canonical_exclusions enable row level security;

create policy "viewer can read own exclusions" on canonical_exclusions
  for select using (viewer_id = auth.uid());
create policy "viewer can write own exclusions" on canonical_exclusions
  for insert with check (viewer_id = auth.uid());
create policy "viewer can delete own exclusions" on canonical_exclusions
  for delete using (viewer_id = auth.uid());

create table canonical_resolution_audit (
  id              uuid primary key default gen_random_uuid(),
  entity_type     text not null check (entity_type in ('organization', 'activity')),
  entity_id       uuid not null,
  old_fingerprint text,
  new_fingerprint text,
  resolver        text not null check (resolver in ('deterministic', 'llm', 'backfill', 'manual')),
  confidence      numeric,
  reason          text,
  created_at      timestamptz not null default now()
);

create index on canonical_resolution_audit (entity_id, created_at desc);
```

### RPC update

`get_shared_planner_by_token` ([migration 029](supabase/migrations/029_get_shared_planner_by_token.sql)) needs to include `canonical_fingerprint` on each entry's activity in the JSONB payload. Same for the user's own planner fetch path. No new field on the shared-planner payload contract beyond that.

## Rollout Sequence

Each PR is independently shippable — the app keeps working at every point. Dependencies enforced by the PR order.

1. **PR 1 — Schema foundation.** All DDL above. No behavior change. Nullable columns let existing rows coexist.
2. **PR 2 — Region capture + deterministic fingerprint on insert.** Form changes, deterministic normalize pipeline, `submitCamp` writes fingerprint on new rows.
3. **PR 3 — Matcher reads `canonical_fingerprint` with `activity_id` fallback.** Overlap detection now uses the fingerprint when available, falls back to today's behavior when null.
4. **PR 4 — Async LLM resolver + audit log.** Background task fires on insert, runs corpus-aware LLM normalization, updates fingerprints when matches found.
5. **PR 5 — Per-viewer exclusions (escape hatch).** Popover gets "Unmatch" + "Match again" affordances. Matcher filters by exclusions.
6. **PR 6 — Backfill job.** One-shot script. Regionizes existing rows via geocode-then-profile fallback, computes fingerprints, runs LLM pass, writes audit entries.
7. **PR 7 — Description-first add flow.** New "Add an activity I know about" entry point. Region-first → describe → corpus search → external fallback → structured form fallback.
8. **PR 8 — Retire fallback + drop `shared` column.** After backfill is verified, matcher uses `canonical_fingerprint` exclusively. Migration removes `activities.shared`.

## PR Breakdown

### PR 1 — Schema foundation

**Scope:** Database-only. All DDL from the Schema Changes section.

**Files:**
- `supabase/migrations/045_activity_canonicalization_schema.sql` (new)

**Acceptance criteria:**
- Migration applies cleanly to dev DB.
- All existing queries continue to work (new columns are nullable; `shared` not dropped yet).
- RLS policies pass `pg_policies` inspection — `canonical_exclusions` writes/reads scoped to `auth.uid()`.

**Dependencies:** None.

---

### PR 2 — Region capture + deterministic fingerprint on insert

**Scope:** New canonicalization library, form changes to collect region, server-side fingerprint computation on insert.

**Files:**
- `src/lib/canonical/normalize.ts` (new) — `normalizeOrgName`, `normalizeProgramName`, `normalizeRegion`. Aggressive stripping of generic/temporal words (`summer`, `2026`, `camp`, `program`, `day camp`, `session N`, etc.).
- `src/lib/canonical/fingerprint.ts` (new) — `computeOrgFingerprint(name, region)`, `computeActivityFingerprint(orgFingerprint, programName)`.
- `src/lib/canonical/index.ts` (new) — barrel.
- `src/lib/canonical/__tests__/normalize.test.ts` (new) — unit tests for normalize edge cases including the Lions Park case.
- `src/lib/canonical/__tests__/fingerprint.test.ts` (new) — fingerprint stability tests.
- `src/components/planner/add-activity-modal.tsx` — add city text input (autocomplete from prior entries), state dropdown (2-char USPS), "This is online" toggle, "Keep this one private" toggle. Remove the "Share with directory" consent checkbox.
- `src/lib/submit-camp-validation.ts` — require `(city + state) OR online`; require non-empty.
- `src/lib/actions.ts` — `submitCamp` writes `region`, `canonical_fingerprint`, `private` on insert. Org gets its own fingerprint via `computeOrgFingerprint`.
- `src/app/api/cities/recent/route.ts` (new) — returns cities the user has submitted before, for autocomplete.

**Acceptance criteria:**
- New submissions store `region`, `canonical_fingerprint` (non-null), `private` (false by default).
- Two test submissions with same org + program + region produce the same fingerprint.
- "Lions Park X-Press" and "Summer X-Press Day Camp at Lions Park" with the same region produce the **same** fingerprint after deterministic normalize. (Validates the aggressive stripping. If they don't, the deterministic pipeline needs tuning — log the diff and tighten the stopword list.)
- Submitting an "online" activity stores `region = "online"`.
- Existing activities still load and render (their fingerprints are null until PR 6's backfill).

**Dependencies:** PR 1.

---

### PR 3 — Matcher reads `canonical_fingerprint` with fallback

**Scope:** Switch overlap matching to use the fingerprint when present.

**Files:**
- `src/lib/overlap.ts` — change `UserPlannerEntry` and `FriendPlannerForOverlap.entries` to carry `canonical_fingerprint` alongside `activity_id`. The match key becomes `${canonical_fingerprint ?? activity_id}::${week_key}`.
- `src/lib/queries.ts` — `fetchPlannerEntries` selects `activities.canonical_fingerprint` and `activities.region`.
- `supabase/migrations/046_shared_planner_canonical_fingerprint.sql` (new) — update `get_shared_planner_by_token` RPC to include `canonical_fingerprint` on each entry's activity.
- `src/lib/queries-share-mapper.ts` — pass through the new field.
- `src/app/planner/page.tsx` — projection at lines 100-103 and 113-117 includes `canonical_fingerprint`.
- `src/lib/overlap.ts` __tests__ — add tests for the fallback behavior (null fingerprint → activity_id), forward behavior (both have fingerprint → fingerprint match), mixed (one null + one fingerprinted → no match, fall through to activity_id mismatch).

**Acceptance criteria:**
- Existing overlap detection continues to work for rows without canonical_fingerprint (fallback path).
- New submissions from PR 2 are matched via canonical_fingerprint, including the Rachel case once both rows have fingerprints.
- Popover renders with kid + parent + "View on Sarah's planner →" link (option C). Friend's actual label does NOT appear in the popover itself — only when the viewer opens that planner.

**Dependencies:** PR 1, PR 2.

---

### PR 4 — Async LLM resolver + audit log

**Scope:** Background task that runs corpus-aware LLM canonical resolution post-insert and updates fingerprints when matches found. ZDR enabled.

**Files:**
- `src/lib/activity-resolver/` (new module — sets up reusability for v2 discovery)
  - `corpus.ts` — fetches candidate activities in a region for resolver context (top N similar by deterministic name fingerprint).
  - `llm.ts` — Haiku 4.5 structured-output call with ZDR. Input: target activity + candidate context + region. Output: `{ matched_canonical_fingerprint, confidence, extracted_org_name, extracted_program_name, reasoning }`.
  - `resolve.ts` — orchestrates: take an activity, run corpus query, call LLM, update fingerprint if confidence ≥ threshold (start at 75), write audit row.
  - `cache.ts` — `(region, raw_org, raw_program)` → resolution result, 24h TTL. Invalidate on new submission in region.
  - `__tests__/` — unit tests with mocked LLM responses.
- `src/app/api/resolver/run/route.ts` (new) — POST endpoint that the post-insert task hits. Validates auth, runs resolver, returns result. Internal-only, called from server actions.
- `src/lib/actions.ts` — `submitCamp` fires-and-forgets a call to the resolver endpoint after insert. Non-blocking; insert returns immediately.
- Vercel Function config: ensure ZDR header is set on Anthropic client (`anthropic-zdr: true`).
- `src/lib/canonical/__tests__/integration.test.ts` — integration test: insert two near-matching activities back-to-back, wait for resolver, confirm they converge to the same fingerprint.

**Acceptance criteria:**
- New submissions trigger an async resolver call within 1s of insert.
- The Rachel case (Lions Park / Summer X-Press) resolves to the same fingerprint within the LLM resolver's first run.
- Audit log captures every fingerprint change with confidence and reason.
- Cache hit on identical inputs avoids the LLM call.
- ZDR header confirmed on outbound Anthropic calls (manual inspection or test).

**Dependencies:** PR 1, PR 2.

---

### PR 5 — Per-viewer exclusions (escape hatch)

**Scope:** Users can dismiss wrong overlap matches; matcher honors per-viewer exclusions.

**Files:**
- `src/components/planner/overlap-badge-stack.tsx` — popover gets per-friend-kid "Unmatch — not the same camp" item. Tap → confirmation toast, optimistic UI update, server action call.
- `src/lib/actions.ts` — `excludeCanonicalMatch(myActivityId, theirActivityId)` and `removeCanonicalExclusion(myActivityId, theirActivityId)` server actions.
- `src/lib/queries.ts` — `fetchViewerExclusions(viewerId)` returns the user's exclusion pairs.
- `src/lib/overlap.ts` — `computeFriendOverlaps` accepts an optional `exclusions` parameter; filters out pairs from the output.
- `src/app/planner/page.tsx` — loads exclusions, passes to overlap computation.
- A "Hidden overlaps" section appears in the popover for any (activity, friend kid) pair previously excluded, with a "Match again" tap to undo.

**Acceptance criteria:**
- Tap "Unmatch" → overlap badge updates immediately, exclusion persists.
- Refreshing the planner shows the exclusion still applied.
- Tap "Match again" from Hidden overlaps → re-adds the friend kid to the overlap badge.
- RLS prevents reading or writing another viewer's exclusions.

**Dependencies:** PR 1, PR 3.

---

### PR 6 — Backfill

**Scope:** One-shot script. Regionizes existing rows, computes fingerprints, runs LLM resolution pass.

**Files:**
- `scripts/backfill-canonical.ts` (new) — invocable via `bun run scripts/backfill-canonical.ts` or as a Supabase function call. Idempotent.
- `src/lib/canonical/backfill.ts` (new) — the actual backfill logic, importable from the script.
- For each existing activity:
  - Determine region: geocode `activity_locations.address` first (use a geocoding lib or service); if placeholder/missing, fall back to submitter's profile city/state from `profiles`; if both missing, leave region null.
  - Compute deterministic fingerprint for org + activity.
  - Queue for LLM resolver pass.
- Run LLM resolver pass on all queued activities. Updates fingerprints where matches found. Audit entries written.
- Output summary: total rows processed, new canonical groups, multi-row groups, null-region rows skipped, LLM calls made, total cost.

**Acceptance criteria:**
- Rachel's Lions Park activity and her friend's Lions Park activity converge to the same canonical_fingerprint after backfill.
- Audit log has corresponding rows for each fingerprint write.
- Script is idempotent — running twice produces no changes on the second run.
- Null-region rows stay singleton (no false-merge); they'll get fingerprints if the user later updates them.
- Manual spot-check of the largest canonical groups (more than 2 members) confirms no obvious false positives.

**Dependencies:** PR 1, PR 2, PR 4, PR 5.

Why PR 5 is a dependency: backfill will produce some false-positive merges. Users need the unmatch escape hatch available on day one.

---

### PR 7 — Description-first add flow

**Scope:** New "Add an activity I know about" entry point. Region-first → description → corpus search → external fallback → structured form fallback.

**Files:**
- `src/components/planner/add-activity-modal.tsx` — restructure into a multi-step flow. Step 1 = region. Step 2 = description. Step 3 = candidates (LLM corpus search results). Step 4 = structured form (fallback). The existing structured-form-only path becomes Step 4 reached via fallback.
- `src/lib/activity-resolver/find.ts` (new) — synchronous corpus search + external LLM lookup. Input: region + description. Output: `{ corpus_matches: [], external_matches: [], extracted_fields: {} }`.
- `src/lib/activity-resolver/external.ts` (new) — LLM call with web search tool enabled. Triggers when corpus returns nothing. Returns structured external candidates with org name, address, URL, source link.
- `src/app/api/resolver/find/route.ts` (new) — POST endpoint for synchronous search. Latency budget: ~1s with loading skeleton.
- UI shows top 1-3 corpus matches first; if none, top 1-3 external matches with source attribution; if neither, drops parent into the structured form prefilled with `extracted_fields`.
- "View on Sarah's planner →" links are wired to existing planner-share URLs.
- Cache: synchronous LLM lookups cached by `(region, normalized(description))` with 24h TTL.

**Acceptance criteria:**
- Parent types "Lions Park X-Press" in Westport CT → corpus match found (post-backfill) → parent picks → their planner row created with same canonical_fingerprint.
- Parent types something with no corpus match → external LLM result shown with source URL → parent confirms → row created with extracted org + program + the external URL.
- Parent types something neither corpus nor external can resolve → structured form opens, prefilled with extracted fields.
- LLM call timeout (3s) → automatically falls back to structured form with a soft message.
- Submitting via URL bypasses the description flow → scrapes + structures directly → corpus-fingerprint-matches if applicable.

**Dependencies:** PR 1, PR 2, PR 4.

---

### PR 8 — Retire fallback + drop `shared` column

**Scope:** Cleanup after backfill is verified.

**Files:**
- `src/lib/overlap.ts` — remove the `activity_id` fallback. Matcher uses only `canonical_fingerprint`.
- `supabase/migrations/047_drop_activities_shared.sql` (new) — drop `activities.shared` column. Also drops the search API filter on `shared`.
- `src/app/api/activities/search/route.ts` — remove the `shared=true` filter. Future catalog visibility will key on the N=3 threshold + region scope (piece 8, not built in v1).
- `src/app/api/organizations/search/route.ts` — same.

**Acceptance criteria:**
- All activities have non-null `canonical_fingerprint` post-backfill.
- Removing the fallback doesn't regress any existing overlap detection.
- `shared` column gone from schema. No reads or writes of `activities.shared` anywhere in the codebase.

**Dependencies:** PR 1-7.

## v2 Follow-up — Discovery

**Goal:** Parents who don't have a specific camp in mind can ask the system to suggest options. "Help me find karate camps in Raleigh for my 7-year-old this summer."

**Why it fast-follows v1:** The resolver layer from PR 4 + PR 7 already does corpus search and external LLM lookup. Discovery is mostly a new UI calling into the same machinery with a different intent flag.

**Net new in v2:**
- New "+ Help me find activities" button on the planner header (next to "+ Add an activity I know about").
- Discovery modal: region + free-text query + optional filters (age range, dates, day vs overnight, cost ceiling).
- `src/lib/activity-resolver/find.ts` extended with `mode: 'match' | 'browse'`. Browse returns top 10-20 candidates instead of top 1-3.
- Result list UI with: name, org, location, source attribution, "X parents in your area have this" social proof badge (uses canonical group size), "Add to planner" + "Add to wishlist" actions.
- Pagination / "show more" if external results exceed initial page.
- Ranking: corpus matches with high group size first, verified-scraped catalog second, external LLM/web third.

**Schema changes for v2:** none, if planner_entries can hold a `wishlist` status (already exists as `status` column). Otherwise add a `wishlist` enum value.

**Estimated PR size:** 1-2 PRs after v1 ships.

## Open Questions / Future Work

- **Multi-branch metro orgs (YMCA of the Triangle case).** Current city-level region splits Cary and Raleigh branches into different orgs. Acceptable for v1 (per design decision). Upgrade to metro-level via CBSA lookup if real users complain.
- **Global exclusion signals.** Aggregating per-viewer exclusions across users could feed back into the LLM resolver as a training signal ("N users say these aren't the same"). Easy to add later from the existing `canonical_exclusions` table.
- **Org-level admin curation.** When `verified=true` is flipped on an org, all activities under that org could inherit higher-trust ranking in catalog search. Defer until catalog UI is built.
- **Stale fingerprint reconciliation.** If the normalize pipeline or LLM model improves, existing fingerprints may need recomputation. Backfill script is reusable; just re-run it.
- **Session-level dedup.** Two parents submitting the same camp generate two `sessions` rows even after activities converge. Not load-bearing for overlap (matcher uses fingerprint + week_key, not session.id), but worth thinking about for future features that join on session identity (e.g., shared sign-up reminders).
