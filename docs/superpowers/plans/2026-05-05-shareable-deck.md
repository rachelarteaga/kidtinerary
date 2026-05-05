# Shareable Kidtinerary Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a 10-page portrait PDF (`public/kidtinerary-deck.pdf`) telling the Kidtinerary story — value prop, bets, current state, future ideas — hosted at `https://kidtinerary-sable.vercel.app/kidtinerary-deck.pdf`.

**Architecture:** Next.js App Router page at `app/deck/page.tsx` (uses existing globals.css palette + Outfit/Figtree fonts; root nav suppressed on `/deck`). Each "page" of the deck is a fixed-size section with CSS `page-break-after: always` so a headless Chrome print-to-PDF produces a clean 10-page document. Screenshots captured from prod via Playwright MCP using a dummy account ("Kid Test" with kids Nico + Luca), saved to `public/deck/screenshots/*.png`.

**Tech Stack:** Next.js 16 (App Router), Tailwind v4, Outfit + Figtree (already loaded in `layout.tsx`), Playwright MCP for screenshots, system Chrome `--headless --print-to-pdf` for PDF generation.

---

## Spec reference

[docs/superpowers/specs/2026-05-05-shareable-deck-design.md](../specs/2026-05-05-shareable-deck-design.md)

## File structure

**Create:**
- `app/deck/page.tsx` — server component, the deck content (10 sections, all copy lives here)
- `app/deck/layout.tsx` — nested layout that wraps `{children}` in a print-friendly container (no padding, no nav)
- `app/deck/deck.css` — print-specific CSS (page break rules, section sizing, `@media print` overrides)
- `public/deck/screenshots/planner.png` — captured from prod
- `public/deck/screenshots/catalog.png` — captured from prod
- `public/deck/screenshots/help-me-find.png` — captured from prod
- `public/deck/screenshots/kids.png` — captured from prod
- `public/deck/screenshots/schedule.png` — captured from prod
- `public/kidtinerary-deck.pdf` — final deliverable
- `scripts/build-deck.sh` — one-line wrapper that runs `npm run dev` (background) then prints to PDF

**Modify:**
- `src/components/layout/nav.tsx` — return `null` when `usePathname()` starts with `/deck` (suppress nav on deck route)
- `package.json` — add `"build:deck": "bash scripts/build-deck.sh"` script

---

## Phase 1 — Branch + spec commit

### Task 1: Create the feature branch

**Files:**
- None (git only)

- [ ] **Step 1: Verify branch state**

```bash
git fetch origin
git status
git log --oneline origin/main..HEAD
```

Expected: working tree may have unrelated `feature ideas/*.md` modifications and the `.claude/` untracked dir from current session — don't touch them. Confirm current branch is `catalog-scrape-confirm-and-cta-copy` with PR #40 already merged.

- [ ] **Step 2: Stash unrelated work and switch off the catalog branch**

```bash
git stash push -m "deck-pause" -- "feature ideas/" || true
git checkout main
git pull origin main
```

Expected: clean tree on `main`.

- [ ] **Step 3: Create deck branch**

```bash
git checkout -b shareable-deck
```

Expected: now on `shareable-deck`.

- [ ] **Step 4: Pop the stash and check that the spec is on disk**

```bash
git stash pop || true
ls docs/superpowers/specs/2026-05-05-shareable-deck-design.md
ls docs/superpowers/plans/2026-05-05-shareable-deck.md
```

Expected: both spec + plan visible.

- [ ] **Step 5: Commit spec + plan**

```bash
git add docs/superpowers/specs/2026-05-05-shareable-deck-design.md docs/superpowers/plans/2026-05-05-shareable-deck.md
git commit -m "docs(deck): spec + implementation plan for shareable PDF deck"
```

Expected: clean commit, no other files staged. Leave `feature ideas/*.md` modifications and `.claude/` untouched.

---

## Phase 2 — Dummy account + seed data (collaborative w/ Rachel)

These steps are **collaborative**. Rachel performs the human steps; you (the engineer) verify by visiting prod and confirming the data is present.

### Task 2: Sign up the dummy account on prod

**Files:** None (prod data only).

- [ ] **Step 1: Hand Rachel the signup instructions**

Tell Rachel exactly:
1. Open https://kidtinerary-sable.vercel.app in an incognito window.
2. Sign up with these credentials (she controls the email):
   - Name: **Kid Test**
   - Email: a throwaway she controls (e.g., `kidtinerary-demo@<her-domain>` or a fresh Gmail). She types the password herself.
