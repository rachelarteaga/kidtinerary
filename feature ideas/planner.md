# Planner

The weekly planner view. Route: `/planner`.

## Ideas

- **Copy a week onto another week.** Works within a single kid or across kids. Copies the source week exactly; user edits after. Useful for siblings on similar schedules or repeating a known-good week.
- **Reorder and visually separate planner toolbar buttons.** Add, Share, date range, and detail/simple view toggle are currently grouped together with no visual break — they serve different purposes (create vs. share vs. navigate vs. view mode) and should read as distinct clusters.
- **My activities rail: split into "All activities" and "This planner"** (added 2026-04-23 as multi-planner support lands). Today the rail shows every `user_activity` for the account, regardless of whether it's placed on the active planner. Proposed: two sections (or a toggle) — "This planner" (only activities with ≥1 `planner_entry` on the current `planner_id`) and "All activities" (the full account list). Lets users find activities relevant to the planner they're actively building without losing the account-wide view when starting a new planner. Future: filters + sorts sit on top of this split (see existing note). Touches `my-activities-rail.tsx` + `fetchUserActivities` (would need per-planner placement count).
