# Mobile view

Issues specific to small-screen / mobile breakpoints.

## Issues

- ~~**Drag and drop doesn't work on mobile**~~ — Fixed 2026-04-24 (branch `fix/mobile-polish`): replaced drag-drop on mobile with a tap-to-place flow. My-camps rail collapsed into a bottom sheet (floating "My Camps (N)" pill → tap to expand, backdrop to dismiss). Tapping a camp enters placement mode: the sheet closes, a sticky banner appears at top ("Tap a week to place [Camp]"), planner cells render their drop-zone overlay as tappable targets, and tapping one reuses the existing status-picker popover to assign. After save, the cell smooth-scrolls into view and flashes a ring. Desktop `@dnd-kit` drag-drop preserved unchanged via a `fromPlacement` flag on `pendingAssignment`.
- ~~**Nav items should move to a hamburger menu**~~ — Fixed 2026-04-24 (same branch): [nav.tsx](src/components/layout/nav.tsx) rewritten. Removed the bottom tab bar; added a hamburger toggle (44×44 hit target) in the top sticky bar that opens a slide-down sheet with all nav links and auth controls. Every sheet row is min-h-48px. Closes on route change, Escape, or tapping the X. Also dropped the `pb-16 sm:pb-0` compensation in [layout.tsx](src/app/layout.tsx).
- ~~**Sign in / sign up / account not visible**~~ — Fixed 2026-04-24 (same branch): auth controls now live inside the hamburger sheet. Logged out = Sign in / Sign up pill pair (each min-h-48px). Logged in = user card (name + email) plus Edit profile / My kids / My planners / Log out.
- ~~**Add button looks out of place in planner view**~~ — Fixed 2026-04-24 (same branch): header `+ Add` button hidden on mobile (`hidden sm:inline-flex`) in [planner/client.tsx](src/app/planner/client.tsx). Two remaining entry points on mobile (the bottom-sheet "+ Add camp" and the empty-cell tap) are sufficient.
- ~~**Planner title placement is off**~~ — Fixed 2026-04-24 (same branch): [planner-title.tsx](src/components/planner/planner-title.tsx) made responsive (`text-[26px] sm:text-4xl`). Header in [planner/client.tsx](src/app/planner/client.tsx) now stacks vertically on mobile (`flex-col sm:flex-row`) so the title no longer wraps awkwardly.
- ~~**Button wrapping on "my planners" screen**~~ — Fixed 2026-04-24 (same branch): [account/planners/client.tsx](src/app/account/planners/client.tsx) — on mobile, Edit settings / Stop sharing / Duplicate / Delete collapse into a `⋯` overflow menu; Open + share-status stay prominent. "My planners" heading also scales down (`text-3xl sm:text-4xl`).

Kid-column reorder on mobile is still pointer-only but the narrow layout focuses one kid at a time, so reorder isn't actionable until the user widens the screen — punted from this pass.
