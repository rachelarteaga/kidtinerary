# Cross-cutting

Issues that span multiple areas.

## Issues

- ~~**Clickable elements missing `cursor-pointer`**~~ — Fixed 2026-04-23 (branch `fix/observed-issues-polish`):
  - Camp detail drawer name `<h2>` and org `<div>`: swapped `cursor-text` for `cursor-pointer` when editable (user source), `cursor-default` when curated (read-only).
  - All 10 modal/drawer backdrops got `cursor-pointer` added to the backdrop className: `add-camp-modal`, `add-block-modal`, `add-entry-modal`, `camp-preview-modal`, `add-kid-menu`, `my-camps-rail`, `avatar-editor-modal`, `block-detail-drawer`, `camp-detail-drawer`, `scrape-confirm-drawer`.

- **Scrape-confirm drawer silently shows empty stub when LLM call fails** — when `callLLM` returns an error (e.g. Anthropic credit balance hits 0, rate limit, network), `extractWithLLM` returns `activities: []` with the error in `errors[]`. In [src/scraper/on-demand.ts:121](src/scraper/on-demand.ts:121) the confidence gate falls through, `upsertActivity` is never called, and the job resolves with `confidence: "none"` and the untouched submitCamp stub (name="New camp", org=null). The drawer then renders the stub as a "successful" scrape with blank fields — it only shows the "⚠ Couldn't fetch details" card when `status = "failed"`, not when LLM extraction itself errored. Fix: when `extracted.errors` is non-empty AND `activities.length === 0`, mark the job `status: "failed"` (or a new `status: "llm_error"`) so the drawer surfaces the error state instead of a blank form. Context: discovered 2026-04-23 debugging a Zebra Robotics URL that turned out to be a billing issue, not a code regression.
