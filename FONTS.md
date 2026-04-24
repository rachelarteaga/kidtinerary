# Kidtinerary fonts

- **Outfit** — body / sans (`--font-sans` in `src/app/globals.css`). Weights loaded: 400, 500, 600, 700.
- **Figtree** — display (`--font-display`). Weights loaded: 400, 500, 600, 700, 800.

**Non-obvious gotcha:** the `src/app/layout.tsx` variable naming (`--font-figtree`, `--font-outfit`) suggests Figtree is body — it isn't. Outfit is body. Figtree is display/headings. Double-check `globals.css` `@theme` before describing the pairing.

Both are loaded via `next/font/google` in `src/app/layout.tsx`.
