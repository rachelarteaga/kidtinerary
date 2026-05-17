# Color-Coded Tabs Design

> **Status:** Approved by Rachel via visual mockup at `.superpowers/brainstorm/.../tab-final.html`. Ready for implementation.

## Goal

Replace the current pill-style tab toggle on the planner left rail (and the mirroring mobile tabs on `/account/planners`) with browser/file-folder-style tabs that **carry a color identity** — grey for "mine" content, light blue for "friends' / shared" content. The active tab's color extends into the content area below, so the entire pane visually communicates which "world" the user is in.

## Surfaces affected

1. **`/planner` desktop left rail** — `src/components/planner/planner-rail.tsx`
   - Tab labels: **"My activities"** (grey) | **"Friends' plans (N)"** (blue)
   - Content area below the tabs adopts the active tab's color
   - Rail also gets wider so "Friends' plans (1)" never wraps

2. **`/account/planners` mobile tabs** — `src/app/account/planners/client.tsx`
   - Tab labels: **"My planners"** (grey) | **"Shared with me (N)"** (blue)
   - Page content cards remain on their existing page background — no "content area shift" applies on this surface (it's a flat page, not a rail)
   - Tab styling uses the same color/border/shape treatment for visual consistency with the rail

## Visual specification

### Shape
File-folder rectangles with **rounded top corners only**. `border-radius: 8px 8px 0 0` (Tailwind `rounded-t-lg`).

### Borders
- **Active tab:** top, left, right borders in `--color-ink` (#151515) at 1.5px. **NO bottom border** — uses `margin-bottom: -1.5px` to overlap the tabbar's bottom divider, visually merging with the content area below.
- **Inactive tab:** top, left, right borders in `--color-ink-3` (#c0c0c0) at 1.5px (faded). Also NO bottom border (sits naturally on the tabbar's divider line).
- **Tabbar divider:** single horizontal line in `--color-ink` (1.5px) running the full width below the tabs. Acts as the seam between tabs and content.

**No double line** anywhere — only the tabbar's bottom divider draws that horizontal segment; tabs never add their own bottom border.

### Colors

| Element | "Mine" side (grey) | "Friends" side (blue) |
|---|---|---|
| **Active tab background** | `#ebecee` | `#dfecf5` (existing — was the rail's previous bg) |
| **Active tab border** | `--color-ink` (#151515) | `--color-ink` (#151515) |
| **Active tab text** | `--color-ink` | `--color-ink` |
| **Active content area** (rail only) | `#ebecee` (matches tab) | `#dfecf5` (matches tab) |
| **Inactive tab background** | `#f5f5f6` (very washed, hint of grey) | `#f1f6fa` (very washed, hint of blue) |
| **Inactive tab border** | `--color-ink-3` (#c0c0c0) | `--color-ink-3` (#c0c0c0) |
| **Inactive tab text** | `#999` (muted) | `#999` (muted) |

### "Blank space" around tabs
The area **above** the tabs (inside the rail's top padding) and the area **between** the tabs (the gap) renders as `--color-surface` (#ffffff white). The colored region of the rail only begins at the active tab's bottom edge — below the divider line.

### Rail width
Bump the desktop rail from `w-80` (320px) to `w-96` (384px), so "Friends' plans (1)" fits on one line without wrapping.

### Typography
Tab text: `font-sans font-bold text-[10px] uppercase tracking-widest` — slightly tighter than the prior pill treatment to fit comfortably in two narrow tabs.

### Spacing
- Tab padding: `px-2.5 py-2` (slight horizontal squeeze vs. previous `px-3`)
- Tabbar padding (the white area around the tabs): `pt-[14px] px-[14px]` so tabs have ~14px of white above and to the sides

## Out of scope

- **Mobile bottom sheet** (My Activities sheet on /planner) — unchanged. Mobile rail still single-purpose; no Friends' Plans tab on mobile per V1 scope.
- **`<SaveShareCTA>` button** on the share viewer — that's an action button, not section navigation. Stays as a pill.
- **Vertical "writing on the tab" or icon treatments** — out of scope. Plain text labels only.
- **Animation** beyond the existing CSS `transition-colors` — no slide/scale/morph on tab change.

## File-level changes summary

- `src/components/planner/planner-rail.tsx`: tab CSS + content-area bg coupling (color shifts when tab swaps) + wider rail (`w-80` → `w-96`).
- `src/app/account/planners/client.tsx`: matching tab CSS for the mobile-only tab row.
- No new components, no new CSS tokens. (Inactive tab `#f5f5f6` and `#f1f6fa` are inline hex; if the design system grows we can promote them to `--color-mine-faded` / `--color-friends-faded` later.)

## Accessibility

- Existing ARIA roles preserved: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`.
- Contrast checks:
  - Black text on `#ebecee` (active grey): ~16:1 — exceeds AA.
  - Black text on `#dfecf5` (active blue): ~16:1 — exceeds AA.
  - `#999` text on `#f5f5f6` (inactive grey): ~2.8:1 — passes AA for large/bold text only. Since tab text is bold uppercase at 10px (functionally treated as a label, not body text), acceptable but noted as the weakest contrast in the design.

## Implementation note

This supersedes PR #54 (which was approved as "file folder shape A" but used pure-white active bg + non-faded inactive tabs). Implementation will push new commits to that branch and update the PR description to match this final design.