3. Verify the email if prompted.
4. **Stop after the email is verified — don't go through onboarding yet.** We'll capture the onboarding screen for the deck.

Wait for confirmation before continuing.

- [ ] **Step 2: Capture the onboarding "first kid" screen**

Once Rachel confirms email is verified, ask her to open the site again, sign in as Sam, and stop on the first onboarding screen (the kid-creation step). Capture via Playwright MCP — see Task 5 — but for now just note this is the screenshot for page 7 of the deck.

### Task 3: Seed kids Nico + Luca (via UI)

**Files:** None (prod data only).

- [ ] **Step 1: Walk Rachel through adding Nico**

Tell Rachel:
1. While signed in as Sam, complete onboarding for the first kid:
   - Name: **Nico**
   - Birthday: pick any plausible date that makes him ~7 years old (e.g., 2018-09-12).
   - Categories: pick a realistic mix (e.g., Sports, Arts, Outdoors).
2. After onboarding, go to `/kids` and add a second kid:
   - Name: **Luca**
   - Birthday: ~5 years old (e.g., 2020-11-03).
   - Categories: realistic mix.

Wait for Rachel to confirm both kids are visible at `/kids`.

### Task 4: Seed planner + activities (via UI)

**Files:** None (prod data only).

- [ ] **Step 1: Walk Rachel through adding 5–8 activities**

Tell Rachel to go to `/catalog` and click `+ Add` for each of these (year-round mix; she may adapt names but keep the variety):

| Name | Provider | Status | Notes |
|------|----------|--------|-------|
| Coding Camp | Galileo Learning | Registered | Summer week; for Nico |
| Soccer Shots | Soccer Shots Bay Area | Registered | Saturdays; for Luca |
| Art Studio Saturdays | Sharon Art Studio | Considering | Weekend; either kid |
| Spring Break Adventure Camp | Mt. Tam Day Camp | Considering | Spring break week |
| Tennis Lessons | Tennis Tots | Waitlisted | After-school |
| Music Together | Music Together SF | Registered | Toddler class for Luca |
| Robotics After-School | Code Ninjas | Considering | Fall after-school |

She can fill provider/location free-text; the deck doesn't need them to be real.

- [ ] **Step 2: Walk Rachel through placing activities on the planner**

Tell Rachel to go to `/planner` and:
1. Make sure the date range covers a representative ~6 weeks (mix of school year + a school break + a summer week).
2. Drag activities from the rail onto cells across both kids' rows. Aim for:
   - At least one **Registered** activity visible per kid per week.
   - At least one **Considering** activity (so the status colors show).
   - At least one **Waitlisted** activity.
   - One **conflict** (two activities on the same kid + week) so the conflict styling shows.

Wait for Rachel to confirm `/planner` looks visually rich.

- [ ] **Step 3: Confirm the public schedule link works**

Tell Rachel to click **Share** on the planner, copy the public link, and paste it back to you. Open it in an incognito tab to verify it renders for an anon viewer. Save the link — you'll screenshot it in Task 5.

---

## Phase 3 — Build the deck shell

### Task 5: Suppress the nav on `/deck` routes

**Files:**
- Modify: `src/components/layout/nav.tsx`

- [ ] **Step 1: Read the current Nav implementation**

```bash
cat src/components/layout/nav.tsx | head -40
```

Note the current top-level structure — confirm it's a client component (it must already be, since it's a nav). If it isn't, you'll need to make a small wrapper.

- [ ] **Step 2: Add a pathname check**

Edit `src/components/layout/nav.tsx`. At the top of the component body, after existing hooks, add:

```tsx
import { usePathname } from "next/navigation";
// ...
const pathname = usePathname();
if (pathname?.startsWith("/deck")) return null;
```

Place the `usePathname()` call alongside any other hooks (must be called unconditionally before the early return).

- [ ] **Step 3: Verify locally**

```bash
npm run dev
```

