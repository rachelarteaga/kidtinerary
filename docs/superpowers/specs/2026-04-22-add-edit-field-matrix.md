# Add / Edit — Field Order (locked)

**Status:** locked, ready to implement.

---

## Propagation & source rules

- Activity-level edits (name, org, URL, categories, about, ages, location) **propagate to every placement** — they mutate the shared `activities` row.
- If `source='curated'`: all activity-level fields render read-only in every drawer. Per-week editors (status, schedule, this-week price, notes) remain editable — that's the user's own data.
- "Ages," "Scraped price options," "Scraped dates / sessions" are marked with a **beta** badge: pulled from the scraper, not yet reliable.

---

## 1. Preview modal (rail click)

1. Camp name — 👁
2. Organization — 👁
3. URL — 👁
4. Source (You added / Curated) — 👁
5. Placements summary — 👁 (e.g. "2 considering, 1 registered")
6. Avg $/week across registered — 👁 (from price paid)
7. Location — 👁
8. Categories — 👁
9. About / description — 👁
10. CTA — "Edit camp details" (user) / "See more info" (curated) → opens drawer

---

## 2. Drawer — Placed (cell click)

Header: `[Kid] · Week of [date]` + activity name/org/URL inline-editable.

1. Status dropdown — ✎
2. Camp name — ✎ (inline header)
3. Organization — ✎ (inline header)
4. URL — ✎ (inline header)
5. Source badge — 👁
6. Schedule (session part + days) — ✎ (user-picked per week)
7. This-week price + extras — ✎ (price paid, feeds card + planner total)
8. Location — ✎
9. Notes (per week) — ✎
10. Categories — ✎
11. About / description — ✎
12. Ages — 👁 (beta)
13. Scraped price options — 👁 (beta)
14. Scraped dates / sessions — 👁 (beta)
15. Also add for [other kid] — → action
16. Delete from week — → footer
17. Done — → footer

---

## 3. Drawer — Shortlist (preview CTA, not placed)

Header: "In your shortlist" + activity name/org/URL inline-editable.

1. Camp name — ✎ (inline header)
2. Organization — ✎ (inline header)
3. URL — ✎ (inline header)
4. Source badge — 👁
5. Location — ✎
6. Categories — ✎
7. About / description — ✎
8. Ages — 👁 (beta)
9. Scraped price options — 👁 (beta)
10. Delete from shortlist — → footer
11. Done — → footer

---

## 4. Scrape-confirm drawer (post URL submit)

Polls scrape job, shows details with Tier 1 drafts until Save.

1. Camp name (scraped) — 👁
2. Organization (scraped) — 👁
3. URL — 👁
4. Location — 👁
5. Categories — ✎ (draft)
6. About / description — ✎ (draft)
7. Ages — 👁 (beta)
8. Scraped price options — 👁 (beta)
9. Dates / sessions — 👁 (beta)
10. Delete (remove from shortlist) — → footer
11. Cancel — → footer
12. Save — → footer

---

## 5. Add form (entry point for all adds)

URL-first layout.

1. URL — ✎ input
2. OR divider
3. Organization — ✎ input + autocomplete
4. Camp name — ✎ input + autocomplete
5. Consent to share — ✎ checkbox
6. Cancel — → footer
7. Add camp — → footer

---

## Implementation phases

Each phase commits and can deploy independently. Stopping between phases is safe.

### Phase A — Revert + RLS
1. Revert commit `600a5ba` (rail-click → unified drawer). Restores `CampQuickViewModal` usage.
2. Migration `021_activities_update_rls_user_only.sql` — drop existing UPDATE policy, recreate with `source='user'` check. Keeps curated rows immutable to users.

### Phase B — Backend extensions
3. Extend `updateActivityFields` server action with `locationName?` and `address?` params. Writes to `activity_locations` (single-row upsert per activity for v1).
4. Extend `fetchUserCamps` to include `source`, `description`, `age_min`, `age_max` (already), plus `activity_locations`, `price_options` (for scraped display).
5. Add query `fetchCampPlacements(activityId, userId)` that returns `{ considering: n, waitlisted: n, registered: n, avgPricePaidPerWeek: number | null }`.

### Phase C — Preview modal rebuild
6. Rebuild `CampQuickViewModal` into `CampPreviewModal` per Section 1. Includes source badge, placements summary, avg $/week, CTA that opens the drawer in shortlist mode.

### Phase D — Drawer updates
7. Reorder drawer sections per Section 2 & 3.
8. Add Location editor (address + optional label, editable when `source='user'`).
9. Ages → read-only with beta badge everywhere.
10. Add "Scraped price options" read-only block (beta) to drawer.
11. Add "Scraped dates / sessions" read-only block (beta) to drawer.
12. Add "Edits affect all placements" helper on activity-level editors (placed variant only).
13. Source-based read-only mode: when `source='curated'`, activity-level inputs render as plain text.

### Phase E — Scrape-confirm reorder
14. Reorder per Section 4. Ages moves from ✎ draft to 👁 beta.

### Phase F — Add form reorder
15. Move URL field above OR divider, Org + Camp name below. Copy + placeholder adjustments.

### Phase G — Remove activity page
16. Delete `src/app/activity/[slug]/page.tsx` + helpers. Remove remaining references.

### Phase H — Wire preview CTA to drawer (shortlist mode)
17. Preview modal CTA → opens `CampDetailDrawer` with `placed=null` (same flow as the reverted 600a5ba's shortlist variant, but now only reachable via preview CTA, not direct rail click).

---

## Deferred / out of scope

- Curated ingestion pipeline (no curated data exists yet; phase D #13 is scaffolding only).
- Multi-location support (schema allows it, UI stays single-row).
- Editing scraped dates/sessions, scraped price options (beta display only).
- Fuzzy org/name matching across submissions.
