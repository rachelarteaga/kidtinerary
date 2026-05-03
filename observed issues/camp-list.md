# Camp list

Browse/search (currently `/explore`).

## Issues

- **Add-activity flow from catalog is broken** — bugs in the same flow:
  1. **"Fetching details" fails** — URL scrape from the catalog add-activity entry point doesn't populate fields. The `AddActivityModal` returned a `jobId` but `/catalog` never mounted `ScrapeConfirmDrawer` to poll/review/save the result, so URL adds were silent. Wire the planner's existing scrape-confirm drawer into `src/app/catalog/client.tsx` with `scopeLabel={null}` (no planner placement to confirm in catalog mode).
  2. ~~**Right-rail fields don't persist as user types**~~ — Fixed in PR #39 (`777f8cd`). The drawer's catalog mode had `if (mode !== "catalog") setLocal(...)` gates that froze controlled inputs; PR #39 unified `local` state across modes and wired `onChanged={() => router.refresh()}` from the catalog client.
  3. ~~**Location field rejects input**~~ — Fixed in PR #40 (`84ee50d`). Drawer state was being wiped on every parent re-fetch because the reset keyed off object reference; switched to a stable `trackedKey` (`c:${catalogActivity.id}`) and Address input uses callback-form `setLocal((prev) => ...)` to defend against stale closures.