Visit `http://localhost:3000/deck` (will 404 for now — that's expected) and check that visiting any other route still shows the nav. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/nav.tsx
git commit -m "feat(deck): suppress nav on /deck route"
```

### Task 6: Scaffold the deck route + print CSS

**Files:**
- Create: `app/deck/layout.tsx`
- Create: `app/deck/page.tsx`
- Create: `app/deck/deck.css`

Note: there's no top-level `app/` folder; routes live in `src/app/`. Adjust paths to `src/app/deck/...`.

- [ ] **Step 1: Create the print CSS**

Create `src/app/deck/deck.css` with:

```css
.deck-root {
  --deck-page-w: 8.5in;
  --deck-page-h: 11in;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #e7e7eb;
  min-height: 100vh;
  padding: 2rem 0;
  gap: 0.75rem;
}

.deck-page {
  width: var(--deck-page-w);
  height: var(--deck-page-h);
  background: var(--color-surface);
  color: var(--color-ink);
  position: relative;
  overflow: hidden;
  box-shadow: 0 6px 24px -8px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
}

@media print {
  @page {
    size: 8.5in 11in;
    margin: 0;
  }
  html, body {
    background: #ffffff !important;
  }
  .deck-root {
    background: #ffffff;
    padding: 0;
    gap: 0;
  }
  .deck-page {
    box-shadow: none;
    page-break-after: always;
    break-after: page;
  }
  .deck-page:last-child {
    page-break-after: auto;
  }
}
```

- [ ] **Step 2: Create the deck layout**

Create `src/app/deck/layout.tsx`:

```tsx
import "./deck.css";

export default function DeckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="deck-root">{children}</div>;
}
```

- [ ] **Step 3: Stub the deck page**

Create `src/app/deck/page.tsx` with 10 placeholder pages:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kidtinerary — what we're building",
  robots: { index: false, follow: false },
};

export default function DeckPage() {
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <section key={i} className="deck-page">
          <div className="flex-1 flex items-center justify-center text-ink-2 font-display text-2xl">
            Page {i + 1}
          </div>
        </section>
      ))}
    </>
  );
}
```

- [ ] **Step 4: Verify locally**

```bash
npm run dev
```

Visit `http://localhost:3000/deck`. Expected: 10 stacked white pages on a grey background, no nav, each page labelled "Page 1" → "Page 10".

Then test print preview: `Cmd+P` in the browser. Confirm 10 pages, no headers/footers, content not cropped. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/app/deck
git commit -m "feat(deck): scaffold /deck route with 10-page print layout"
```

### Task 7: Build the cover page (page 1)

**Files:**
- Modify: `src/app/deck/page.tsx`

- [ ] **Step 1: Replace the page-1 placeholder with the cover**

Replace the array's first iteration with a real `Page1` component. Edit `src/app/deck/page.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kidtinerary — what we're building",
  robots: { index: false, follow: false },
};

function Page1Cover() {
  return (
    <section className="deck-page">
      <div className="flex-1 flex flex-col justify-between p-16">
        <div className="flex items-center gap-3">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ background: "var(--color-hero)" }}
          />
          <span className="font-display text-sm tracking-[0.2em] uppercase text-ink-2">
            Kidtinerary
          </span>
        </div>
        <div>
          <h1 className="font-display font-extrabold text-[88px] leading-[0.95] tracking-tight">
            Every activity<br />your kid does,<br />in one place.
          </h1>
          <p className="mt-8 max-w-[560px] text-xl text-ink-2 leading-relaxed">
            A personal catalog of every camp, class, lesson, and sport — past, present, and considering. With a text when it&rsquo;s time to sign up, pay, or show up.
          </p>
        </div>
        <div className="flex items-baseline justify-between text-sm text-ink-2">
          <span>Building in public · Rachel Arteaga</span>
          <span>kidtinerary.com</span>
        </div>
      </div>
    </section>
  );
}

