# Colors

## Issues

- ~~**Camp color palette too small** — colors repeat before hitting ~20 camps. Expand the palette so the first 20 camps all get a unique color (then cycle/hash after that).~~ Fixed 2026-04-23 (branch `fix/observed-issues-polish`): [src/lib/camp-palette.ts](src/lib/camp-palette.ts) expanded from 4 → 20 distinct dusty-pastel colors (original 4 kept at positions 0-3 for color continuity on existing camps; indices 4-19 filled with evenly-spaced hues at similar S/L). Cycles after 20. Tests updated in [tests/lib/camp-palette.test.ts](tests/lib/camp-palette.test.ts).
