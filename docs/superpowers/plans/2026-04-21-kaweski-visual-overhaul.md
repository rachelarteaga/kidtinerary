# Kidtinerary Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the kawe.ski-inspired visual overhaul from [`docs/superpowers/specs/2026-04-21-kaweski-visual-overhaul-design.md`](../specs/2026-04-21-kaweski-visual-overhaul-design.md) — new tokens, fonts, kid shapes, block icons, full-bleed nav, split-pill auth, and more — without changing any layout, label text, or behavior.

**Architecture:** Bottom-up token-first approach. Phase 1 lands tokens and fonts without touching components. Phase 2 rewrites primitive components (buttons, tags, badges, avatars, shapes). Phase 3 updates planner-specific components. Phase 4 rewrites the nav with session-aware auth cluster. Phase 5 sweeps remaining pages. Each task commits independently so a failure rolls back cleanly.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4 (with `@theme` tokens), `next/font/google`, `@dnd-kit`, Supabase, Vitest + React Testing Library.

---

## Key conventions

**Before each commit:** run `npm run lint` and `npm test` — both must pass. The lint config is `eslint-config-next`. Existing Vitest setup lives in `vitest.config.ts` and `tests/setup.ts`.

**Design-spec compliance rules (persisted):**
1. Do not introduce colored left/side borders as accent treatments. Colors pass through avatars, dots, or shapes.
2. Where existing code uses `uppercase tracking-widest`, swap only `font-family` and `color`. Do NOT sentence-case those labels.

**Working branch:** all commits land on whatever branch is active. No branching required.

**Visual verification cadence:** after each major phase (end of Phase 2, 3, 4), start the dev server (`npm run dev`) and visually confirm the affected routes render correctly. The dev server runs on `http://localhost:3000`.

---

## File map

### Tokens & fonts
- Modify: `src/app/globals.css` (token definitions)
- Modify: `src/app/layout.tsx` (font loading + body classes)

### New primitives
- Create: `src/components/ui/kid-shape.tsx` (SVG shape component)
- Create: `src/lib/kid-shape.ts` (shape assignment helper)

### Rewritten components
- Modify: `src/components/ui/button.tsx`, `tests/components/ui/button.test.tsx`
- Modify: `src/components/ui/tag.tsx`, `tests/components/ui/tag.test.tsx`
- Modify: `src/components/ui/toast.tsx`

### Planner components
- Modify: `src/components/planner/kid-avatar.tsx`
- Modify: `src/components/planner/state-badge.tsx`
- Modify: `src/components/planner/shared-badge.tsx`
- Modify: `src/components/planner/kid-column-header.tsx`
- Modify: `src/components/planner/block-card.tsx`
- Modify: `src/components/planner/camp-card.tsx`
- Modify: `src/components/planner/cell-timeline-grid.tsx`
- Modify: `src/components/planner/considering-chips.tsx`
- Modify: `src/components/planner/planner-cell.tsx`
- Modify: `src/components/planner/matrix.tsx`
- Modify: `src/components/planner/planner-title.tsx`
- Modify: `src/components/planner/planner-range-picker.tsx`
- Modify: `src/components/planner/status-dropdown.tsx`
- Modify: `src/components/planner/my-camps-rail.tsx`
- Modify: `src/components/planner/add-block-modal.tsx`
- Modify: `src/components/planner/add-camp-modal.tsx`
- Modify: `src/components/planner/add-entry-modal.tsx`
- Modify: `src/components/planner/add-kid-menu.tsx`
- Modify: `src/components/planner/avatar-editor-modal.tsx`
- Modify: `src/components/planner/block-detail-drawer.tsx`
- Modify: `src/components/planner/camp-detail-drawer.tsx`
- Modify: `src/components/planner/share-schedule-button.tsx`
- Modify: `src/components/planner/extras-editor.tsx`
- Modify: `src/components/planner/schedule-editor.tsx`
- Modify: `src/components/planner/cell-drop-zones.tsx`
- Modify: `src/app/planner/client.tsx` (add schedule region wrap; update header tokens)
- Modify: `src/app/planner/page.tsx` (if any server-side tokens)

### Nav
- Create: `src/components/layout/auth-cluster.tsx` (split pill + Account dropdown)
- Modify: `src/components/layout/nav.tsx` (full-bleed rewrite + new NAV_LINKS)
- Possibly modify: whatever session hook exists (or new helper)

### Other pages / components
- Modify: `src/components/explore/*` (filter-sidebar, sort-bar, search-bar, search-filter-panel, activity-list, address-input)
- Modify: `src/components/activity/*` (detail-hero, session-table, price-table, share-button, report-modal, camp-card)
- Modify: `src/components/auth/*` (login-form, signup-form)
- Modify: `src/components/onboarding/*` (address-step, child-step, interests-step)
- Modify: `src/components/kids/*` (child-card, child-form)
- Modify: `src/app/auth/**/page.tsx`
- Modify: `src/app/explore/page.tsx`
- Modify: `src/app/activity/[slug]/page.tsx` + `planner-stub.tsx`
- Modify: `src/app/kids/page.tsx` + `client.tsx`
- Modify: `src/app/schedule/[token]/page.tsx`
- Modify: `src/app/submit/page.tsx`
- Modify: `src/app/onboarding/page.tsx`
- Modify: `src/app/page.tsx` (landing)

### Palettes
- Modify: `src/lib/camp-palette.ts` (replace 8 colors with 4 cool pastels)
- Modify: `src/lib/kid-palette.ts` (deprecate color export; keep `initialFor`)

---

## Phase 1 — Foundations (tokens + fonts)

### Task 1: Replace design tokens in `globals.css`

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace the `@theme` block and body styles.**

Replace the entire content of `src/app/globals.css` with:

```css
@import "tailwindcss";

@theme {
  /* Core palette — kawe.ski-inspired with Kidtinerary-specific tuning */
  --color-base: #f7f8fa;
  --color-surface: #ffffff;
  --color-ink: #151515;
  --color-ink-2: #666666;
  --color-ink-3: #c0c0c0;
  --color-ink-inverse: #ffffff;

  /* Hero yellow — restricted to nav + Registered pill + rare featured moments */
  --color-hero: #fbbf0e;
  --color-hero-light: #ffe082;

  /* Status pills */
  --color-status-considering: #e8edf1;
  --color-status-waitlisted: #ffd4b8;
  --color-status-registered: #fbbf0e;

  /* Camp palette — 4 cool pastels used only in timeline grid fills + camp dots */
  --color-camp-periwinkle: #8fa8d4;
  --color-camp-mint: #8ec4ad;
  --color-camp-lilac: #b095d4;
  --color-camp-rose: #d49bbe;

  /* Utility */
  --color-disabled: #eeeeee;
  --color-disabled-accent: #c0c0c0;
  --color-conflict: #ef8c8f;

  /* Fonts */
  --font-display: "Figtree", sans-serif;
  --font-sans: "Outfit", sans-serif;
}

body {
  background-color: var(--color-surface);
  color: var(--color-ink);
  font-family: var(--font-sans);
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(1rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-toast-in {
  animation: toast-in 0.2s ease-out;
}
```

- [ ] **Step 2: Verify compile.**

Run: `npm run build` — expected: build fails OR completes with warnings about missing old tokens (since existing components still reference `bg-cream`, `bg-bark`, etc.). That's fine for this task; we'll fix usages in later tasks. If the build hangs or hard-fails with an unrecoverable error, stop and investigate.

- [ ] **Step 3: Commit.**

```bash
git add src/app/globals.css
git commit -m "refactor(styles): replace theme tokens with kawe.ski-inspired palette

New tokens: base, surface, ink/ink-2/ink-3, hero + hero-light (yellow),
status-considering/waitlisted/registered, camp-periwinkle/mint/lilac/rose,
disabled, conflict. Fonts switch to Figtree (display) and Outfit (sans).
Body background is now white; base grey is scoped to the schedule region.

Existing components still reference old tokens and will break until migrated
in subsequent tasks."
```

### Task 2: Load Figtree + Outfit fonts in `layout.tsx`

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Replace font imports and variable wiring.**

Replace the entire content of `src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Figtree, Outfit } from "next/font/google";
import { Nav } from "@/components/layout/nav";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-figtree",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kidtinerary — Find camps & activities your kids will love",
  description:
    "Discover local camps, classes, and extracurricular activities for kids ages 3-12 in the Raleigh/Triangle area. Plan your schedule, track favorites, and never miss a registration deadline.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${outfit.variable}`}
    >
      <body className="bg-surface text-ink font-sans antialiased">
        <ToastProvider>
          <Nav />
          <div className="pb-16 sm:pb-0">{children}</div>
        </ToastProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify it builds.**

Run: `npm run build` — should succeed or fail on non-font-related issues. Check for font-related errors specifically.

- [ ] **Step 3: Commit.**

```bash
git add src/app/layout.tsx
git commit -m "refactor(layout): load Figtree + Outfit, drop DM Serif/Inter/JetBrains

Switches the app fonts to the kawe.ski pairing. Body classes switch from
bg-cream/text-bark/font-sans to bg-surface/text-ink/font-sans."
```

