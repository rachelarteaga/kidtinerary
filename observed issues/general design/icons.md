# Icons

## Issues

- ~~**Moon icon (overnight indicator) reads as a cookie with a bite** — stroke is too thick / crescent isn't pronounced enough. Refine so it's unambiguously a moon.~~ Fixed 2026-04-23 (branch `fix/observed-issues-polish`): swapped the 4 inline SVG paths (in `cell-timeline-grid.tsx`, `planner-cell.tsx`, `considering-chips.tsx`) from a thick two-arc crescent to the Heroicons/Feather-style moon path (`M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z`) — proper "C" shape with pronounced taper.
