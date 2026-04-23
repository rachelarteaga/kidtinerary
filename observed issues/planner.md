# Planner

The weekly planner view.

## Issues

- ~~**Cost paid not centered on status button** — on the camp card in the planner, the "cost paid" value isn't centered within the status button.~~ Fixed 2026-04-23 (commit on `account-menu-updates`): added matching `py-0.5 border border-transparent leading-none` to the price span in `planner-cell.tsx` and `shared-planner-view.tsx` so it boxes to the same height as the status pill.
- **Camp name shows text cursor instead of pointer on hover** — clickable camp names in the planner should use `cursor-pointer`. (See cross-cutting note for other spots where this is missing.)