### Task 3: Update `camp-palette.ts` to the new 4-color cool pastel set

**Files:**
- Modify: `src/lib/camp-palette.ts`

- [ ] **Step 1: Replace palette.**

Replace `src/lib/camp-palette.ts` with:

```ts
export const CAMP_PALETTE = [
  "#8fa8d4", // periwinkle
  "#8ec4ad", // mint
  "#b095d4", // lilac
  "#d49bbe", // rose
] as const;

export function paletteColorForCampIndex(index: number): string {
  return CAMP_PALETTE[index % CAMP_PALETTE.length];
}
```

- [ ] **Step 2: Verify.**

Run: `npm run lint` — should pass.

- [ ] **Step 3: Commit.**

```bash
git add src/lib/camp-palette.ts
git commit -m "refactor(camp-palette): swap 8 earthy colors for 4 cool pastels

Palette now: periwinkle, mint, lilac, rose. paletteColorForCampIndex wraps
at 4 instead of 8; existing camps keep their stored color (rendered unchanged
unless the color value collides with an old hex — handled on re-save)."
```

---

## Phase 2 — Primitive components

### Task 4: Create `KidShape` SVG component

**Files:**
- Create: `src/components/ui/kid-shape.tsx`
- Create: `tests/components/ui/kid-shape.test.tsx`

- [ ] **Step 1: Write the failing test.**

Create `tests/components/ui/kid-shape.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { KidShape } from "@/components/ui/kid-shape";

describe("KidShape", () => {
  it("renders a circle for index 0", () => {
    const { container } = render(<KidShape index={0} size={32} initial="M" />);
    expect(container.querySelector("circle")).not.toBeNull();
  });

  it("renders a square for index 1", () => {
    const { container } = render(<KidShape index={1} size={32} initial="L" />);
    expect(container.querySelector("rect")).not.toBeNull();
  });

  it("renders a triangle for index 2", () => {
    const { container } = render(<KidShape index={2} size={32} initial="R" />);
    const polygons = container.querySelectorAll("polygon");
    expect(polygons.length).toBeGreaterThan(0);
  });

  it("renders a diamond for index 3", () => {
    const { container } = render(<KidShape index={3} size={32} initial="S" />);
    const polygons = container.querySelectorAll("polygon");
    expect(polygons.length).toBeGreaterThan(0);
  });

  it("wraps back to circle after 4 kids", () => {
    const { container } = render(<KidShape index={4} size={32} initial="P" />);
    expect(container.querySelector("circle")).not.toBeNull();
  });

  it("renders the initial inside the shape", () => {
    const { getByText } = render(<KidShape index={0} size={32} initial="M" />);
    expect(getByText("M")).toBeInTheDocument();
  });

  it("renders a 10px dot variant with no initial when dotOnly is true", () => {
    const { container, queryByText } = render(
      <KidShape index={0} size={10} initial="M" dotOnly />
    );
    expect(container.querySelector("circle")).not.toBeNull();
    expect(queryByText("M")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npx vitest run tests/components/ui/kid-shape.test.tsx`
Expected: FAIL with "Cannot find module '@/components/ui/kid-shape'".

- [ ] **Step 3: Implement the component.**

Create `src/components/ui/kid-shape.tsx`:

```tsx
export type KidShapeType = "circle" | "square" | "triangle" | "diamond";

const SHAPE_BY_INDEX: KidShapeType[] = ["circle", "square", "triangle", "diamond"];

export function shapeForKidIndex(index: number): KidShapeType {
  return SHAPE_BY_INDEX[index % SHAPE_BY_INDEX.length];
}

interface Props {
  /** Sort order within the planner — 0-indexed. */
  index: number;
  /** Pixel size (bounding box). */
  size: number;
  /** Single-letter initial rendered inside the shape. */
  initial?: string;
  /** When true, renders a solid filled shape with no initial (small marker use). */
  dotOnly?: boolean;
  /** Override fill. Defaults to ink (#151515). */
  fill?: string;
  /** Override text color for initial. Defaults to white. */
  textColor?: string;
  /** Whether to render a 1px stroke around the shape. Defaults to true when size >= 20. */
  stroke?: boolean;
}

export function KidShape({
  index,
  size,
  initial,
  dotOnly = false,
  fill = "#151515",
  textColor = "#ffffff",
  stroke,
}: Props) {
  const shape = shapeForKidIndex(index);
  const s = size;
  const showStroke = stroke ?? s >= 20;
  const strokeAttrs = showStroke ? { stroke: "#151515", strokeWidth: 1 } : {};

  // Triangle viewBox is slightly wider to keep it visually balanced
  if (shape === "triangle") {
    const w = Math.round(s * (34 / 32));
    return (
      <svg width={w} height={s} viewBox={`0 0 ${w} ${s}`} style={{ flexShrink: 0 }}>
        <polygon
          points={`${w / 2},1 ${w - 1},${s - 1} 1,${s - 1}`}
          fill={fill}
          {...strokeAttrs}
        />
        {!dotOnly && initial ? (
          <text
            x={w / 2}
            y={s * 0.78}
            textAnchor="middle"
            fontFamily="Figtree, sans-serif"
            fontWeight="800"
            fontSize={Math.round(s * 0.38)}
            fill={textColor}
          >
            {initial}
          </text>
        ) : null}
      </svg>
    );
  }

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ flexShrink: 0 }}>
      {shape === "circle" && (
        <circle cx={s / 2} cy={s / 2} r={s / 2 - (showStroke ? 0.5 : 0)} fill={fill} {...strokeAttrs} />
      )}
      {shape === "square" && (
        <rect x={showStroke ? 0.5 : 0} y={showStroke ? 0.5 : 0} width={s - (showStroke ? 1 : 0)} height={s - (showStroke ? 1 : 0)} fill={fill} {...strokeAttrs} />
      )}
      {shape === "diamond" && (
        <polygon
          points={`${s / 2},1 ${s - 1},${s / 2} ${s / 2},${s - 1} 1,${s / 2}`}
          fill={fill}
          {...strokeAttrs}
        />
      )}
      {!dotOnly && initial ? (
        <text
          x={s / 2}
          y={s * (shape === "diamond" ? 0.63 : 0.66)}
          textAnchor="middle"
          fontFamily="Figtree, sans-serif"
          fontWeight="800"
          fontSize={Math.round(s * (shape === "diamond" ? 0.38 : 0.42))}
          fill={textColor}
        >
          {initial}
        </text>
      ) : null}
    </svg>
  );
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `npx vitest run tests/components/ui/kid-shape.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/components/ui/kid-shape.tsx tests/components/ui/kid-shape.test.tsx
git commit -m "feat(ui): add KidShape component for non-color kid identity

4 equilateral shapes assigned by sort order — circle, square, triangle,
diamond. Renders at any size; dotOnly mode for tiny markers (10px next to
camp names). Wraps past 4 kids; spec acknowledges this limitation."
```

### Task 5: Rewrite `Button` component

**Files:**
- Modify: `src/components/ui/button.tsx`
- Modify: `tests/components/ui/button.test.tsx`

- [ ] **Step 1: Update the test file first.**

Replace `tests/components/ui/button.test.tsx` with:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders with default variant (primary = ink black)", () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole("button", { name: "Click me" });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain("bg-ink");
    expect(btn.className).toContain("text-ink-inverse");
  });

  it("renders dark variant (same as primary)", () => {
    render(<Button variant="dark">Details</Button>);
    const btn = screen.getByRole("button", { name: "Details" });
    expect(btn.className).toContain("bg-ink");
  });

  it("renders outline variant (white fill, ink border)", () => {
    render(<Button variant="outline">Compare</Button>);
    const btn = screen.getByRole("button", { name: "Compare" });
    expect(btn.className).toContain("bg-surface");
    expect(btn.className).toContain("border-ink");
  });

  it("renders nature variant (success mint fill)", () => {
    render(<Button variant="nature">Add</Button>);
    const btn = screen.getByRole("button", { name: "Add" });
    expect(btn.className).toContain("bg-[#d8f0e6]");
  });

  it("renders ghost variant (transparent)", () => {
    render(<Button variant="ghost">Dismiss</Button>);
    const btn = screen.getByRole("button", { name: "Dismiss" });
    expect(btn.className).toContain("bg-transparent");
  });

  it("keeps uppercase tracking on label per spec", () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn.className).toContain("uppercase");
    expect(btn.className).toContain("tracking-widest");
  });
});
```

- [ ] **Step 2: Rewrite the Button component.**

Replace `src/components/ui/button.tsx` with:

```tsx
import { type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "dark" | "outline" | "nature" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-ink text-ink-inverse border border-ink hover:bg-[#333] shadow-[3px_3px_0_0_rgba(0,0,0,0.15)] active:shadow-[-1px_-1px_0_0_rgba(0,0,0,0.15)] active:translate-x-[2px] active:translate-y-[2px]",
  dark: "bg-ink text-ink-inverse border border-ink hover:bg-[#333] shadow-[3px_3px_0_0_rgba(0,0,0,0.15)] active:shadow-[-1px_-1px_0_0_rgba(0,0,0,0.15)] active:translate-x-[2px] active:translate-y-[2px]",
  outline: "bg-surface text-ink border border-ink hover:bg-disabled",
  nature: "bg-[#d8f0e6] text-ink border border-ink hover:bg-[#5fc39c]",
  ghost: "bg-transparent text-ink border-0 hover:bg-ink/5",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`rounded-full font-sans text-xs uppercase tracking-widest font-bold px-6 py-2.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 3: Run tests.**

