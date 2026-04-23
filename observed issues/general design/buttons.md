# Buttons

## Issues

- ~~**Inconsistent shadow treatment**~~ — Resolved 2026-04-23 (branch `fix/observed-issues-polish`): scope narrowed per Rachel to "remove shadows on pills/buttons only" (not a full shadow-system overhaul). Stripped:
  - `primary` and `dark` variants in [src/components/ui/button.tsx](src/components/ui/button.tsx) — removed offset shadow + active press-down translate (button is now flat).
  - CTA button in [camp-preview-modal.tsx](src/components/planner/camp-preview-modal.tsx) — removed offset shadow.
  - Status picker pills — already done as part of the status-selector rewrite.
  Container shadows on modals/drawers/cards are intentional and remain.
