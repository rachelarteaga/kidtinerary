# Schedule

Shared/public schedule view.

## Issues

- ~~**Live share link returns 404 for recipient** — Rachel sent a live dashboard/schedule link to a friend; friend clicked and got a 404 page.~~ Fixed 2026-04-24 via PR #17 (`fix/share-link-404`): anonymous viewers of `/schedule/[token]` unblocked — root cause was RLS filtering on the share-lookup query; refactored into a `SECURITY DEFINER` RPC (`get_shared_planner_by_token`, migration 029) with token-scoped access, extracted the result-mapping logic into `src/lib/queries-share-mapper.ts`, and added test coverage.