Run: `npx vitest run tests/components/ui/button.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add src/components/ui/button.tsx tests/components/ui/button.test.tsx
git commit -m "refactor(button): new variants per visual overhaul

primary/dark -> ink black filled with white text + soft offset shadow.
outline -> white fill, ink border. nature -> mint success fill. ghost
retains transparent background. Removes old sunset/bark/meadow/driftwood
references. Keeps uppercase+tracking per spec — only font-family changes."
```

### Task 6: Rewrite `Tag` component

**Files:**
- Modify: `src/components/ui/tag.tsx`
- Modify: `tests/components/ui/tag.test.tsx`

- [ ] **Step 1: Read the current tag component.**

Run: `cat src/components/ui/tag.tsx` to see what props it exposes.

- [ ] **Step 2: Update tag test.**

Open `tests/components/ui/tag.test.tsx` and replace any tokens that reference `bg-sunset`, `bg-meadow`, `bg-cream`, `bg-bark`, `text-stone`, `border-driftwood`, `font-mono`, or `font-serif` with the new equivalents. If the test just renders a tag and asserts on text content, leave it alone. If the test asserts specific class names like `bg-cream`, update them to `bg-surface` or the appropriate new token.

- [ ] **Step 3: Rewrite `src/components/ui/tag.tsx`.**

Inspect the current implementation, then rewrite with:
- `border: 1px solid #151515` via Tailwind `border border-ink`
- `rounded-full` (pill shape)
- `bg-surface` default; allow variant prop or className override
- Font: `font-sans` (inherits Outfit), weight 600 for default
- Padding: `px-3 py-1` with `text-xs`

Preserve the component's public API (same props, same consumers). If it currently accepts a `variant` prop, map old variant names to new fills (e.g. "success" → `bg-[#d8f0e6]`).

- [ ] **Step 4: Run tests + manual build.**

Run: `npm test` — all tests should pass.
Run: `npm run build` — should succeed or fail only on other not-yet-migrated components.

- [ ] **Step 5: Commit.**

```bash
git add src/components/ui/tag.tsx tests/components/ui/tag.test.tsx
git commit -m "refactor(tag): swap tokens to new palette; preserve API"
```

### Task 7: Rewrite `Toast` component

**Files:**
- Modify: `src/components/ui/toast.tsx`

- [ ] **Step 1: Read current implementation.**

Run: `cat src/components/ui/toast.tsx` to see the toast variants and container.

- [ ] **Step 2: Update tokens.**

In `src/components/ui/toast.tsx`:
- Container: `border` → `border border-ink`, `rounded-lg` → `rounded-xl` (12px), `shadow-*` → `shadow-[3px_3px_0_0_rgba(0,0,0,0.15)]`.
- Success variant: `bg-[#d8f0e6]`.
- Error/attention variant: `bg-[#fdebec]`.
- Info variant: `bg-[#e6ebf5]`.
- Text color: `text-ink`.
- Remove any `font-mono`, `uppercase`, `tracking-widest` on body text (but keep on small labels per the caps rule).
- Replace `bg-cream`, `bg-bark`, `text-bark`, `text-stone` etc. per the remapping table.

- [ ] **Step 3: Verify.**

Run: `npm run build`. Run: `npm test`.

- [ ] **Step 4: Commit.**

```bash
git add src/components/ui/toast.tsx
git commit -m "refactor(toast): new token palette + soft offset shadow"
```

---

## Phase 3 — Planner components

### Task 8: Rewrite `KidAvatar` to use `KidShape`

**Files:**
- Modify: `src/components/planner/kid-avatar.tsx`

- [ ] **Step 1: Understand the API.**

Current signature: `KidAvatar({ name, color, avatarUrl, size = 48 })`. The `color` prop becomes unused under the new system but we keep it in the type signature so consumers don't break — just ignore it internally.

- [ ] **Step 2: Add `index` prop while keeping `color` for backwards compatibility.**

Replace `src/components/planner/kid-avatar.tsx` with:

```tsx
import { initialFor } from "@/lib/kid-palette";
import { KidShape } from "@/components/ui/kid-shape";

interface KidAvatarProps {
  name: string;
  /** Sort-order index within the planner (0-based). Drives shape assignment. */
  index: number;
  /** @deprecated Kept for backwards compat; ignored under the new shape-based identity. */
  color?: string;
  avatarUrl?: string | null;
  size?: number;
}

export function KidAvatar({ name, index, avatarUrl, size = 48 }: KidAvatarProps) {
  if (avatarUrl) {
    // Photo avatars render as circle for now; a future pass can crop to assigned shape.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover border border-ink"
      />
    );
  }
  return <KidShape index={index} size={size} initial={initialFor(name)} />;
}
```

- [ ] **Step 3: Find all callers and add the `index` prop.**

Run: `grep -rn "<KidAvatar" src/ --include="*.tsx"` — expect about 6 call sites: `kid-column-header`, `matrix` (mobile tab), `add-block-modal`, `add-kid-menu`, `block-detail-drawer`, `camp-detail-drawer`.

