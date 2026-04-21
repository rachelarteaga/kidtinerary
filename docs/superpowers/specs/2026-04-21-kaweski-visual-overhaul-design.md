# Kidtinerary Visual Overhaul — kawe.ski-inspired

**Status:** draft for review
**Date:** 2026-04-21
**Context:** Adopt kawe.ski's design sensibility — sans-serif type pairing, 1px near-black outlines, soft offset shadows — but with a custom palette tuned for Kidtinerary. All existing layout/positioning, label text, and component behavior stays unchanged.

## Problem

Kidtinerary's current visual identity is a warm outdoor/camp theme (cream/bark/sunset/meadow with DM Serif + Inter + JetBrains Mono). The new direction is inspired by [kawe.ski](https://kawe.ski) — but we diverge on palette (keeping only the ink/disabled tokens verbatim) and we explicitly drop kawe.ski's thick hard `2px 2px 0 #151515` block shadow.

The app already has multiple parallel color-coding schemes (kid colors, camp status, block type, hero accent). The overhaul must *reduce* total color noise, not add to it.

## Goals

1. Swap fonts (DM Serif / Inter / JetBrains Mono → Figtree / Outfit).
2. Swap colors to a new cool-paper base with restrained saturated accents.
3. Thin containers to 1px ink outlines with 12–16px radius; apply the single soft offset shadow.
4. Replace kid identity-by-color with identity-by-shape (four equilateral shapes).
5. Replace block-type-by-color with a single semi-transparent dot-grid treatment + new filled black icons.
6. Preserve every page/component's existing layout, positioning, label text, and structural sizes.

## Non-Goals

- Restructuring pages, navigation, grid layouts, or component hierarchies.
- Changing component behavior, label text, interaction patterns, or information architecture.
- Replacing or renaming image/illustration assets.
- Introducing the thick hard `2px 2px 0 #151515` block shadow from kawe.ski.
- Porting kawe.ski's custom cursors, selection corners, gradient backgrounds, or lavender/secondary palette.
- Adding new UI (current-week chips, enriched subtitles, status indicators, etc.).

## Design Tokens

### Color

Old tokens (`cream`, `bark`, `sunset`, `campfire`, `meadow`, `lake`, `driftwood`, `sand`, `stone`) are **retired**. New semantic palette:

| Token | Hex | Role |
|---|---|---|
| `base` | `#f7f8fa` | Schedule-region container on /planner · focused input fills · not the body bg |
| `surface` | `#ffffff` | Body background (all pages) · cards, sections, drawers, modals |
| `ink` | `#151515` | Primary text, icons, borders |
| `ink-2` | `#666666` | Secondary text, helper copy |
| `ink-3` | `#c0c0c0` | Tertiary text, disabled text, dashed borders |
| `ink-inverse` | `#ffffff` | Text on dark surfaces |
| `hero` | `#fbbf0e` | Brand yellow — nav bar, Registered state pill, current-week highlight |
| `hero-light` | `#ffe082` | Lighter yellow for faint/tinted uses (rarely used — most UI stays off yellow) |
| `status-considering` | `#e8edf1` | Soft cool gray |
| `status-waitlisted` | `#ffd4b8` | Muted coral peach |
| `status-registered` | `#fbbf0e` | Same as `hero` — the one place yellow repeats |
| `camp-periwinkle` | `#8fa8d4` | Camp palette #1 |
| `camp-mint` | `#8ec4ad` | Camp palette #2 |
| `camp-lilac` | `#b095d4` | Camp palette #3 |
| `camp-rose` | `#d49bbe` | Camp palette #4 |
| `disabled` | `#eeeeee` | Disabled surface |
| `disabled-accent` | `#c0c0c0` | Disabled border/text (= `ink-3`) |
| `conflict` | `#ef8c8f` | Outline color for timeline conflicts (from kawe.ski's attention-accent) |

**Yellow usage policy** — the hero color is strictly restricted:
- ✅ Allowed: top nav bar background, "Registered" status pill fill, (rare) current-week highlight or featured moments.
- ❌ Not allowed: buttons (primary CTA is ink black, not yellow), focus rings, hover states, body text, card fills, progress bars, active tab indicators.

**Camp palette usage** — these four colors appear only in:
- Timeline grid square fills inside a detail-view cell.
- The 7–10px colored dot next to a camp name on camp cards and legend rows.
- Considering-chip dots.

They never appear on buttons, backgrounds, or decorative elements.

**Semantic remapping of current usages:**

| Old Tailwind class | New class |
|---|---|
| `bg-cream`, body bg | `bg-surface` (body is now white, not base) |
| `bg-cream` used as card surface | `bg-surface` (body + card both use white now) |
| `bg-bark`, `text-bark` | `bg-ink`, `text-ink` |
| `bg-sunset` (primary CTA orange) | `bg-ink` (primary button turns ink; sunset retires) |
| `bg-meadow` | context-dependent — often replaces with camp-mint or status-registered |
| `bg-campfire`, `bg-sand` | `bg-hero-light` or retires — review per site |
| `bg-lake` | `bg-camp-periwinkle` or ink |
| `border-driftwood` | `border-ink` (default) or `border-ink-3` (quiet divider) |
| `text-stone` | `text-ink-2` |

The per-kid color assignment in `src/lib/kid-palette.ts` is retired entirely (see Kid Identity below).

Per-camp color assignment (used by the timeline grid) stays in place but the 4-color palette changes to the `camp-*` tokens above. Assigned in rotation as camps are added.

### Typography

Old fonts (DM Serif Display, Inter, JetBrains Mono) are **retired**. Replaced with:

- **Figtree** (Google Fonts, weights 400/500/600/700/800) — display, page titles, kid names, section headings.
- **Outfit** (Google Fonts, weights 400/500/600/700) — body, labels, inputs, buttons, meta text.

No monospace font.

**Type scale:**

| Role | Font | Size / LH | Weight | Letter-spacing |
|---|---|---|---|---|
| Page title (planner name, etc. — was DM Serif text-4xl) | Figtree | 36 / 1 | 800 | -0.03em |
| h2 / large section head | Figtree | 32 / 1.1 | 500 | -0.03em |
| h3 / card name in column header | Figtree | 16–20 / 1.15–1.25 | 800 | -0.01em |
| body-regular | Outfit | 16 / 1.45 | 400 | -0.01em |
| body-accent / card name | Outfit | 13–15 / 1.35 | 700 | -0.01em |
| meta / subtitle | Outfit | 11–12 / 1.3 | 500 | 0 |
| caps label (see rule below) | Outfit | 11 / 1.3 | 700 | uppercase + 0.15em tracking |

**All-caps labels rule (IMPORTANT — reverses earlier broad retirement):** Labels that currently use `font-mono text-[N]px uppercase tracking-widest` keep their `text-transform: uppercase` and `letter-spacing` in the new design. Only the `font-family` swaps (mono → Outfit) and `color` updates (stone → ink-2, etc.). Applies to:
- View-mode toggle labels (`DETAIL` / `SIMPLE`).
- `+ ADD` buttons in the planner header and cell empty states.
- Week labels (`JUL 06 – JUL 10`).
- State badge text (`REGISTERED` / `WAITLISTED` / `CONSIDERING`) — the label style stays caps; we were going to sentence-case but the user reverted.
- Timeline grid day headers (`M T W Th F Sa Su`).
- Small meta lines on camp cards (time · price).

The user may still request sentence-case per-component during implementation — if in doubt, keep caps + tracking as the default.

### Shape

| Token | Value |
|---|---|
| `radius-xs` | 4px |
| `radius-sm` | 8px |
| `radius-md` | 12px (default for cards, camp cards, blocks, planner cells inner, buttons ≤ md) |
| `radius-lg` | 16px (sections, modals, drawer frames) |
| `radius-full` | 9999px (pills, avatars → circle shape only, icon-only buttons) |
| `stroke` | 1px (default border — thinned from kawe.ski's 1.5px per user request) |
| `stroke-thick` | 1.5px (emphasis / selected state — rare) |

Pill buttons use `border-radius: 9999px` for fully rounded ends.

**No colored side-borders (rule):** Thick colored left/right/top/bottom strokes as accent treatments are forbidden. Reads as signature AI design. Use avatars, dots, or shapes to carry identity instead.

### Shadow

Single shadow token:

```css
--shadow-soft: 3px 3px 0 0 rgba(0, 0, 0, 0.15);
```

Applied to: primary buttons (default state), nav bar, status dropdown triggers (LG state badge clickable), modals, drag overlay. Button `:active` swaps it with `-1px -1px 0 0 rgba(0, 0, 0, 0.15)` plus a 2px translate.

**Excluded:**
- `2px 2px 0 0 #151515` thick block shadow (kawe.ski's `--effect-box-shadow-right/left`).
- `inset 3px 3px 0 0 rgba(0,0,0,0.25)` input-focus shadow.

### Focus ring

Since lavender is retired, focus goes to ink:

```css
outline: 2px solid #151515;
outline-offset: 2px;
```

## Component Treatments

Visual-only updates; no positioning or behavioral changes.

### Buttons (`src/components/ui/button.tsx`)

Current variants: `primary` / `dark` / `outline` / `nature` / `ghost`. All get 1px ink border, pill radius, Outfit 700 label. Caps + tracking preserved where the existing class uses them.

| Variant | Background | Text | Hover | Shadow |
|---|---|---|---|---|
| `primary` | `#151515` (ink) | `#ffffff` | `#333333` | `--shadow-soft` default; offset on `:active` |
| `dark` | `#151515` | `#ffffff` | `#333333` | Same as primary — consider consolidating |
| `outline` | `#ffffff` | `#151515` | `#eeeeee` | None |
| `nature` | `#d8f0e6` (success tint, retained for planner "nature" contexts) | `#151515` | `#5fc39c` | Optional |
| `ghost` | transparent | `#151515` | `rgba(21,21,21,0.06)` | None — no border either |

**Notable swap:** `primary` stops being yellow. Primary CTA is ink black. Yellow is reserved for nav + Registered pill per the Yellow Usage Policy.

### Planner camp card (`src/components/planner/camp-card.tsx`)

- Container: `bg-surface` (white, always) + 1px ink border + 12px radius.
- Name: Outfit 14–15/700, `#151515`.
- Kid-identity marker (new): 10px solid ink **shape** next to camp name (circle/square/triangle/diamond per the kid owner). See Kid Identity below.
- Meta line (time · price): Outfit 11/500 `#666`, sentence case **or** caps per current code (preserve `uppercase`/`tracking` if present).
- Remove ✕: `#c0c0c0`.
- State pill: see State Badge below.
- Shared-with note: Outfit 11/600 `#151515`, sentence case, ✦ glyph prefix. Dropped mono uppercase treatment (`text-meadow` retires).
- Never uses per-status background fill (no mint fill on registered/shared).

### Planner cell — detail view (`src/components/planner/planner-cell.tsx`)

Three stacked regions inside a white card (1px ink, 10px radius):

1. **Timeline grid** (`cell-timeline-grid.tsx`): 22px label column + 7 day columns. Day headers: caps + tracking, Outfit 9/700 `#666` (weekend: `#c0c0c0`). AM/PM slot labels: caps + tracking, Outfit 8/700 `#c0c0c0`. Squares: 14px tall, 3px radius. Fill is `camp-*` token per entry; waitlisted uses 45° striped gradient of the camp color; weekend-empty gets `#eeeeee` + dashed `#e0e0e0` border; out-of-range gets hatched neutral gray; conflict gets 2px outline in `#ef8c8f`.
2. **Legend rows** (one per registered/waitlisted camp): 8px camp-colored dot + camp name (Outfit 12/600) + status pill (right-aligned SM size).
3. **Considering chips** at the bottom, below a dashed `#c0c0c0` divider. Label: "CONSIDERING (N)" — caps + tracking, Outfit 9/700 `#666`. Chips: 1px dashed `#c0c0c0` border, pill, white background, 6px camp-colored dot + camp name (Outfit 11/400 `#151515`).

### Planner cell — simple view

Single row inside a white card: 8px camp-colored dot + camp name + "+N" if multiple + status pill. Fonts and borders match the detail-view version.

### Planner empty-cell states

Simple view: `border: 1px dashed #c0c0c0` pill (the existing empty button), `+ ADD` in caps + tracking + Outfit 11/700 `#666`. Detail view: same but taller.

### Kid column header (`src/components/planner/kid-column-header.tsx`)

- Container: white + 1px ink + 12px radius. **No colored left border** — the prior 4px colored left-stripe treatment is removed entirely.
- Drag handle ⋮⋮: `#c0c0c0`.
- Avatar: see Kid Identity below.
- Name: Figtree 16/800 `#151515`, -0.01em tracking.
- Age: Outfit 11/500 `#666` sentence case (drops mono uppercase).
- ⋯ menu button: `#c0c0c0`. Menu popup: 1px ink, 10px radius, soft shadow, white. "Remove from planner" text: `#ef8c8f`, hover: `#fdebec` row fill.

### Kid Identity (NEW)

Retires kid-specific colors. Each kid gets one of four **equilateral shapes** assigned in creation order:

1. 1st kid → **Circle**
2. 2nd kid → **Square**
3. 3rd kid → **Triangle** (equilateral, point-up)
4. 4th kid → **Diamond** (square rotated 45°)

- Avatars are ink-filled (`#151515`) with white-initial text (Figtree 800), 1px ink stroke. Photo uploads crop to the assigned shape.
- The same shape appears as a **10px solid ink marker** next to the camp name on every camp card in that kid's column (replacing the old colored dot).
- Avatar edit hover: ink overlay at 55% opacity with "Edit" text (Outfit 9/700 `#fff`).
- **Caveat:** caps at 4 kids per planner. If a user adds a 5th, the plan is to introduce a 5-pointed star as the 5th shape. Until that's implemented, 4 is the supported ceiling — flag during QA if users commonly plan for 5+.
- `src/lib/kid-palette.ts` color-picking functions are retired. A new `src/lib/kid-shape.ts` (or inline) assigns shape by sort order.

### Block card (`src/components/planner/block-card.tsx`)

Replaces emoji + pastel-fill-per-type with filled black icons + one semi-transparent dot-grid treatment shared across all four block types. Block type is conveyed by icon + title only; no type-specific fills.

**Icons (filled black SVG, 22px rendered at 16–20px):**
- `school` — mortarboard (graduation cap): `<svg viewBox="0 0 24 24" fill="#151515"><path d="M12 2 L1 7 L12 12 L21 8.1 L21 14 L23 14 L23 7 Z"/><path d="M5 10.5 L5 15.5 C5 17.5 8.5 19 12 19 C15.5 19 19 17.5 19 15.5 L19 10.5 L12 14 Z"/></svg>`
- `travel` — paper-airplane dart: `<svg viewBox="0 0 24 24" fill="#151515"><path d="M22 2 L2 10 L10 13 L13 22 Z"/></svg>`
- `at_home` — house + chimney: `<svg viewBox="0 0 24 24" fill="#151515"><path d="M12 3 L2 11 L4.5 11 L4.5 20 L9 20 L9 14 L15 14 L15 20 L19.5 20 L19.5 11 L22 11 Z"/><rect x="16" y="5" width="2" height="3.5"/></svg>`
- `other` — 5-pointed star: `<svg viewBox="0 0 24 24" fill="#151515"><polygon points="12,2 14.5,9 22,9 16,13.5 18.5,21 12,16.5 5.5,21 8,13.5 2,9 9.5,9"/></svg>`

**Background treatment** (all types, one shared recipe):

```css
background-image: radial-gradient(rgba(21,21,21,0.09) 0.7px, transparent 0.7px);
background-size: 5px 5px;
background-color: rgba(21,21,21,0.04);
```

A 4% solid ink tint (so text has a clearly defined surface) + a 9% ink dot grid on 5px spacing (so it reads as "block" texture, not color).

- Border: 1px `#151515`, 12px radius.
- Title: Outfit 13/700 `#151515` sentence case.
- Subtitle: Outfit 11/500 `#666` (drops mono uppercase — subtitle is OK to lowercase since the existing copy is hand-entered).
- `TYPE_STYLES` map in `block-card.tsx` collapses to a single style with per-type icon only.

### State badge (`src/components/planner/state-badge.tsx`) + variants

All share: 1px ink border, pill radius, `#151515` text, **caps + 0.15em tracking preserved** (current code uses `font-mono text-[10px] uppercase tracking-wide`). Font family swaps mono → Outfit. Existing sizes in code:

| Usage | Font size | Padding |
|---|---|---|
| Inline state badge (camp card, default) | 10px | `px-2.5 py-1` |
| Legend row / timeline-cell inline pill | 9px | `px-1.5 py-0.5` |

Background per status (new palette):
- Considering → `#e8edf1`
- Waitlisted → `#ffd4b8`
- Registered → `#fbbf0e`

Don't introduce new badge sizes beyond what's in code today.

### Status dropdown (`src/components/planner/status-dropdown.tsx`)

Separate component from state badge. Trigger is a **white** pill (not a colored status pill) with a small 8px status-colored dot + status label in **sentence case** + ▾ chevron. Current code uses `font-medium text-bark text-[11px]` (sm) or `text-xs` (md). This component's labels are NOT caps — sentence case stays.

Token swaps:
- Border: `border-driftwood/40` → `1px solid #c0c0c0` rest, hover → `#151515`.
- Status dot colors: update from old earthy tones (`#c8a76a`/`#e5c89a`/`#7fa06a` in current code) to new status palette (`#e8edf1`/`#ffd4b8`/`#fbbf0e`). At 8px dot size the pastel yellow may need a thin 1px ink ring to remain visible on white — add if the lighter dots disappear.
- Label: `text-bark` → `#151515`, `text-stone` chevron → `#666`.
- Font: ensure Outfit (inherits from body). Keep `font-medium` weight.
- Popup: `border-driftwood/30 rounded-lg shadow-lg` → `1px solid #151515`, `rounded-[10px]`, `--shadow-soft`, white. Option hover `bg-driftwood/10` → `bg-[#f7f8fa]`. Selected row `bg-driftwood/5` → no background; keep the `✓` but swap `text-meadow` → `#5fc39c`.

### Shared badge (`src/components/planner/shared-badge.tsx`)

Text line under the state pill on cards. Outfit 11/600 `#151515` sentence case, ✦ glyph prefix. Retires mono uppercase tracking-widest + `text-meadow`.

### Inputs / form controls

Border `1px #c0c0c0` rest → `1px #151515` hover/focus. Radius 8px. White background default; `#f7f8fa` (base) when focused. No inset shadow. Focus ring: 2px solid `#151515`, `outline-offset: 2px`.

### Nav — full-bleed header (`src/components/layout/nav.tsx`)

**Structural change:** nav becomes an edge-to-edge hero bar, not a contained card. No border-radius, no side margins — stretches full viewport width. This is a deliberate departure from planner card language so the header reads as app chrome.

- Background: `#fbbf0e` (hero yellow), full-bleed.
- Bottom border: `1px solid #151515`.
- Shadow: `0 3px 0 0 rgba(0, 0, 0, 0.15)` below (horizontal variant of `--shadow-soft`).
- Inner container: `max-w-7xl mx-auto`, padding `py-[18px] px-6`.
- Brand: Figtree 24/800, `#151515`, letter-spacing `-0.02em`. Size bumps from current 18px.
- Keep the existing auth/onboarding hide behavior.

**Nav item structure (LABEL CHANGES — explicitly sanctioned):**

Old `NAV_LINKS` (Planner · Explore · My Kids) becomes:

```
Explore (with "Coming soon!" stamp) · Planner · [auth cluster]
```

"My Kids" nav link **retires**. Its destination becomes a menu item inside the logged-in account dropdown instead.

**Nav link styling:**
- Font: Outfit 11/uppercase/0.15em tracking. No pill background, no hover fill.
- Inactive: weight 600, opacity 0.55.
- Active: weight 800, opacity 1.0. No underline, no dot, no bar — the weight+opacity shift is the entire highlight treatment.

**"Coming soon!" stamp on Explore:**
- Horizontal (no rotation), absolutely positioned below the Explore label so it doesn't push the link out of the nav row.
- Outfit 8/800 uppercase, `letter-spacing: 0.1em`.
- `color: rgba(21,21,21,0.55)`, `border: 1px solid rgba(21,21,21,0.35)`, `background: rgba(255,255,255,0.25)`, radius 3px, padding `2px 6px`.

### Auth cluster (inside Nav)

The right-side auth area has two states:

**State 1 — Unauthenticated (anonymous or signed-out):** split pill.
- Single pill-shaped container with 1px ink border, pill radius, `overflow: hidden`.
- Two halves separated by the border sharing between the two anchor children.
- Left half: "Sign In" — white fill, ink text, Outfit 11/700 uppercase 0.15em tracking, padding `8px 16px`. Hover: fill → `#f7f8fa`.
- Right half: "Sign up" — ink fill `#151515`, **white text `#ffffff`**, same typography and padding. Hover: fill → `#333`.

**State 2 — Authenticated (session):** "Account" dropdown trigger.
- White pill: `background: #ffffff`, `border: 1px solid #151515`, radius 999px, padding `8px 14px`.
- Label: "Account" (static — do NOT personalize with the user's first name), Outfit 11/700 uppercase 0.15em tracking, `#151515`.
- Chevron ▾ right of the label, font-size 10px.
- On click, opens a dropdown menu (below).

**Account dropdown menu (authenticated only):**
- Container: `1px solid #151515`, `border-radius: 12px`, `background: #ffffff`, `padding: 4px`, min-width 240px, `--shadow-soft`.
- Position: absolute, anchored to the Account pill, 8px top offset, 24px right offset.
- User identity row at top: full name (Figtree 14/800, ink) + email (Outfit 11/500, `#666`), padded `10px 12px 8px`, bottom border `1px dashed #c0c0c0`.
- Menu items: Outfit 13/500, ink, padding `9px 12px`, radius 6px. Hover bg `#f7f8fa`.
- Items (in order): **My kids** · **Account settings** · **Share preferences** · — · **Log out** (text color `#ef8c8f`, hover bg `#fdebec`).
- Divider between content items and Log out: `1px solid #e8e8e8`, 4px side margin.

**Implementation note on auth state detection:** the Nav component (or a wrapping session provider) needs to read the current auth state to pick between the split pill and the Account pill. If that signal isn't already wired, the implementation plan should include adding it.

### Toasts (`src/components/ui/toast.tsx`)

1px ink border, 12px radius, soft shadow. Per-type fill:
- Success → `#d8f0e6`
- Attention / error → `#fdebec`
- Info → `#e6ebf5`

### Planner page shell (`src/app/planner/client.tsx` + `matrix.tsx`)

Preserved exactly as coded: `140px | repeat(N, 1fr) | 48px` grid, `gap-2` between week rows, week label in left column with right border divider, AddKidMenu in the 48px column of the header row, full-row blocks span `gridColumn: 2 / span cols`. Only fonts/colors/borders swap.

**New: schedule container wrap.** The matrix gets wrapped in a dedicated container div so the schedule region has a visible "canvas" distinct from the white page body:

```css
.schedule-region {
  background: #f7f8fa;   /* base token */
  border: 1px solid #151515;
  border-radius: 16px;
  padding: 16px;
}
```

The container sits inside the existing flex layout on `/planner` (between the page header and the drag overlay zone). Empty dashed `+ Add` cells inside the matrix use `background: #ffffff` explicitly so they read as empty cards on the grey canvas (rather than blending into it).

**Header row** (lines 272–313 of `client.tsx`): `PlannerTitle` (Figtree 36/800), subtitle `{N} kid(s) · {M} weeks` (Outfit 14/500 `#666`), view-mode toggle (Detail/Simple caps + tracking preserved), `PlannerRangePicker` (token swap), `+ Add` button (caps + tracking preserved, ink primary).

Week label: Outfit 11/600 `#666` uppercase + 0.15em tracking, right border `1px solid #c0c0c0`.

**No current-week highlight is introduced** (explicitly called out — the earlier mockup added one, but it isn't in code and is out of scope).

## Memory rules (persisted)

Two rules were saved to long-term memory during the brainstorm and apply to this and future work:
1. **No colored left/side borders** anywhere in the UI — signature-AI trope. Carry color identity via avatars, dots, or shapes.
2. **Keep existing all-caps labels.** Where current code uses `uppercase tracking-widest`, swap only `font-family` and `color`. Do not sentence-case these labels.

## Implementation Outline

1. **Tokens in `src/app/globals.css`.** Replace `@theme` with the new token set above. Load Figtree + Outfit via `next/font/google` in `src/app/layout.tsx`; drop DM Serif, Inter, JetBrains Mono from the imports.
2. **Body styles.** `body { background: #ffffff; color: #151515; font-family: Outfit; }`. Body is white; the grey base (`#f7f8fa`) only appears inside the `.schedule-region` container on `/planner`.
3. **Kid identity rewrite.** Replace `src/lib/kid-palette.ts` with shape-based identity. Build a small `KidShape` component (SVG) that takes shape + fill (ink or photo) + size + optional initial. Update `kid-avatar.tsx` to render shape instead of colored circle. Update camp-card / legend-row / considering-chip markers to render the 10px solid shape instead of the colored dot.
4. **Button component rewrite.** `src/components/ui/button.tsx` — swap font to Outfit, keep `uppercase tracking-widest` on existing variants, adopt new fill/text per the variant table. Add `--shadow-soft` by default + the active-state offset.
5. **Tag component rewrite.** `src/components/ui/tag.tsx` — 1px ink border, pill, Outfit 14/500 or 14/700 per usage.
6. **Block card rewrite.** `src/components/planner/block-card.tsx` — replace `TYPE_STYLES` map with a single shared style and per-type SVG icons; remove `emoji` string usages.
7. **Kid column header rewrite.** Remove the 4px colored `border-l-4` treatment entirely. Keep the rest.
8. **Timeline grid + legend + considering chips.** Swap fills from kid colors to the new `camp-*` palette, swap fonts/borders.
9. **State badge + shared badge.** Update fonts/colors to the tables above; preserve caps+tracking on state badge label.
10. **Nav rewrite (`src/components/layout/nav.tsx`).** Full-bleed hero header, new `NAV_LINKS` array (Explore + Planner only — drop "My Kids"), "Coming soon!" stamp on Explore, auth cluster component with split-pill (unauth) / Account-pill + dropdown (auth) states. Requires reading session state — add a client-side session hook if not already present. Account dropdown menu items route to the existing `/kids` page for "My kids", and new/existing routes for Account settings + Share preferences + Log out.
11. **Schedule region wrap.** In `src/app/planner/client.tsx`, add a container around the `PlannerMatrix` with `bg-base`, 1px ink border, 16px radius, 16px padding. Ensure empty `+ Add` cells in `planner-cell.tsx` explicitly set a white background.
12. **Toasts, inputs, drawers, modals.** Token/font swap per component sections.
13. **Global Tailwind-class codemod.** ~460 usages across 54 files. Walk the Semantic Remapping table per file. Per-file review where the old token's role is ambiguous (notably `border-driftwood`, `bg-cream`, `bg-campfire`, `bg-sand`).
14. **Retire `font-serif`, `font-mono`.** Per-usage remove. `uppercase`, `tracking-widest` STAY where present.
15. **Visual QA pass.** Walk every route (landing, /explore, /activity/[slug], /kids, /planner, /onboarding, /auth/*, /submit, /schedule/[token]) and confirm nothing shifts positionally.

## Risks

- **Kid-identity migration.** Existing planners have kids with `color` values stored. The DB column can remain but go unused by the UI. Display-side, assign shape by `sort_order` within a planner. Need to confirm there's no downstream consumer of kid color (e.g., shared schedule view, exports). Mitigation: grep for `child.color` usage before rollout.
- **5+ kids.** System caps at 4 shapes. If a parent has 5+ kids on one planner, shapes collide. Mitigation: detect and warn in the kid-shape helper; plan to add a star shape as #5 when the real need appears.
- **Semantic ambiguity in old tokens.** `driftwood`, `campfire`, `sand` used inconsistently. Mitigation: codemod walks files in small batches with visual diffs.
- **`bg-cream` used as card surface vs page background.** Needs per-component inspection during codemod.
- **All-caps labels rule is a reversal.** Earlier in the brainstorm I noted "drop mono uppercase app-wide." The user later clarified keep existing caps+tracking. During implementation, default to preserving these when in doubt.
- **Contrast checks:** Yellow `#fbbf0e` nav background with ink text passes AA. `ink-2` (`#666`) on base (`#f7f8fa`) passes AA for 14px+ body. Coral `#ffd4b8` and soft gray `#e8edf1` state pills rely on the 1px ink border + ink text for definition — both pass with the outlined pill treatment.

## Open Questions

None outstanding.
