# Add / Edit — Field Matrix (for review)

Leave comments inline. I'll revise from your edits and implement after you sign off.

---

## Four surfaces

1. **Add form** — Organization / Camp name / OR / URL / consent. Entry point for all adds.
2. **Scrape-confirm drawer** — opens right after URL submit. Shows scraped details as Tier 1 drafts.
3. **Preview modal** — opens when user clicks a camp chip in the My Camps rail. Read-only summary with a CTA to the drawer.
4. **Camp detail drawer** — full edit surface. Opens from cell click directly, or from preview CTA. Has two variants:
   - **Placed** (click from planner cell) — shows per-week/per-kid editors.
   - **Shortlist** (from preview CTA, not placed on a week) — activity-level editors only.
   - If `source='curated'`: drawer renders read-only regardless.

---

## Field chart

Columns:
- **Field** — the data point
- **Add form** — visible on initial add?
- **Scrape-confirm** — visible on post-URL confirmation drawer?
- **Preview (rail)** — shown in the read-only preview modal?
- **Drawer — Placed** — editable in the cell-click drawer?
- **Drawer — Shortlist** — editable in the rail-CTA drawer (activity-level only)?

Legend: ✎ = editable, 👁 = read-only display, — = not shown

| Field                            | Add form | Scrape-confirm | Preview (rail) | Drawer — Placed | Drawer — Shortlist | Your comment |
|----------------------------------|:--------:|:--------------:|:--------------:|:---------------:|:------------------:|--------------|
| Camp name                        |    ✎     |       👁       |        👁       |        ✎         |          ✎          |              |
| Organization                     |    ✎     |       👁       |        👁       |        ✎         |          ✎          |              |
| URL                              |    ✎     |       👁       |        👁       |        ✎         |          ✎          |              |
| Source (you added / curated)     |    —     |       —        |        👁       |        👁         |          👁          |              |
| Categories                       |    —     |   ✎ (draft)    |        —        |    ✎ (live)      |      ✎ (live)       |              |
| About / description              |    —     |   ✎ (draft)    |        👁       |    ✎ (live)      |      ✎ (live)       |              |
| Ages                             |    —     |   ✎ (draft)    |        —        |    ✎ (live)      |      ✎ (live)       |              |
| Location                         |    —     |       👁       |        👁       |        —         |          —          |              |
| Price options (canonical)        |    —     |       👁       |        —        |        —         |          —          |              |
| Avg $/week across `registered`   |    —     |       —        |        👁       |        —         |          —          |              |
| Placements summary (e.g. "2 considering, 1 registered") | — | — | 👁 | — | — |              |
| Consent to share                 |    ✎     |       —        |        —        |        —         |          —          |              |
| Status (considering/waitlisted/registered) | — | — | — | ✎ (live) | — |              |
| Schedule (session part + days)   |    —     |       —        |        —        |    ✎ (live)      |          —          |              |
| This-week price + extras         |    —     |       —        |        —        |    ✎ (live)      |          —          |              |
| Notes (per week)                 |    —     |       —        |        —        |    ✎ (live)      |          —          |              |
| Dates / sessions                 |    —     |       👁       |        —        |        —         |          —          |              |
| "Also add for [other kid]"       |    —     |       —        |        —        |    ✎ (action)    |          —          |              |
| Delete from week                 |    —     |       —        |        —        |    ✎ (action)    |          —          |              |
| Delete from shortlist            |    —     |   ✎ (action)   |        —        |        —         |      ✎ (action)     |              |

---

## Open design questions (prompt me for each)

- **If `source='curated'` for a placed camp:** the drawer hides edit affordances for name/org/URL/categories/about/ages, but per-week editors (status, schedule, this-week price, notes) are still the user's data — stay editable. Confirm?
- **Preview modal on mobile:** center modal, same as current. No right-rail layout change.
- **"View full details" CTA naming** on curated preview: could be "View details" or "See more info" — pick one.

---

## Scope of this change

- Revert commit `600a5ba` (rail-click → unified drawer).
- Rename / rebuild `CampQuickViewModal` into the Preview modal above.
- Update preview content to pull source, aggregated status counts, and avg price.
- Tighten `activities` UPDATE RLS to `source='user'`.
- Drawer: add a read-only mode when `source='curated'`.
- Delete `/activity/[slug]` page and its references.

Out of scope: curated ingestion (no data exists yet), Tier 2 edits (dates/price/location in drawer).
