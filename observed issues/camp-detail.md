# Camp detail

Individual camp page (activity + sessions + locations).

## Issues

- ~~**"Scraped dates" shows on manually created camps** — field populates with the week-placed dates when the user creates a camp manually (not via URL scrape). Should be hidden entirely for manually created camps; only makes sense when dates actually came from scraping.~~ Fixed 2026-04-23 (branch `fix/observed-issues-polish`): drawer now gates "Scraped dates" section on `activity.source_url` being non-null, so manual camps never show the section. Threaded `source_url` through `fetchUserCamps` → `planner/client.tsx` → `camp-detail-drawer.tsx`.