For each call site, add `index={...}` where the value is the kid's position in the planner's `orderedIds` or (where orderedIds isn't available) a stable index from context. When we edit those files in later tasks we'll wire the index up properly. For this task, add `index={0}` as a placeholder so the build compiles, and flag each call site with a `// TODO: wire real index` comment. We'll replace these in Tasks 9+.

- [ ] **Step 4: Verify build.**

Run: `npm run build` — should succeed or fail only on other unrelated components.

- [ ] **Step 5: Commit.**

```bash
git add src/components/planner/kid-avatar.tsx src/components/planner/ src/app/planner/
git commit -m "refactor(kid-avatar): render KidShape instead of colored circle

Adds an index prop (sort-order-based shape assignment). Keeps the legacy
color prop as a deprecated pass-through so callers don't break during the
migration. Placeholder index=0 at call sites with TODO markers; wired
properly in follow-up tasks."
```

### Task 9: Rewrite `KidColumnHeader` — remove colored left border, wire index

**Files:**
- Modify: `src/components/planner/kid-column-header.tsx`

- [ ] **Step 1: Accept an `index` prop.**

Add `index: number` to the `Props` interface in `kid-column-header.tsx`.

- [ ] **Step 2: Remove the colored `border-l-4` treatment.**

In the `style` object, remove `borderLeftColor: child.color`. Change the className from:

```
"bg-white border border-driftwood/30 border-l-4 rounded-lg px-2.5 py-2 flex items-center gap-2 relative"
```

to:

```
"bg-surface border border-ink rounded-xl px-2.5 py-2 flex items-center gap-2 relative"
```

- [ ] **Step 3: Update the KidAvatar call.**

Change:

```tsx
<KidAvatar name={child.name} color={child.color} avatarUrl={child.avatar_url} size={32} />
```

to:

```tsx
<KidAvatar name={child.name} index={index} avatarUrl={child.avatar_url} size={32} />
```

- [ ] **Step 4: Update text styles.**

- Name div: change `text-bark` → `text-ink`, swap `font-semibold text-base` → `font-display font-extrabold text-base` (Figtree 800).
- Age div: change `font-mono text-[10px] uppercase tracking-wide text-stone` → `text-[11px] font-medium text-ink-2` (drops mono+uppercase per spec for this specific label because the spec's type scale explicitly lists "age" as Outfit 11/500 sentence case).
- Drag button: `text-stone/60 hover:text-stone` → `text-ink-3 hover:text-ink`.
- More button: `text-stone/60 hover:text-stone` → `text-ink-3 hover:text-ink`.
- Menu dropdown: `border-driftwood/30` → `border-ink`, `rounded-lg` → `rounded-xl`, `shadow-lg` → `shadow-[3px_3px_0_0_rgba(0,0,0,0.15)]`, inner button `text-red-600 hover:bg-red-50` → `text-[#ef8c8f] hover:bg-[#fdebec]`.
- Edit overlay: `bg-bark/40` → `bg-ink/55`, `text-white text-[9px] uppercase tracking-wide` → stays (keep caps per rule), just ensure font-sans.

- [ ] **Step 5: Verify via the matrix.**

Run: `npm run dev` and navigate to `/planner`. Confirm kid column headers render without the colored stripe, show a shape-based avatar, and the name is in Figtree. Stop the dev server when done.

- [ ] **Step 6: Commit.**

```bash
git add src/components/planner/kid-column-header.tsx
git commit -m "refactor(kid-column-header): shape avatar; remove colored left border

Kid identity now carried by the avatar shape (circle/square/triangle/
diamond by sort order). Container switches to 1px ink border, 12px radius,
white fill. Name uses Figtree 800; age drops mono uppercase for Outfit
11/500 per the type scale. Menu popup uses the soft offset shadow."
```

### Task 10: Rewrite `StateBadge` with new status colors

**Files:**
- Modify: `src/components/planner/state-badge.tsx`

- [ ] **Step 1: Replace the component.**

Replace `src/components/planner/state-badge.tsx` with:

```tsx
"use client";

import type { PlannerEntryStatus } from "@/lib/supabase/types";

interface Props {
  status: PlannerEntryStatus;
  onClick?: () => void;
}

const LABELS: Record<PlannerEntryStatus, string> = {
  considering: "Considering",
  waitlisted: "Waitlisted",
  registered: "Registered",
};

const STYLES: Record<PlannerEntryStatus, string> = {
  considering: "bg-status-considering text-ink hover:brightness-95",
  waitlisted: "bg-status-waitlisted text-ink hover:brightness-95",
  registered: "bg-status-registered text-ink hover:brightness-95",
};

export function StateBadge({ status, onClick }: Props) {
  const base = "font-sans text-[10px] uppercase tracking-wide px-2.5 py-1 rounded-full border border-ink font-semibold transition-colors";
  const cls = `${base} ${STYLES[status]} ${onClick ? "cursor-pointer" : ""}`;
  if (onClick) return <button onClick={onClick} className={cls}>{LABELS[status]}</button>;
  return <span className={cls}>{LABELS[status]}</span>;
}
```

- [ ] **Step 2: Verify build.**

Run: `npm run build`.

- [ ] **Step 3: Commit.**

```bash
git add src/components/planner/state-badge.tsx
git commit -m "refactor(state-badge): new palette + 1px ink border

considering -> soft gray #e8edf1, waitlisted -> coral #ffd4b8, registered
-> hero yellow #fbbf0e. All pills get a 1px ink outline so the lighter
fills stay defined on white cards. Keeps uppercase+tracking."
```

### Task 11: Rewrite `SharedBadge`

**Files:**
- Modify: `src/components/planner/shared-badge.tsx`

- [ ] **Step 1: Replace.**

Replace `src/components/planner/shared-badge.tsx` with:

```tsx
interface Props {
  sharedWith: string[]; // other kids' names
}

export function SharedBadge({ sharedWith }: Props) {
  if (sharedWith.length === 0) return null;
  return (
    <div className="font-sans text-[11px] font-semibold text-ink mt-1 flex items-center gap-1">
      <span>✦</span>
      <span>shared with {sharedWith.join(", ")}</span>
    </div>
  );
}
```

- [ ] **Step 2: Commit.**

```bash
git add src/components/planner/shared-badge.tsx
git commit -m "refactor(shared-badge): sentence case, Outfit 11/600, ink

Drops mono uppercase tracking-widest + text-meadow green. ✦ glyph
preserved as the visual marker."
```

### Task 12: Rewrite `BlockCard` — filled SVG icons + dot-grid background

**Files:**
- Modify: `src/components/planner/block-card.tsx`

- [ ] **Step 1: Replace the component.**

Replace `src/components/planner/block-card.tsx` with:

```tsx
"use client";

import { useTransition } from "react";
import { removePlannerBlock } from "@/lib/actions";
import type { PlannerBlockType } from "@/lib/supabase/types";

const BLOCK_FILL_STYLE: React.CSSProperties = {
  backgroundImage: "radial-gradient(rgba(21,21,21,0.09) 0.7px, transparent 0.7px)",
  backgroundSize: "5px 5px",
  backgroundColor: "rgba(21,21,21,0.04)",
};

function BlockIcon({ type }: { type: PlannerBlockType }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "#151515" };
  switch (type) {
    case "school":
      return (
        <svg {...common} aria-hidden>
          <path d="M12 2 L1 7 L12 12 L21 8.1 L21 14 L23 14 L23 7 Z" />
          <path d="M5 10.5 L5 15.5 C5 17.5 8.5 19 12 19 C15.5 19 19 17.5 19 15.5 L19 10.5 L12 14 Z" />
        </svg>
      );
    case "travel":
      return (
        <svg {...common} aria-hidden>
          <path d="M22 2 L2 10 L10 13 L13 22 Z" />
        </svg>
      );
    case "at_home":
      return (
        <svg {...common} aria-hidden>
          <path d="M12 3 L2 11 L4.5 11 L4.5 20 L9 20 L9 14 L15 14 L15 20 L19.5 20 L19.5 11 L22 11 Z" />
          <rect x={16} y={5} width={2} height={3.5} />
        </svg>
      );
    case "other":
    default:
      return (
        <svg {...common} aria-hidden>
          <polygon points="12,2 14.5,9 22,9 16,13.5 18.5,21 12,16.5 5.5,21 8,13.5 2,9 9.5,9" />
        </svg>
      );
  }
}

interface Props {
  blockId: string;
  type: PlannerBlockType;
  title: string;
  emoji?: string | null; // deprecated — ignored
  subtitle?: string;
  onClick?: () => void;
  onChanged: () => void;
}

export function BlockCard({ blockId, type, title, subtitle, onClick, onChanged }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Remove this block?")) return;
    startTransition(async () => {
      await removePlannerBlock(blockId);
      onChanged();
    });
  }

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-ink p-3 flex items-start gap-3 cursor-pointer ${isPending ? "opacity-60" : ""}`}
      style={BLOCK_FILL_STYLE}
    >
      <span className="shrink-0 leading-none"><BlockIcon type={type} /></span>
      <div className="flex-1 min-w-0">
        <div className="font-sans font-bold text-sm text-ink truncate">{title}</div>
        {subtitle && (
          <div className="font-sans text-[11px] font-medium text-ink-2 mt-0.5">{subtitle}</div>
        )}
      </div>
      <button
        onClick={handleRemove}
        aria-label="Remove block"
        className="text-ink-3 hover:text-[#ef8c8f] text-xs"
      >
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify.**

Run: `npm run build`. Visually confirm via `npm run dev` on `/planner` (if there are any blocks in your local DB).

- [ ] **Step 3: Commit.**

```bash
git add src/components/planner/block-card.tsx
git commit -m "refactor(block-card): filled SVG icons + semi-transparent dot grid

Drops emoji-per-type and pastel fills per type. One shared background
treatment: 4% solid ink tint + 9% ink dot grid on 5px spacing. Icons:
grad cap (school), paper airplane (travel), house+chimney (at_home),
5-point star (other)."
```

### Task 13: Rewrite `CampCard` — shape marker + new status colors + white always

**Files:**
- Modify: `src/components/planner/camp-card.tsx`
- Modify: `tests/components/activity/camp-card.test.tsx` (if assertions reference old tokens)

**Note:** there are TWO camp-card files. This task targets `src/components/planner/camp-card.tsx`. The `src/components/activity/camp-card.tsx` is a different component (public Explore card) — handled in Phase 5.

- [ ] **Step 1: Rewrite the planner camp card.**

The card needs an `ownerIndex` prop so it can render the right kid shape. Check who renders `CampCard` and pass the index. Replace `src/components/planner/camp-card.tsx` with:

```tsx
"use client";

import { useTransition } from "react";
import Link from "next/link";
import { StateBadge } from "./state-badge";
import { SharedBadge } from "./shared-badge";
import { KidShape } from "@/components/ui/kid-shape";
import { updatePlannerEntryStatus, removePlannerEntry } from "@/lib/actions";
import type { PlannerEntryStatus } from "@/lib/supabase/types";

interface CampCardProps {
  entryId: string;
  activityName: string;
  activitySlug: string;
  status: PlannerEntryStatus;
  timeLabel?: string | null;
  priceLabel?: string | null;
  sharedWith: string[];
  isLoading: boolean;
  /** Sort-order index of the owning kid — drives the shape marker. */
  ownerIndex: number;
  onChanged: () => void;
}

const NEXT_STATUS: Record<PlannerEntryStatus, PlannerEntryStatus> = {
  considering: "waitlisted",
  waitlisted: "registered",
  registered: "considering",
};

export function CampCard({
  entryId,
  activityName,
  activitySlug,
  status,
  timeLabel,
  priceLabel,
  sharedWith,
  isLoading,
  ownerIndex,
  onChanged,
}: CampCardProps) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await updatePlannerEntryStatus(entryId, NEXT_STATUS[status]);
      onChanged();
    });
  }

  function handleRemove() {
    startTransition(async () => {
      await removePlannerEntry(entryId);
      onChanged();
    });
  }

  return (
    <div className={`rounded-xl border border-ink p-3 bg-surface transition-opacity ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/activity/${activitySlug}`}
          className="flex-1 font-sans font-bold text-sm text-ink hover:underline truncate flex items-center gap-1.5"
        >
          <KidShape index={ownerIndex} size={10} dotOnly stroke={false} />
          <span className="truncate">{activityName}</span>
        </Link>
        <button
          onClick={handleRemove}
          aria-label="Remove"
          className="text-ink-3 hover:text-[#ef8c8f] text-xs"
        >
          ✕
        </button>
      </div>

      {isLoading ? (
        <div className="mt-2 space-y-1.5">
          <div className="h-2 bg-disabled rounded w-2/3 animate-pulse"></div>
          <div className="h-2 bg-disabled rounded w-1/2 animate-pulse"></div>
        </div>
      ) : (
        <div className="mt-1.5 font-sans text-[11px] uppercase tracking-wide text-ink-2 font-semibold">
          {[timeLabel, priceLabel].filter(Boolean).join(" · ") || "Details loading…"}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <StateBadge status={status} onClick={handleToggle} />
      </div>

      <SharedBadge sharedWith={sharedWith} />
    </div>
  );
}
```

- [ ] **Step 2: Update the test.**

Open `tests/components/activity/camp-card.test.tsx` and check whether it tests the planner card or the activity card. If it tests the planner card, update token references (bg-meadow/5 → none; the card is always white now). If it tests the activity card, leave it for Phase 5.

- [ ] **Step 3: Commit.**

```bash
git add src/components/planner/camp-card.tsx tests/components/activity/camp-card.test.tsx
git commit -m "refactor(planner camp-card): shape marker, white always, new status

Adds ownerIndex prop so the 10px kid shape marker renders next to the
activity name (replaces the old colored dot). Background is always white;
drops per-status tinted fills. Meta line keeps uppercase+tracking but
swaps mono for Outfit. Border, font, and color tokens updated."
```

### Task 14: Update `CellTimelineGrid`

**Files:**
- Modify: `src/components/planner/cell-timeline-grid.tsx`

- [ ] **Step 1: Replace the rendering tokens.**

In `cell-timeline-grid.tsx`:
- Day header className: `font-mono text-[9px] text-center uppercase tracking-wide` → `font-sans text-[9px] font-bold text-center uppercase tracking-wide`. Text color: `text-driftwood`/`text-stone` → `text-ink-3`/`text-ink-2`.
- Slot (AM/PM) label: `font-mono text-[8px] text-driftwood uppercase tracking-wide` → `font-sans text-[8px] font-bold text-ink-3 uppercase tracking-wide`.
- Out-of-range hatched pattern:
  - Replace the inline `backgroundImage: "repeating-linear-gradient(45deg, #e8ddc7 0, #e8ddc7 2px, transparent 2px, transparent 5px)"` with `"repeating-linear-gradient(45deg, #e8e8ea 0, #e8e8ea 2px, transparent 2px, transparent 5px)"`.
  - `border: "1px dashed #c8a76a"` → `"1px dashed #c0c0c0"`.
- Weekend empty: `bg-[#f3ede1]` → `bg-disabled`, `border-driftwood/30` → `border-[#e0e0e0]`.
- Empty add button: `border-campfire/50 hover:border-campfire hover:bg-campfire/10` → `border-ink-3 hover:border-ink hover:bg-surface`.
- Conflict ring: `ring-1 ring-red-500` → `outline outline-2 outline-[#ef8c8f] outline-offset-[-1px]`.

- [ ] **Step 2: Verify build and visual.**

Run: `npm run build`. Run: `npm run dev`. Inspect a planner cell with multiple camps and confirm the grid renders with the new camp palette colors, AM/PM slots visible, conflicts shown in coral.

- [ ] **Step 3: Commit.**

```bash
git add src/components/planner/cell-timeline-grid.tsx
git commit -m "refactor(cell-timeline-grid): new tokens + coral conflict outline

Day/slot labels swap mono for Outfit (uppercase+tracking preserved).
Out-of-range hatch goes neutral gray; conflict outline becomes coral
#ef8c8f per spec. Weekend-empty uses the disabled gray."
```

### Task 15: Update `ConsideringChips`

**Files:**
- Modify: `src/components/planner/considering-chips.tsx`

- [ ] **Step 1: Replace.**

Replace `src/components/planner/considering-chips.tsx` with:

```tsx
"use client";

export interface ConsideringChip {
  entryId: string;
  activityName: string;
  color: string;
}

interface Props {
  chips: ConsideringChip[];
  onChipClick: (entryId: string) => void;
}

export function ConsideringChips({ chips, onChipClick }: Props) {
  if (chips.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-dashed border-ink-3">
      <div className="font-sans text-[9px] font-bold uppercase tracking-widest text-ink-2 mb-1">
        Considering ({chips.length})
      </div>
      <div className="flex gap-1 flex-wrap">
        {chips.map((c) => (
          <button
            key={c.entryId}
            onClick={() => onChipClick(c.entryId)}
            className="flex items-center gap-1 rounded-full border border-dashed border-ink-3 bg-surface px-2 py-0.5 text-[11px] text-ink hover:border-ink"
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
            {c.activityName}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit.**

```bash
git add src/components/planner/considering-chips.tsx
git commit -m "refactor(considering-chips): new tokens; preserve structure

Dashed border goes ink-3; label switches to Outfit (keeps uppercase+
tracking). Camp dot retains per-camp color from the new cool-pastel palette."
```

### Task 16: Update `PlannerCell`

**Files:**
- Modify: `src/components/planner/planner-cell.tsx`

- [ ] **Step 1: Update token references.**

In `planner-cell.tsx`:
- Replace the local `STATUS_STYLE` map (lines 16–20) with references to the new status tokens:
  ```ts
  const STATUS_STYLE: Record<PlannerEntryStatus, { bg: string; text: string }> = {
    considering: { bg: "bg-status-considering", text: "text-ink" },
    waitlisted:  { bg: "bg-status-waitlisted",  text: "text-ink" },
    registered:  { bg: "bg-status-registered",  text: "text-ink" },
  };
  ```
- Simple-view empty button (line 67): `border-driftwood/40 bg-transparent py-1.5 text-[11px] text-stone hover:text-bark hover:border-bark font-mono uppercase tracking-wide` → `border-ink-3 bg-transparent py-1.5 text-[11px] text-ink-2 hover:text-ink hover:border-ink font-sans uppercase tracking-wide font-bold`.
- Simple-view considering-only (lines 74–75): `border-driftwood/30` → `border-ink-3`, `font-mono text-[10px] uppercase tracking-wide text-driftwood italic` → `font-sans text-[11px] uppercase tracking-wide text-ink-3 font-semibold italic`.
- Simple-view filled card (line 87): `border-driftwood/30 bg-white text-bark hover:underline` → `border-ink bg-surface text-ink hover:underline`.
- Simple-view legend status pill (lines 93–95): `font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full flex-shrink-0 ${s.bg} ${s.text}` → `font-sans font-semibold text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full border border-ink flex-shrink-0 ${s.bg} ${s.text}`.
- Extra-count span (line 92): `text-stone font-mono text-[10px]` → `text-ink-2 font-sans text-[10px] font-semibold`.
- Detail-view empty button (line 104): `border-driftwood/50 bg-cream/50 text-stone hover:text-bark hover:border-bark font-mono uppercase tracking-widest` → `border-ink-3 bg-surface text-ink-2 hover:text-ink hover:border-ink font-sans font-bold uppercase tracking-widest`.
- Detail-view inner card (line 111): `border-driftwood/30 bg-white` → `border-ink bg-surface`.
- Detail-view legend row text (lines 127–131): `text-bark hover:underline` → `text-ink hover:underline`. Status pill class: same update as the simple view — include `border border-ink`.

- [ ] **Step 2: Verify.**

Run: `npm run build` and `npm run dev`. Load `/planner` and confirm cells render (simple + detail views) with new tokens.

- [ ] **Step 3: Commit.**

```bash
git add src/components/planner/planner-cell.tsx
git commit -m "refactor(planner-cell): token swap across all view modes

Replaces bark/stone/driftwood/cream tokens throughout simple + detail views.
Status pills now use the semantic status-* tokens and gain a 1px ink border.
Empty states use ink-3 dashed borders."
```

### Task 17: Update `PlannerMatrix`

**Files:**
- Modify: `src/components/planner/matrix.tsx`

- [ ] **Step 1: Token swaps.**

In `src/components/planner/matrix.tsx`:
- Empty-planner border dashed `border-driftwood/50 bg-white/30` → `border-ink-3 bg-surface/30`. Heading `font-serif text-xl text-bark` → `font-display font-extrabold text-xl text-ink`. Body `text-stone text-sm` → `text-ink-2 text-sm`. `font-mono` inline → `font-sans`.
- Mobile tab button: `border-color: c.color` style usage stays (that was kid color) — **change this**: since kid color retires, use a subtle treatment. Replace the style object with `undefined` and change the active-state className from checking `c.id === focusedKidId` with a colored border to using `border-ink` (active) vs `border-ink-3` (inactive). Drop the `style` prop entirely.
- Mobile tab `<KidAvatar>` call — add `index={orderedIds.indexOf(c.id)}` and remove the `color` prop (or leave it as a no-op since the new KidAvatar ignores it).
- Mobile week label classes: `font-mono text-[11px] uppercase tracking-widest text-stone` → `font-sans text-[11px] font-semibold uppercase tracking-widest text-ink-2`.
- Desktop week label classes (same `font-mono text-[11px] uppercase tracking-widest text-stone self-stretch flex items-center pl-1.5 pr-3 border-r border-driftwood/30 ...`) → `font-sans text-[11px] font-semibold uppercase tracking-widest text-ink-2 self-stretch flex items-center pl-1.5 pr-3 border-r border-ink-3 ...`.
- KidColumnHeader calls — add `index={orderedIds.indexOf(c.id)}`.

- [ ] **Step 2: Verify.**

Run: `npm run build`. Run: `npm run dev`. Load `/planner` at desktop and mobile widths; confirm kid headers and week labels look right.

- [ ] **Step 3: Commit.**

```bash
git add src/components/planner/matrix.tsx
git commit -m "refactor(matrix): token swap + wire kid shape indices

Week labels swap mono for Outfit (caps+tracking preserved). Mobile kid
tabs drop the per-kid colored border in favor of ink/ink-3 active vs
inactive. KidColumnHeader and KidAvatar now receive an index prop."
```

### Task 18: Update `PlannerTitle`

**Files:**
- Modify: `src/components/planner/planner-title.tsx`

- [ ] **Step 1: Font/token swap.**

In `planner-title.tsx`:
- Edit input className: `font-serif text-4xl bg-transparent border-b-2 border-bark/40 focus:border-bark outline-none min-w-[200px]` → `font-display font-extrabold text-4xl text-ink bg-transparent border-b-2 border-ink-3 focus:border-ink outline-none min-w-[200px] tracking-tight`.
- Error paragraph: `text-red-600` → `text-[#ef8c8f]`.
- Display button: `font-serif text-4xl hover:underline decoration-bark/30 decoration-2 underline-offset-4` → `font-display font-extrabold text-4xl text-ink tracking-tight hover:underline decoration-ink-3 decoration-2 underline-offset-4`.
- Pencil span: `text-base text-stone` → `text-base text-ink-3`.

- [ ] **Step 2: Commit.**

```bash
git add src/components/planner/planner-title.tsx
git commit -m "refactor(planner-title): Figtree 4xl/800 in place of DM Serif"
```

### Task 19: Update `PlannerRangePicker`

**Files:**
- Modify: `src/components/planner/planner-range-picker.tsx`

- [ ] **Step 1: Token sweep.**

Open the file. Replace every occurrence of old tokens per the remapping table:
- `bg-cream`, `bg-sand` → `bg-surface` or `bg-base` as appropriate
- `bg-bark` → `bg-ink`
- `text-bark` → `text-ink`
- `text-stone` → `text-ink-2`
- `border-driftwood/30`, `border-driftwood/40`, `border-driftwood/50` → `border-ink-3`
- `border-driftwood` (solid) → `border-ink`
- `bg-sunset`, `bg-campfire` → `bg-ink` (for CTAs) or `bg-hero-light` (for decorative) — use judgment per usage
- `font-mono` → `font-sans font-bold` (retain any `uppercase` / `tracking-*`)
- `font-serif` → `font-display font-extrabold`
- `text-meadow` → `text-[#5fc39c]`
- `bg-meadow` → `bg-[#8ec4ad]` (camp mint) unless it's semantic "success" → `bg-[#d8f0e6]`

Scan the file's visible strings with `grep -nE "(bg|text|border)-(cream|bark|sunset|campfire|meadow|lake|driftwood|sand|stone)" src/components/planner/planner-range-picker.tsx` to make sure you caught everything.

- [ ] **Step 2: Verify.**

Run: `npm run build`. Run: `npm run dev` and interact with the range picker in `/planner`.

- [ ] **Step 3: Commit.**

```bash
git add src/components/planner/planner-range-picker.tsx
git commit -m "refactor(planner-range-picker): token swap"
```

### Task 20: Update `StatusDropdown` — new status colors, preserved sentence-case label

**Files:**
- Modify: `src/components/planner/status-dropdown.tsx`

- [ ] **Step 1: Replace the OPTIONS constant and token sweep.**

Update the file:

```ts
const OPTIONS: { value: PlannerEntryStatus; label: string; color: string }[] = [
  { value: "considering", label: "Considering", color: "#e8edf1" },
  { value: "waitlisted", label: "Waitlisted", color: "#ffd4b8" },
  { value: "registered", label: "Registered", color: "#fbbf0e" },
];
```

- Trigger button className: `border-driftwood/40 bg-white hover:border-bark` → `border-ink-3 bg-surface hover:border-ink`.
- Dot span: add `border border-ink` to the colored dot span so lighter fills stay visible. E.g. `"w-2 h-2 rounded-full border border-ink"`.
- Trigger label: `font-medium text-bark` → `font-sans font-semibold text-ink`.
- Chevron: `text-stone` → `text-ink-2`.
- Dropdown panel: `border-driftwood/30 rounded-lg shadow-lg` → `border-ink rounded-xl shadow-[3px_3px_0_0_rgba(0,0,0,0.15)]`.
- Options hover/current: `hover:bg-driftwood/10` → `hover:bg-base`, `bg-driftwood/5` → `bg-base/50`.
- Option text: `text-bark` → `text-ink`.
- Current-check span: `text-meadow` → `text-[#5fc39c]`.

- [ ] **Step 2: Commit.**

```bash
git add src/components/planner/status-dropdown.tsx
git commit -m "refactor(status-dropdown): new status tokens + ink borders

Option dots pick up a 1px ink ring so the lighter fills (gray, coral,
yellow) stay defined on white. Sentence-case labels preserved per spec —
only the font family, colors, and border treatment change."
```

### Task 21: Update `MyCampsRail`

**Files:**
- Modify: `src/components/planner/my-camps-rail.tsx`

- [ ] **Step 1: Token sweep.**

Apply the same token sweep rules from Task 19 to `my-camps-rail.tsx`. The camp dots in this component use the new camp palette (which we updated in Task 3), so no logic change is needed — only token swaps in classNames.

- [ ] **Step 2: Commit.**

```bash
git add src/components/planner/my-camps-rail.tsx
git commit -m "refactor(my-camps-rail): token swap"
```

### Task 22: Update remaining planner modals and drawers

**Files:**
- Modify: `src/components/planner/add-block-modal.tsx`
- Modify: `src/components/planner/add-camp-modal.tsx`
- Modify: `src/components/planner/add-entry-modal.tsx`
- Modify: `src/components/planner/add-kid-menu.tsx`
- Modify: `src/components/planner/avatar-editor-modal.tsx`
- Modify: `src/components/planner/block-detail-drawer.tsx`
- Modify: `src/components/planner/camp-detail-drawer.tsx`
- Modify: `src/components/planner/share-schedule-button.tsx`
- Modify: `src/components/planner/extras-editor.tsx`
- Modify: `src/components/planner/schedule-editor.tsx`
- Modify: `src/components/planner/cell-drop-zones.tsx`

- [ ] **Step 1: Systematic token sweep per file.**

For each file, apply the token remapping rules from Task 19. Commit one file per commit so each change is atomic. For any `<KidAvatar ... />` call, add an `index` prop using whatever ordered-id context is in scope (if not in scope, the caller passes a kids array — use `kids.findIndex(k => k.id === id)`).

For each file:

- [ ] Sweep `add-block-modal.tsx`. Replace inline border `#d9c9b0` → `#c0c0c0`. Replace `c.color` in `borderColor: selected ? c.color : "..."` — since kid color retires, make selected use `borderColor: "#151515"` instead of the colored border.
  - [ ] Commit: `refactor(add-block-modal): token swap; drop per-kid border color`

- [ ] Sweep `add-camp-modal.tsx`. Commit: `refactor(add-camp-modal): token swap`

- [ ] Sweep `add-entry-modal.tsx`. Commit: `refactor(add-entry-modal): token swap`

- [ ] Sweep `add-kid-menu.tsx`. Commit: `refactor(add-kid-menu): token swap`

- [ ] Sweep `avatar-editor-modal.tsx`. Commit: `refactor(avatar-editor-modal): token swap`

- [ ] Sweep `block-detail-drawer.tsx`. Commit: `refactor(block-detail-drawer): token swap`

- [ ] Sweep `camp-detail-drawer.tsx`. Commit: `refactor(camp-detail-drawer): token swap`

- [ ] Sweep `share-schedule-button.tsx`. Commit: `refactor(share-schedule-button): token swap`

- [ ] Sweep `extras-editor.tsx`. Commit: `refactor(extras-editor): token swap`

- [ ] Sweep `schedule-editor.tsx`. Commit: `refactor(schedule-editor): token swap`

- [ ] Sweep `cell-drop-zones.tsx`. Drop-zone hover/drop state colors map to `bg-hero-light/40` for "Considering"-zone and `bg-[#d8f0e6]` for "Registered"-zone. Commit: `refactor(cell-drop-zones): token swap + new drop-state tints`

### Task 23: Update `planner/client.tsx` — schedule wrap + header tokens

**Files:**
- Modify: `src/app/planner/client.tsx`

- [ ] **Step 1: Header token swap.**

In `src/app/planner/client.tsx`, header section (lines 272–313):
- `bg-cream` → `bg-surface`.
- `text-stone` → `text-ink-2`.
- View toggle pills: `border-driftwood/40 bg-white` → `border-ink bg-surface`. Active state `bg-bark text-cream` → `bg-ink text-ink-inverse`. Inactive `text-stone hover:text-bark` → `text-ink-2 hover:text-ink`. `font-mono` → `font-sans font-bold` (caps+tracking preserved).
- "+ Add" button: `font-mono text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-bark text-cream hover:bg-bark/90` → `font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-ink text-ink-inverse hover:bg-[#333] border border-ink shadow-[3px_3px_0_0_rgba(0,0,0,0.15)]`.

- [ ] **Step 2: Wrap the `PlannerMatrix` with a schedule-region container.**

Currently (around line 323):

```tsx
<div className="w-full md:flex-1 min-w-0 flex flex-col md:h-full">
  <PlannerMatrix ... />
</div>
```

Change to:

```tsx
<div className="w-full md:flex-1 min-w-0 flex flex-col md:h-full">
  <div className="bg-base border border-ink rounded-2xl p-4 flex-1 min-h-0 flex flex-col">
    <PlannerMatrix ... />
  </div>
</div>
```

The `rounded-2xl` is 16px. The `bg-base` is `#f7f8fa`. The inner matrix still scrolls via its own `md:overflow-y-auto` on the matrix body.

- [ ] **Step 3: Update DragOverlay styles.**

In the bottom of the file where the DragOverlay renders (lines 378–389):
- `border-2 bg-white shadow-2xl` → `border border-ink bg-surface shadow-[3px_3px_0_0_rgba(0,0,0,0.15)]`.
- `text-bark` → `text-ink`.
- `font-mono text-[9px] uppercase tracking-widest text-stone` → `font-sans font-bold text-[9px] uppercase tracking-widest text-ink-2`.
- Keep the inline `style={{ borderColor: draggingCamp.color }}` — that's the CAMP's color (not kid), and it legitimately signals which camp is being dragged.

- [ ] **Step 4: Update the `<PlannerCell>` call to pass kid ownerIndex.**

Since we added `ownerIndex` to CampCard, but planner-cell.tsx renders them via `legendRows`, we need to plumb the index. Check whether CampCard is actually rendered here — if only via PlannerCell, then the index needs to flow through PlannerCell's `legendRows`. If CampCard is used directly on the client, we need to pass `ownerIndex` here.

Run: `grep -rn "CampCard" src/app/planner/ src/components/planner/` to find call sites. Adjust plumbing accordingly — add an `ownerIndex: number` field to whatever data structure feeds into CampCard.

If the legend row structure needs updating: in `planner-cell.tsx` (`CellLegendRow` interface), add `ownerIndex: number` and pass it through the button that renders each row. If CampCard is only rendered in other places, skip.

- [ ] **Step 5: Verify.**

Run: `npm run build`. Run: `npm run dev` and inspect `/planner`.

- [ ] **Step 6: Commit.**

```bash
git add src/app/planner/client.tsx src/components/planner/planner-cell.tsx
git commit -m "refactor(planner): schedule region wrap + header tokens

Wraps PlannerMatrix in a bg-base (cool paper) container with 1px ink
border and 16px radius so the schedule has a defined canvas on the
now-white body background. Header view toggle and + Add button swap to
the new ink-primary token set (caps+tracking preserved)."
```

---

## Phase 4 — Nav rewrite (full-bleed + auth cluster)

### Task 24: Build the `AuthCluster` component

**Files:**
- Create: `src/components/layout/auth-cluster.tsx`

- [ ] **Step 1: Inspect the existing auth/session story.**

Run: `grep -rn "useUser\|getUser\|supabase.auth\|getSession" src/lib/ src/components/ --include="*.ts" --include="*.tsx" | head -10` to see how auth state is read.

- [ ] **Step 2: Build the component.**

Create `src/components/layout/auth-cluster.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Props {
  /** When null, user is unauthenticated. When set, user is authenticated. */
  user: { name: string; email: string } | null;
  /** Called when the user clicks Log out. Parent wires this to whatever sign-out action exists. */
  onLogOut?: () => void;
}

export function AuthCluster({ user, onLogOut }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!user) {
    return (
      <span className="inline-flex items-stretch border border-ink rounded-full overflow-hidden font-sans text-[11px] font-bold uppercase tracking-widest">
        <Link href="/auth/login" className="px-4 py-2 bg-surface text-ink hover:bg-base">
          Sign In
        </Link>
        <Link href="/auth/signup" className="px-4 py-2 bg-ink text-white hover:bg-[#333]">
          Sign up
        </Link>
      </span>
    );
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-[14px] py-2 rounded-full border border-ink bg-surface text-ink font-sans text-[11px] font-bold uppercase tracking-widest hover:bg-base"
      >
        Account
        <span className="text-[10px] leading-none">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 top-full right-0 mt-2 bg-surface border border-ink rounded-xl shadow-[3px_3px_0_0_rgba(0,0,0,0.15)] p-1 min-w-[240px]">
          <div className="px-3 pt-2.5 pb-2 border-b border-dashed border-ink-3">
            <p className="font-display font-extrabold text-sm text-ink leading-tight truncate">{user.name}</p>
            <p className="font-sans text-[11px] font-medium text-ink-2 truncate">{user.email}</p>
          </div>
          <Link href="/kids" className="block px-3 py-2 rounded-md font-sans text-[13px] font-medium text-ink hover:bg-base">My kids</Link>
          <Link href="/account" className="block px-3 py-2 rounded-md font-sans text-[13px] font-medium text-ink hover:bg-base">Account settings</Link>
          <Link href="/account/sharing" className="block px-3 py-2 rounded-md font-sans text-[13px] font-medium text-ink hover:bg-base">Share preferences</Link>
          <hr className="border-t border-disabled mx-2 my-1" />
          <button
            type="button"
            onClick={() => { setOpen(false); onLogOut?.(); }}
            className="block w-full text-left px-3 py-2 rounded-md font-sans text-[13px] font-medium text-[#ef8c8f] hover:bg-[#fdebec]"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build.**

Run: `npm run build`.

- [ ] **Step 4: Commit.**

```bash
git add src/components/layout/auth-cluster.tsx
git commit -m "feat(auth-cluster): split pill (unauth) + account dropdown (auth)

Unauthenticated: split pill — white Sign In half + ink Sign up half with
white text. Authenticated: white Account pill with chevron opening a
dropdown (name/email, My kids, Account settings, Share preferences,
Log out). Routes to /auth/login, /auth/signup, /kids, /account,
/account/sharing — create any missing routes in a follow-up pass."
```

### Task 25: Rewrite `Nav` component — full-bleed + new NAV_LINKS

**Files:**
- Modify: `src/components/layout/nav.tsx`

- [ ] **Step 1: Identify session reader.**

Read the existing nav and neighboring code to find how auth status is currently read or how to read it. If there's no existing pattern, create a small server-side helper or pass user info down via the nav's parent. For the simplest approach, the nav can be a client component that reads Supabase's `getUser()`.

Run: `grep -rn "createBrowserClient\|createClient" src/lib/supabase/ --include="*.ts"` to find the Supabase browser client.

- [ ] **Step 2: Rewrite nav.**

Replace `src/components/layout/nav.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthCluster } from "@/components/layout/auth-cluster";
import { createBrowserClient } from "@/lib/supabase/browser";

const NAV_LINKS = [
  { href: "/explore", label: "Explore", comingSoon: true },
  { href: "/planner", label: "Planner" },
] as const;

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  // Hide nav on auth and onboarding pages
  const hideOn = ["/auth", "/onboarding"];
  const shouldHide = hideOn.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (shouldHide) return;
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) {
        setUser(null);
        return;
      }
      const name =
        (u.user_metadata?.full_name as string | undefined) ??
        (u.email ? u.email.split("@")[0] : "You");
      setUser({ name, email: u.email ?? "" });
    });
  }, [shouldHide]);

  if (shouldHide) return null;

  async function handleLogOut() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 bg-hero border-b border-ink shadow-[0_3px_0_0_rgba(0,0,0,0.15)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between py-[18px]">
        <Link href="/planner" className="font-display font-extrabold text-[24px] tracking-tight text-ink">
          kidtinerary
        </Link>

        <nav className="hidden sm:flex items-center gap-7">
          {NAV_LINKS.map(({ href, label, comingSoon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <span key={href} className="relative inline-block">
                <Link
                  href={href}
                  className={`font-sans text-[11px] uppercase tracking-widest text-ink py-1.5 ${
                    isActive ? "font-extrabold opacity-100" : "font-semibold opacity-55"
                  }`}
                >
                  {label}
                </Link>
                {comingSoon ? (
                  <span
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-[calc(100%+2px)] px-1.5 py-0.5 rounded-[3px] border font-sans text-[8px] font-extrabold uppercase tracking-wider whitespace-nowrap"
                    style={{
                      color: "rgba(21,21,21,0.55)",
                      borderColor: "rgba(21,21,21,0.35)",
                      background: "rgba(255,255,255,0.25)",
                      letterSpacing: "0.1em",
                    }}
                  >
                    Coming soon!
                  </span>
                ) : null}
              </span>
            );
          })}
          <AuthCluster user={user} onLogOut={handleLogOut} />
        </nav>

        {/* Mobile nav — simplified, full-bleed at bottom */}
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-hero border-t border-ink flex justify-around py-2 z-40">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`font-sans text-[9px] uppercase tracking-wide text-ink px-3 py-1 ${
                  isActive ? "font-extrabold opacity-100" : "font-semibold opacity-55"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
```

**Important:** confirm the path `@/lib/supabase/browser` exists and exports `createBrowserClient`. If the actual helper is named differently (e.g., `createClient` in `@/lib/supabase/client`), update the import accordingly.

- [ ] **Step 3: Verify.**

Run: `npm run build`. Then run: `npm run dev` and walk both logged-out and logged-in states in the browser. Confirm:
- Nav is full-bleed yellow.
- Explore has "Coming soon!" horizontal stamp below.
- Planner bolds when active.
- Logged-out: split pill (Sign In white / Sign up ink).
- Logged-in: Account pill opens dropdown with My kids / Account settings / Share preferences / Log out.

- [ ] **Step 4: Commit.**

```bash
git add src/components/layout/nav.tsx
git commit -m "refactor(nav): full-bleed yellow hero + AuthCluster integration

Drops the contained cream-colored bar for an edge-to-edge hero header.
NAV_LINKS shrinks to Explore (with Coming Soon stamp) + Planner; My Kids
retires into the Account dropdown. Active state is bold+opacity only;
no pills or underlines. Brand bumps to Figtree 24/800."
```

---

## Phase 5 — Remaining pages and components

### Task 26: Sweep `explore/*` components

**Files:**
- Modify: `src/components/explore/filter-sidebar.tsx`
- Modify: `src/components/explore/sort-bar.tsx`
- Modify: `src/components/explore/search-bar.tsx`
- Modify: `src/components/explore/search-filter-panel.tsx`
- Modify: `src/components/explore/activity-list.tsx`
- Modify: `src/components/explore/address-input.tsx`
- Modify: `src/components/activity/camp-card.tsx` (the activity version, not the planner version)

- [ ] **Step 1–8: Token sweep per file.**

For each file, apply the token-remapping rules from Task 19. Commit one file per commit.

- [ ] filter-sidebar.tsx. Commit: `refactor(filter-sidebar): token swap`
- [ ] sort-bar.tsx. Commit: `refactor(sort-bar): token swap`
- [ ] search-bar.tsx. Commit: `refactor(search-bar): token swap`
- [ ] search-filter-panel.tsx. Commit: `refactor(search-filter-panel): token swap`
- [ ] activity-list.tsx. Commit: `refactor(activity-list): token swap`
- [ ] address-input.tsx. Commit: `refactor(address-input): token swap`
- [ ] activity/camp-card.tsx. Commit: `refactor(activity camp-card): token swap`

### Task 27: Sweep `activity/*` components

**Files:**
- Modify: `src/components/activity/detail-hero.tsx`
- Modify: `src/components/activity/session-table.tsx`
- Modify: `src/components/activity/price-table.tsx`
- Modify: `src/components/activity/share-button.tsx`
- Modify: `src/components/activity/report-modal.tsx`

- [ ] Per-file token sweep, one commit each, using the remapping table. Commit messages: `refactor(<filename>): token swap`.

### Task 28: Sweep auth forms

**Files:**
- Modify: `src/components/auth/login-form.tsx`
- Modify: `src/components/auth/signup-form.tsx`

- [ ] Token sweep both files. Commit each separately.

### Task 29: Sweep onboarding components

**Files:**
- Modify: `src/components/onboarding/address-step.tsx`
- Modify: `src/components/onboarding/child-step.tsx`
- Modify: `src/components/onboarding/interests-step.tsx`

- [ ] Token sweep all three. Commit each.

### Task 30: Sweep kids components

**Files:**
- Modify: `src/components/kids/child-card.tsx`
- Modify: `src/components/kids/child-form.tsx`

- [ ] Token sweep. For any `<KidAvatar>` call, pass `index` (use `kids.findIndex`). Commit each.

### Task 31: Sweep page-level files

**Files:**
- Modify: `src/app/page.tsx` (landing)
- Modify: `src/app/auth/login/page.tsx`
- Modify: `src/app/auth/signup/page.tsx`
- Modify: `src/app/explore/page.tsx`
- Modify: `src/app/activity/[slug]/page.tsx`
- Modify: `src/app/activity/[slug]/planner-stub.tsx`
- Modify: `src/app/kids/page.tsx`
- Modify: `src/app/kids/client.tsx`
- Modify: `src/app/schedule/[token]/page.tsx`
- Modify: `src/app/submit/page.tsx`
- Modify: `src/app/onboarding/page.tsx`
- Modify: `src/app/planner/page.tsx`

- [ ] One file per commit. Token sweep using the remapping table.

---

## Phase 6 — Cleanup and verification

### Task 32: Final sweep for any remaining old tokens

**Files:**
- All project files.

- [ ] **Step 1: Grep for any remaining old tokens.**

Run:

```bash
grep -rn "\(bg\|text\|border\|ring\)-\(cream\|bark\|sunset\|campfire\|meadow\|lake\|driftwood\|sand\|stone\)\b" src/ --include="*.tsx" --include="*.ts" --include="*.css"
```

Expected: zero results. If any hits, fix them per the remapping table.

Run:

```bash
grep -rn "\(font-serif\|font-mono\)" src/ --include="*.tsx" --include="*.ts" --include="*.css"
```

Expected: zero results. Replace any remaining `font-serif` with `font-display` and `font-mono` with `font-sans` (keep any sibling `uppercase`/`tracking-*` classes).

- [ ] **Step 2: If any old references exist, fix them and commit.**

Commit: `chore(styles): sweep remaining legacy token/font references`.

### Task 33: Retire unused kid palette colors

**Files:**
- Modify: `src/lib/kid-palette.ts`

- [ ] **Step 1: Grep for KID_PALETTE / paletteColorForIndex usage.**

Run: `grep -rn "KID_PALETTE\|paletteColorForIndex" src/ --include="*.ts" --include="*.tsx"`.

- [ ] **Step 2: If nothing uses them (which should be the case after KidShape rollout), remove the array and function; keep `initialFor` since KidShape uses it.**

Replace `src/lib/kid-palette.ts` with:

```ts
/** First letter of the name, uppercased. Falls back to "?". */
export function initialFor(name: string | null | undefined): string {
  if (!name) return "?";
  const trimmed = name.trim();
  return trimmed.length === 0 ? "?" : trimmed[0].toUpperCase();
}
```

If anything still imports `KID_PALETTE` or `paletteColorForIndex`, either (a) remove those imports if the values aren't used, or (b) keep the exports for now with a `// TODO: remove once callers are migrated` comment.

- [ ] **Step 3: Commit.**

```bash
git add src/lib/kid-palette.ts
git commit -m "chore(kid-palette): retire unused color palette; keep initialFor"
```

### Task 34: Visual QA walkthrough

- [ ] **Step 1: Start dev server.**

Run: `npm run dev`.

- [ ] **Step 2: Walk each route and confirm visual correctness.**

In a browser at `http://localhost:3000`:

Routes to inspect:
- `/` (landing)
- `/auth/login`
- `/auth/signup`
- `/onboarding` (if you have an unonboarded account)
- `/explore`
- `/activity/[some-slug]`
- `/kids`
- `/planner` — both logged-out and logged-in (logged-out may redirect)
- `/schedule/[some-token]` (if a shared planner exists)
- `/submit`

For each route, confirm:
- No layout shifts vs. pre-migration.
- All text uses Figtree (display) or Outfit (body).
- No warm earthy colors (cream/bark/sunset/campfire/meadow/lake/driftwood/sand/stone) appear.
- Existing caps+tracking labels are preserved.
- The nav is full-bleed yellow.
- The planner has the grey `.schedule-region` canvas wrapping the matrix.
- Kid avatars render as shapes, not colored circles.

- [ ] **Step 3: Run tests.**

Run: `npm test`. All should pass.

- [ ] **Step 4: Run build.**

Run: `npm run build`. Should succeed with no errors.

- [ ] **Step 5: Commit any small visual fixes discovered in QA.**

Commit: `fix(qa): visual cleanups from post-migration walkthrough`.

### Task 35: Final lint + commit

- [ ] **Step 1: Run lint.**

Run: `npm run lint`. Fix any new warnings introduced by the migration.

- [ ] **Step 2: Commit lint fixes if any.**

Commit: `chore: lint cleanup after visual overhaul`.

---

## Follow-up work (out of scope for this plan)

These items are flagged in the spec but intentionally left out of this implementation plan to keep scope focused:

1. `/explore` "Coming soon!" page content — the nav shows the stamp but the route itself is still live. A follow-up should decide whether to render a "Coming soon" placeholder on /explore or gate it differently.
2. `/account` and `/account/sharing` routes referenced by the auth dropdown — if these don't exist, either create stub pages or adjust the dropdown links to whatever the real settings routes are.
3. Extending kid shapes past 4 — if planners with 5+ kids appear, add a 5-pointed star shape and update `shapeForKidIndex` accordingly.
4. Cropping photo avatars to the kid's assigned shape — currently photo avatars render as circles regardless of shape; a follow-up can SVG-clip them.
