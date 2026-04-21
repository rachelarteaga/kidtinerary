# Add-Camp flow — follow-ups

Tracking the open items we've flagged but intentionally deferred. Grouped by
theme so whoever picks these up next has enough context to scope.

## Two-level naming (org → camp)

The DB already models this (`organizations` 1:N `activities`), and the LLM
extractor already emits `organizationName` separately from `name`. As of
2026-04-21 we surface the org as a subtitle in MyCampsRail and as a "Hosted by"
field in the scrape-confirm drawer, both suppressed when the value matches the
camp name or is the placeholder "User-submitted" org.

**Still to do:**

1. **Group the shortlist by organization.** Render camps under collapsible
   company headers ("Craft Habit Raleigh · 3 camps"). Sorts naturally, makes
   the rail scannable once a family shortlists several camps from the same
   host. Requires MyCampsRail restructure; drag-and-drop behavior needs to
   keep working across groups.

2. **Require both org and camp name when a user adds a camp manually.** The
   current name-only modal lets a user type a single string, which becomes
   `activity.name` and inherits the "User-submitted" org. We should add a
   second field on the manual-entry form (org + camp name, both required) so
   manually-entered camps sit alongside scraped ones in the grouped rail.

3. **Scraper tuning for pages that collapse org into name.** Sawyer-style
   "activity-set" pages sometimes prominently display only the studio name
   and bury the specific class title. When the LLM returns the same string
   for `organizationName` and `name`, we currently display just the name —
   which loses information. Options: (a) prompt-engineer the LLM to dig
   deeper for the class title on schedule-style pages, (b) post-process to
   detect the collision and fetch a more specific title from the page head.

## Field editing in the scrape-confirm drawer

Currently read-only. To allow edits we need an RLS update policy on
`activities` (or a server action that bypasses RLS after verifying the user
owns the `user_camps` row pointing at the activity). Scope carefully: some
activities are shared across users via the directory, and we don't want user
A's edits clobbering user B's view.

## Name-first modal redesign

The mockups at `public/mockups/add-camp.html` show a name-first modal that
reveals a URL nudge after typing. Not built yet — free-text input still uses
the existing single-input modal. Low priority until the URL flow is solid.
