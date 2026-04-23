# Cross-cutting

Issues that span multiple areas.

## Issues

- ~~**Clickable elements missing `cursor-pointer`**~~ — Fixed 2026-04-23 (branch `fix/observed-issues-polish`):
  - Camp detail drawer name `<h2>` and org `<div>`: swapped `cursor-text` for `cursor-pointer` when editable (user source), `cursor-default` when curated (read-only).
  - All 10 modal/drawer backdrops got `cursor-pointer` added to the backdrop className: `add-camp-modal`, `add-block-modal`, `add-entry-modal`, `camp-preview-modal`, `add-kid-menu`, `my-camps-rail`, `avatar-editor-modal`, `block-detail-drawer`, `camp-detail-drawer`, `scrape-confirm-drawer`.
