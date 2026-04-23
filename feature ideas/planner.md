# Planner

The weekly planner view. Route: `/planner`.

## Ideas

- **Copy a week onto another week.** Works within a single kid or across kids. Copies the source week exactly; user edits after. Useful for siblings on similar schedules or repeating a known-good week.
- **Simple view: show all camps when a week has 2+.** Currently the simple view doesn't surface every camp when a week has multiple — update so all are visible at a glance.
- **Rework the "My Camps" rail.** The current title is too non-descript and the treatment needs a rethink — what's this list *for*, and what's the right label/visual to convey that? (See `src/components/planner/my-camps-rail.tsx`.)
- **Reorder and visually separate planner toolbar buttons.** Add, Share, date range, and detail/simple view toggle are currently grouped together with no visual break — they serve different purposes (create vs. share vs. navigate vs. view mode) and should read as distinct clusters.
- **My Camps rail: split into "All camps" and "This planner"** (added 2026-04-23 as multi-planner support lands). Today the rail shows every `user_camp` for the account, regardless of whether it's placed on the active planner. Proposed: two sections (or a toggle) — "This planner" (only camps with ≥1 `planner_entry` on the current `planner_id`) and "All camps" (the full account list). Lets users find camps relevant to the planner they're actively building without losing the account-wide view when starting a new planner. Future: filters + sorts sit on top of this split (see existing note). Touches `my-camps-rail.tsx` + `fetchUserCamps` (would need per-planner placement count).
- **Clicking "My Planners" in the account dropdown should reload when already on that page.** Today if you're on My Planners and click the same link, nothing happens (same-route no-op). It should re-fetch / reload so users get fresh state (useful after changes elsewhere).