export default function DeckPage() {
  return (
    <>
      <Page1Cover />
      {Array.from({ length: 9 }).map((_, i) => (
        <section key={i} className="deck-page">
          <div className="flex-1 flex items-center justify-center text-ink-2 font-display text-2xl">
            Page {i + 2}
          </div>
        </section>
      ))}
    </>
  );
}
```

- [ ] **Step 2: Verify visually**

Run `npm run dev`, visit `/deck`, scroll to page 1. Expected: dot + small "KIDTINERARY" caps, large 88px display headline ("Every activity / your kid does, / in one place."), description copy, footer line. Confirm proportions look balanced; tweak font sizes only if obviously off.

- [ ] **Step 3: Commit**

```bash
git add src/app/deck/page.tsx
git commit -m "feat(deck): page 1 cover"
```

### Task 8: Build pages 2 (problem) and 3 (what it is)

**Files:**
- Modify: `src/app/deck/page.tsx`

- [ ] **Step 1: Add `Page2Problem` component**

Insert after `Page1Cover`:

```tsx
function Page2Problem() {
  const pains = [
    {
      title: "Registration windows are unforgiving.",
      body: "Camps and programs open on a Tuesday at 9am, sell out by 9:07am, and there&rsquo;s no calendar that knows about any of them.",
    },
    {
      title: "Information lives in a hundred tabs.",
      body: "PDFs, group texts, school newsletters, half-remembered conversations at pickup. Nothing aggregates.",
    },
    {
      title: "Coordinating across kids and parents is manual.",
      body: "Two kids, two schedules, two adults trying to keep them straight in a shared notes app or a spreadsheet that starts strong and dies in March.",
    },
  ];
  return (
    <section className="deck-page">
      <div className="flex-1 flex flex-col p-16">
        <span className="font-display text-sm tracking-[0.2em] uppercase text-ink-2">
          The problem
        </span>
        <h2 className="mt-4 font-display font-bold text-[56px] leading-[1.05] max-w-[660px]">
          Coordinating a kid&rsquo;s year is a part-time job nobody asked for.
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-8 max-w-[640px]">
          {pains.map((p) => (
            <div key={p.title}>
              <p className="font-display font-semibold text-xl">{p.title}</p>
              <p className="mt-2 text-ink-2 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add `Page3WhatItIs` component**

Insert after `Page2Problem`:

```tsx
function Page3WhatItIs() {
  return (
    <section className="deck-page">
      <div className="flex-1 flex flex-col p-16">
        <span className="font-display text-sm tracking-[0.2em] uppercase text-ink-2">
          What it is
        </span>
        <h2 className="mt-4 font-display font-bold text-[56px] leading-[1.05] max-w-[680px]">
          A planner for everything in a kid&rsquo;s life.
        </h2>
        <p className="mt-8 text-xl text-ink-2 leading-relaxed max-w-[640px]">
          Camps, classes, after-school, weekends, school breaks. One place to hold what your kids are doing, what they&rsquo;re considering, and what&rsquo;s already locked in &mdash; week by week, kid by kid.
        </p>
        <p className="mt-6 text-xl text-ink-2 leading-relaxed max-w-[640px]">
          Summer-camp planning is the most-built example today. The model underneath is broader: every activity in the year your family is choosing, or not choosing, together.
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Wire into the export**

Replace the `Array.from({ length: 9 })` block in `DeckPage` to start with `Page2Problem`, `Page3WhatItIs`, then 7 placeholders:

```tsx
export default function DeckPage() {
  return (
    <>
      <Page1Cover />
      <Page2Problem />
      <Page3WhatItIs />
      {Array.from({ length: 7 }).map((_, i) => (
        <section key={i} className="deck-page">
          <div className="flex-1 flex items-center justify-center text-ink-2 font-display text-2xl">
            Page {i + 4}
          </div>
        </section>
      ))}
    </>
  );
}
```

- [ ] **Step 4: Verify visually**

Run `npm run dev`, visit `/deck`. Confirm pages 2 and 3 render, each fits in one printed page (Cmd+P preview), and the typography looks consistent with page 1.

- [ ] **Step 5: Commit**

```bash
git add src/app/deck/page.tsx
git commit -m "feat(deck): pages 2-3 problem + what it is"
```

### Task 9: Build page 4 (the bets)

**Files:**
- Modify: `src/app/deck/page.tsx`

- [ ] **Step 1: Add `Page4Bets` component**

```tsx
function Page4Bets() {
  const bets = [
    {
      n: "01",
      title: "Structure beats chaos.",
      body: "Spreadsheets and group chats fall apart by mid-March. A real data model &mdash; kids, weeks, statuses &mdash; doesn&rsquo;t.",
    },
    {
      n: "02",
      title: "Planning is a social act.",
      body: "Families don&rsquo;t plan alone. Co-parents, friends with shared schedules, agents acting on your behalf &mdash; all should be first-class.",
    },
    {
      n: "03",
      title: "AI-forward, not AI-decorative.",
      body: "&lsquo;Help me find,&rsquo; agent-friendly write APIs, email parsing into structured updates. AI does the busywork; humans make the calls.",
    },
  ];
  return (
    <section className="deck-page">
      <div className="flex-1 flex flex-col p-16">
        <span className="font-display text-sm tracking-[0.2em] uppercase text-ink-2">
          The bets
        </span>
        <h2 className="mt-4 font-display font-bold text-[56px] leading-[1.05]">
          Three things we believe.
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-10">
          {bets.map((b) => (
            <div key={b.n} className="flex gap-8 items-start">
              <span className="font-display font-bold text-4xl text-ink-3 w-16 shrink-0">
                {b.n}
              </span>
              <div>
                <p className="font-display font-semibold text-2xl">{b.title}</p>
                <p className="mt-2 text-ink-2 leading-relaxed max-w-[560px]" dangerouslySetInnerHTML={{ __html: b.body }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Wire into export**

Add `<Page4Bets />` after `<Page3WhatItIs />` and reduce the placeholder array to 6.

- [ ] **Step 3: Verify visually**

`npm run dev`, scroll to page 4. Three numbered bets, large title, breathing room.

- [ ] **Step 4: Commit**

```bash
git add src/app/deck/page.tsx
git commit -m "feat(deck): page 4 the bets"
```

### Task 10: Build pages 5–8 with screenshot placeholders

**Files:**
- Modify: `src/app/deck/page.tsx`

These pages all share the same shape: caps eyebrow + short title + screenshot + 25–40-word caption. Use placeholder images for now (a grey 1200x780 box); real screenshots slot in during Task 13.

- [ ] **Step 1: Add a reusable `ScreenshotPage` component**

Add this near the top of `page.tsx`:

```tsx
function ScreenshotPage(props: {
  eyebrow: string;
  title: string;
  caption: string;
  imgSrc: string;
  imgAlt: string;
}) {
  return (
    <section className="deck-page">
      <div className="flex-1 flex flex-col p-12">
        <span className="font-display text-sm tracking-[0.2em] uppercase text-ink-2">
          {props.eyebrow}
        </span>
        <h2 className="mt-3 font-display font-bold text-[40px] leading-[1.05] max-w-[680px]">
          {props.title}
        </h2>
        <div className="mt-8 flex-1 flex items-center justify-center">
          <img
            src={props.imgSrc}
            alt={props.imgAlt}
            className="max-w-full max-h-full rounded-xl shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)] border border-ink-3/30"
          />
        </div>
        <p className="mt-6 text-ink-2 text-base leading-relaxed max-w-[680px]">
          {props.caption}
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add the four screenshot pages**

```tsx
function Page5Planner() {
  return (
    <ScreenshotPage
      eyebrow="Current state · Planner"
      title="Drag from the rail. Drop on a week. Done."
      caption="Every kid&rsquo;s year on one grid. Statuses (considering, waitlisted, registered) are colored, conflicts surface automatically, and the share button puts a read-only link in your hand."
      imgSrc="/deck/screenshots/planner.png"
      imgAlt="Kidtinerary planner showing weeks across two kids with mixed activity statuses"
    />
  );
}

function Page6Catalog() {
  return (
    <ScreenshotPage
      eyebrow="Current state · Catalog"
      title="A personal master library, plus an AI scout."
      caption="The Catalog holds every activity you&rsquo;ve ever considered. &lsquo;Help me find&rsquo; runs an LLM-powered web search, returns real options, and drops them straight into your library."
      imgSrc="/deck/screenshots/catalog.png"
      imgAlt="Kidtinerary catalog with activity rows and a help-me-find drawer"
    />
  );
}

function Page7Onboarding() {
  return (
    <ScreenshotPage
      eyebrow="Current state · Kids & onboarding"
      title="Sign up, add the kids, start placing weeks."
      caption="Onboarding asks for the smallest viable picture of each kid &mdash; name, age, the kinds of things they do &mdash; and lands you straight on an empty planner ready to fill."
      imgSrc="/deck/screenshots/kids.png"
      imgAlt="Onboarding screen for adding a kid"
    />
  );
}

function Page8Schedule() {
  return (
    <ScreenshotPage
      eyebrow="Current state · Sharing"
      title="A read-only link anyone can open."
      caption="Public schedule pages turn a planner into something you can text to a co-parent, a grandparent, or a babysitter. No account needed to view."
      imgSrc="/deck/screenshots/schedule.png"
      imgAlt="Public schedule view shown to an anonymous viewer"
    />
  );
}
```

- [ ] **Step 3: Add temporary placeholder images**

Create `public/deck/screenshots/.gitkeep`:

```bash
mkdir -p public/deck/screenshots
touch public/deck/screenshots/.gitkeep
```

For now, until Task 13 supplies real images, point the `<img>` `src` at a placeholder. Quick approach: any 1200x780 transparent PNG. To unblock visual review locally, drop a placeholder PNG (any image) at each of:
- `public/deck/screenshots/planner.png`
- `public/deck/screenshots/catalog.png`
- `public/deck/screenshots/kids.png`
- `public/deck/screenshots/schedule.png`

Generate placeholders quickly:

```bash
for name in planner catalog kids schedule; do
  cat > "public/deck/screenshots/$name.svg" <<EOF
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 780"><rect width="1200" height="780" fill="#e8edf1"/><text x="600" y="400" font-family="Outfit, sans-serif" font-size="48" fill="#666" text-anchor="middle">$name placeholder</text></svg>
EOF
done
```

Then point each `imgSrc` to `.svg` instead of `.png` until Task 13.

- [ ] **Step 4: Wire into export**

```tsx
export default function DeckPage() {
  return (
    <>
      <Page1Cover />
      <Page2Problem />
      <Page3WhatItIs />
      <Page4Bets />
      <Page5Planner />
      <Page6Catalog />
      <Page7Onboarding />
      <Page8Schedule />
      {Array.from({ length: 2 }).map((_, i) => (
        <section key={i} className="deck-page">
          <div className="flex-1 flex items-center justify-center text-ink-2 font-display text-2xl">
            Page {i + 9}
          </div>
        </section>
      ))}
    </>
  );
}
```

- [ ] **Step 5: Verify visually**

`npm run dev`, visit `/deck`. Pages 5–8 each have eyebrow, title, screenshot box, caption. Each fits one printed page (Cmd+P preview).

- [ ] **Step 6: Commit**

```bash
git add src/app/deck/page.tsx public/deck
git commit -m "feat(deck): pages 5-8 with screenshot placeholders"
```

### Task 11: Build page 9 (what's next)

**Files:**
- Modify: `src/app/deck/page.tsx`

- [ ] **Step 1: Add `Page9WhatsNext` component**

Source the items below from `feature ideas/cross-cutting.md`, `camp-list.md`, `planner.md`, `account.md`, `schedule.md`. Keep the "why" wording from the source notes.

```tsx
function Page9WhatsNext() {
  const items = [
    {
      title: "Collections",
      body: "A staging layer between catalog and planner: &lsquo;Thinking about for Nico, Fall 2026.&rsquo; Pinterest-board adjacent. Catalog → Collections → Planner.",
    },
    {
      title: "Bring your agent",
      body: "An MCP server and write API so a parent&rsquo;s AI agent can flip a status, set a registration date, or parse a confirmation email straight into the planner.",
    },
    {
      title: "Planning with friends",
      body: "Linked planners across families &mdash; when kids share a camp, the activity lights up on each parent&rsquo;s grid. Coordinate carpools, sign up together.",
    },
    {
      title: "Calendar view",
      body: "An alternative to the weekly grid for users who think in calendar layouts &mdash; visualizes single-day events, dropoff times, conflicts at a glance.",
    },
    {
      title: "Predictive address everywhere",
      body: "One shared autocomplete component for every address input &mdash; kid home, camp location, organization &mdash; instead of free-text.",
    },
    {
      title: "Rich link previews on share",
      body: "When a planner link gets texted, the preview shows a branded card: &lsquo;Rachel shared {planner name} with you&rsquo; instead of a bare URL that reads as spam.",
    },
  ];
  return (
    <section className="deck-page">
      <div className="flex-1 flex flex-col p-12">
        <span className="font-display text-sm tracking-[0.2em] uppercase text-ink-2">
          What&rsquo;s next
        </span>
        <h2 className="mt-3 font-display font-bold text-[40px] leading-[1.05] max-w-[680px]">
          The roadmap, in plain English.
        </h2>
        <div className="mt-8 grid grid-cols-2 gap-x-10 gap-y-6">
          {items.map((it) => (
            <div key={it.title}>
              <p className="font-display font-semibold text-lg">{it.title}</p>
              <p
                className="mt-1 text-ink-2 text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: it.body }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Wire into export, drop placeholder count to 1**

Replace the previous placeholder loop with `<Page9WhatsNext />` followed by one remaining placeholder for page 10.

- [ ] **Step 3: Verify visually + Cmd+P print preview**

Confirm 6-item 2-column grid fits comfortably on the page. Adjust gap if cramped.

- [ ] **Step 4: Commit**

```bash
git add src/app/deck/page.tsx
git commit -m "feat(deck): page 9 what's next"
```

### Task 12: Build page 10 (closing)

**Files:**
- Modify: `src/app/deck/page.tsx`

- [ ] **Step 1: Add `Page10Closing`**

```tsx
function Page10Closing() {
  return (
    <section className="deck-page">
      <div className="flex-1 flex flex-col justify-between p-16">
        <span className="font-display text-sm tracking-[0.2em] uppercase text-ink-2">
          The bigger picture
        </span>
        <div>
          <h2 className="font-display font-bold text-[64px] leading-[1.0] max-w-[660px]">
            Every activity, every kid, every week of the year.
          </h2>
          <p className="mt-8 text-xl text-ink-2 leading-relaxed max-w-[600px]">
            Summer camps got us started. The product underneath is built for the rest of the year too &mdash; school-year classes, after-school, weekends, breaks &mdash; all in the same grid.
          </p>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="font-display text-sm tracking-[0.2em] uppercase text-ink-2">
              Try it
            </p>
            <p className="mt-1 font-display text-xl">
              kidtinerary-sable.vercel.app
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-sm tracking-[0.2em] uppercase text-ink-2">
              Reach out
            </p>
            <p className="mt-1 font-display text-xl">
              rachelressner@gmail.com
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Wire as final page**

Replace the last placeholder with `<Page10Closing />`. The export should now have exactly 10 page components, no `Array.from`.

- [ ] **Step 3: Verify all 10 pages**

`npm run dev`, scroll all the way through. Cmd+P → preview → confirm exactly 10 pages, no overflow, no clipped text.

- [ ] **Step 4: Commit**

```bash
git add src/app/deck/page.tsx
git commit -m "feat(deck): page 10 closing"
```

---

## Phase 4 — Real screenshots

### Task 13: Capture screenshots from prod

**Files:**
- Replace: `public/deck/screenshots/{planner,catalog,kids,schedule}.png` (real images)
- Add: `public/deck/screenshots/help-me-find.png` if catalog page wants two images (optional; use one per the current plan)

This task uses the **Playwright MCP server** that's already loaded into the session (no `npm install` required).

- [ ] **Step 1: Confirm Rachel finished seeding (Phase 2)**

Don't start until Rachel has confirmed Kid Test, Nico, Luca, the activities, and the planner placements all exist on prod.

- [ ] **Step 2: Open prod and have Rachel sign in**

Use `mcp__plugin_playwright_playwright__browser_navigate` to open `https://kidtinerary-sable.vercel.app`. Tell Rachel: "Type the password yourself when you see the login prompt; I won&rsquo;t see it."

- [ ] **Step 3: Capture the planner screenshot**

```
mcp__plugin_playwright_playwright__browser_navigate → /planner
mcp__plugin_playwright_playwright__browser_resize → width 1440, height 900
mcp__plugin_playwright_playwright__browser_take_screenshot → save to public/deck/screenshots/planner.png
```

Verify: open the file locally; planner should show 2 kid rows × ~6 weeks with status colors visible.

- [ ] **Step 4: Capture the catalog screenshot**

```
browser_navigate → /catalog
browser_take_screenshot → save to public/deck/screenshots/catalog.png
```

If the help-me-find drawer is open in this shot, even better. Otherwise click the "Help me find" button first, wait for the drawer to populate (or stop after the prompt input is visible), then capture.

- [ ] **Step 5: Capture the kids screenshot**

```
browser_navigate → /kids
browser_take_screenshot → save to public/deck/screenshots/kids.png
```

Should show Nico + Luca tiles.

- [ ] **Step 6: Capture the public schedule screenshot**

Sign out (or open a new incognito-equivalent tab via `browser_tabs`), open the share link Rachel saved in Task 4, capture:

```
browser_navigate → <share link>
browser_take_screenshot → save to public/deck/screenshots/schedule.png
```

Confirm the shot is the anon view (no signed-in chrome).

- [ ] **Step 7: Update `<img>` srcs**

Edit `src/app/deck/page.tsx`. In `Page5Planner` through `Page8Schedule`, change `imgSrc` from `.svg` to `.png`. Delete the placeholder `.svg` files.

```bash
rm public/deck/screenshots/*.svg
```

- [ ] **Step 8: Verify visually**

`npm run dev`, scroll through `/deck`. Each screenshot should be sharp, not stretched, and read at the deck&rsquo;s zoom level. If any looks too small/wide, recapture at a different viewport size (e.g., 1280×800) and retry.

- [ ] **Step 9: Commit**

```bash
git add public/deck/screenshots src/app/deck/page.tsx
git commit -m "feat(deck): capture real screenshots from prod"
```

---

## Phase 5 — Generate the PDF

### Task 14: Build PDF generation script

**Files:**
- Create: `scripts/build-deck.sh`
- Modify: `package.json` (add `build:deck` script)

- [ ] **Step 1: Locate Chrome on the system**

```bash
ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

If missing, use Chromium-based browser path or fall back to `chromium` via Playwright. Confirm Chrome exists before continuing.

- [ ] **Step 2: Write the build script**

Create `scripts/build-deck.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PORT=${PORT:-3030}
URL="http://localhost:${PORT}/deck"
OUT="public/kidtinerary-deck.pdf"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

echo "→ starting dev server on port ${PORT}…"
npx next dev -p "${PORT}" >/tmp/deck-dev.log 2>&1 &
DEV_PID=$!
trap "kill ${DEV_PID} 2>/dev/null || true" EXIT

# Wait for the server to respond
for i in {1..30}; do
  if curl -sf "${URL}" >/dev/null; then
    echo "→ server up"
    break
  fi
  sleep 1
done

echo "→ printing ${URL} to ${OUT}…"
"${CHROME}" \
  --headless=new \
  --disable-gpu \
  --no-sandbox \
  --hide-scrollbars \
  --print-to-pdf="${OUT}" \
  --print-to-pdf-no-header \
  --no-pdf-header-footer \
  --virtual-time-budget=10000 \
  "${URL}"

echo "→ wrote ${OUT}"
ls -lh "${OUT}"
```

- [ ] **Step 3: Make it executable + add npm script**

```bash
chmod +x scripts/build-deck.sh
```

Edit `package.json` `"scripts"` to add:

```json
"build:deck": "bash scripts/build-deck.sh"
```

- [ ] **Step 4: Run it**

```bash
npm run build:deck
```

Expected: a `public/kidtinerary-deck.pdf` is created. File size should be > 200KB (PNG screenshots are heavy) and < 10MB.

- [ ] **Step 5: Open the PDF and review**

```bash
open public/kidtinerary-deck.pdf
```

Verify: 10 pages, screenshots crisp, no clipped text, no Chrome print headers/footers, no nav showing through.

- [ ] **Step 6: If anything's wrong, fix in `src/app/deck/page.tsx` or `deck.css`, regenerate, repeat**

Common issues + fixes:
- **Headers/footers showing**: confirm `--no-pdf-header-footer` flag is honored on your Chrome version; alternative is to add explicit `@page { margin: 0 }` (already in CSS).
- **Content cropped on a page**: shrink the offending section's font size or padding; do NOT increase page height.
- **Screenshot misaligned**: tweak the `<img>` `max-w-full max-h-full` rules.
- **Fonts not loaded**: add `--virtual-time-budget=10000` (already in script) and ensure `display: 'swap'` on font imports (already set in `src/app/layout.tsx`).

- [ ] **Step 7: Commit**

```bash
git add scripts/build-deck.sh package.json public/kidtinerary-deck.pdf
git commit -m "feat(deck): pdf build script + first generated deck"
```

---

## Phase 6 — Ship

### Task 15: Push branch + open PR

**Files:** None (git only).

- [ ] **Step 1: Verify branch state**

```bash
git fetch origin
git status
git log --oneline origin/main..HEAD
```

Confirm: only deck-related commits ahead of main, no stray files.

- [ ] **Step 2: Push branch**

```bash
git push -u origin shareable-deck
```

- [ ] **Step 3: Open the PR**

```bash
gh pr create --title "feat(deck): shareable PDF deck at /kidtinerary-deck.pdf" --body "$(cat <<'EOF'
## Summary
- New `/deck` route renders a 10-page portrait deck styled with the product's palette and Outfit/Figtree fonts
- `npm run build:deck` prints `/deck` to `public/kidtinerary-deck.pdf` via headless Chrome
- Shareable URL after deploy: https://kidtinerary-sable.vercel.app/kidtinerary-deck.pdf

## Why
Rachel needs a single hosted PDF to share with friends and other interested parties — value prop, current state, future ideas — that scrolls cleanly on a phone.

## What's in it
- **Spec + plan**: docs/superpowers/specs/2026-05-05-shareable-deck-design.md, docs/superpowers/plans/2026-05-05-shareable-deck.md
- **Deck route**: src/app/deck/{layout,page}.tsx + deck.css; nav suppressed on /deck via src/components/layout/nav.tsx
- **Screenshots**: public/deck/screenshots/{planner,catalog,kids,schedule}.png — captured from prod against a dummy account (Kid Test, kids Nico + Luca)
- **PDF**: public/kidtinerary-deck.pdf — 10 pages, generated via scripts/build-deck.sh

## Test plan
- [ ] Visit `/deck` on the preview deploy → renders cleanly without nav
- [ ] Open the deployed PDF URL → 10 pages, screenshots intact, no broken images
- [ ] Open the PDF on a phone → scrolling reads naturally
- [ ] Share the PDF link to a friend via iMessage → preview works

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Capture the PR URL from the output.

- [ ] **Step 4: Echo the PR URL back to Rachel**

Echo the full GitHub PR URL in the chat response — Rachel's preference is "always link the PR" with the full URL.

---

## Out of scope

- Animated/interactive web version of the deck (only the static HTML + PDF)
- Custom logo (uses existing wordmark)
- Investor financials / TAM
- Accessibility pass (the PDF is an offline artifact; the underlying `/deck` route is no-index)
