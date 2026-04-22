# Add / Edit — Field Order & Comments (for review)

Each surface below is a **reorderable list** — the order is the display order.
Move lines up/down to reshape; add comments after the `//`.

---

## Surfaces

1. **Add form** — Organization / Camp name / OR / URL / consent.
2. **Scrape-confirm drawer** — opens right after URL submit. Scraped details with Tier 1 drafts.
3. **Preview modal** — opens on My Camps rail click. Read-only summary with CTA.
4. **Camp detail drawer** — full edit surface. Two variants: **Placed** (cell click) or **Shortlist** (preview CTA).

Legend: `✎` editable · `👁` read-only · `(beta)` read-only with beta badge · `(draft)` draft until Save · `→` action button

Notes:
- Activity-level edits (name, org, URL, categories, about, ages, location) **propagate to every placement** of the camp.
- If `source='curated'`: all activity-level fields become read-only regardless of which drawer.

---

## 1. Preview modal — display order

Click a camp chip in My Camps rail. Read-only summary with a CTA to the drawer.

1. Camp name                                 // 👁
2. Organization                              // 👁
3. Source ("You added this" / "Curated")     // 👁
4. Placements summary ("2 considering, 1 registered")  // 👁
5. Avg $/week across registered              // 👁 — from price paid
6. Location                                  // 👁
7. Categories                                // 👁
8. About / description                       // 👁
9. URL                                       // 👁
10. CTA → "Edit camp details" (user) / "View full details" (curated)

---

## 2. Camp detail drawer — Placed (click from planner cell)

Header (kid · week) + body + sticky footer.

1. Status dropdown                           // ✎ considering / waitlisted / registered
2. Camp name                                 // ✎ (inline header)
3. Organization                              // ✎ (inline header)
4. URL                                       // ✎ (inline header)
5. Source badge                              // 👁
6. Schedule (session part + days)            // ?? user to clarify (see Open questions)
7. This-week price + extras                  // ?? user to clarify (see Open questions)
8. Notes (per week)                          // ✎
9. Categories                                // ✎
10. Ages                                     // 👁 (beta)
11. Location                                 // ✎
12. About / description                      // ✎
13. Scraped price options                    // 👁 (beta)
14. Scraped dates / sessions                 // 👁 (beta)
15. "Also add for [other kid]"               // → action
16. Delete from week                         // → action (footer)
17. Done                                     // → action (footer)

---

## 3. Camp detail drawer — Shortlist (from preview CTA, not placed)

Header ("In your shortlist") + body + sticky footer.

1. Camp name                                 // ✎ (inline header)
2. Organization                              // ✎ (inline header)
3. URL                                       // ✎ (inline header)
4. Source badge                              // 👁
5. Categories                                // ✎
6. Ages                                      // 👁 (beta)
7. Location                                  // ✎
8. About / description                       // ✎
9. Scraped price options                     // 👁 (beta)
10. Delete from shortlist                    // → action (footer)
11. Done                                     // → action (footer)

---

## 4. Scrape-confirm drawer — display order (post-URL submit)

Polls scraper, shows details. Tier 1 fields are drafts until Save.

1. Camp name (scraped)                       // 👁
2. Organization (scraped)                    // 👁
3. URL                                       // 👁
4. Categories                                // ✎ (draft)
5. About / description                       // ✎ (draft)
6. Ages                                      // 👁 (beta) — was ✎ draft, moving to beta per your note
7. Location                                  // 👁
8. Dates / sessions                          // 👁 (beta)
9. Scraped price options                     // 👁 (beta)
10. Delete (remove from shortlist)           // → footer
11. Cancel                                   // → footer
12. Save                                     // → footer

---

## 5. Add form — display order

Entry point for all adds. Input fields.

1. Organization                              // ✎ input + autocomplete
2. Camp name                                 // ✎ input + autocomplete
3. "OR" divider
4. URL                                       // ✎ input
5. Consent to share                          // ✎ checkbox
6. Cancel                                    // → footer
7. Add camp                                  // → footer

---

## Open questions (need your answer before I start)

**Q1. "This-week price + extras"** — is this the editable "price paid" you want to keep, or did you want to remove this editor? It's currently user-typed per-week and feeds the in-line card price + planner total (the exact thing you said should be editable).

**Q2. "Schedule (session part + days)"** — is this the user-picked session part + weekdays editor you want to keep (controls the timeline rendering), or did you want to remove it? Not scraped.

**Q3. "View full details" CTA** on curated preview — pick a label: "View details" / "See more info" / something else.

**Q4. Location editor UX** — free-text address? Dropdown of existing locations for this activity? (Today's schema has `activity_locations` as multi-row. For v1, single address field on the activity?)

---

## Scope of this change

- Revert commit `600a5ba` (rail-click → unified drawer).
- Rebuild Preview modal with the fields + order in section 1.
- Drawer (both variants) picks up Location (editable) and a Scraped price options block (beta).
- Ages becomes read-only beta everywhere.
- Tighten `activities` UPDATE RLS to `source='user'`.
- Add "Edits affect all placements" helper text on activity-level editors.
- Delete `/activity/[slug]` page and its references.

Out of scope until curated data exists: curated read-only flow (scaffold only, no test data).
