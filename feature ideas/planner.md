# Planner

The weekly planner view. Route: `/planner`.

## Ideas

- **Copy a week onto another week.** Works within a single kid or across kids. Copies the source week exactly; user edits after. Useful for siblings on similar schedules or repeating a known-good week.
- **Simple view: show all camps when a week has 2+.** Currently the simple view doesn't surface every camp when a week has multiple — update so all are visible at a glance.
- **Rework the "My Camps" rail.** The current title is too non-descript and the treatment needs a rethink — what's this list *for*, and what's the right label/visual to convey that? (See `src/components/planner/my-camps-rail.tsx`.)
- **Reorder and visually separate planner toolbar buttons.** Add, Share, date range, and detail/simple view toggle are currently grouped together with no visual break — they serve different purposes (create vs. share vs. navigate vs. view mode) and should read as distinct clusters.
