# Friends' Plans Overlap — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a logged-in user views their own planner, automatically surface small avatar dots on any cell where a saved-friend's kid is enrolled in the same camp the same week — so coordination ("Liam's also at Galileo this week, let me text his mom") becomes a one-glance moment without leaving the planner.

**Architecture:** Server-side, fetch each saved-friend's planner payload via the existing `get_shared_planner_by_token` RPC (it already returns full entries + kids + owner_display_name). Pre-compute an `overlapsByCell` map keyed by `<kidId>::<weekKey>` — pure derivation, no schema or RPC changes. Pass that map down to `PlannerClient` and into each `PlannerCell`, which renders a small avatar-dot stack via a new `<OverlapBadgeStack>` in the cell's top-right corner. Tap/click an avatar → small popover with friend-kid name, owner name, and a link to the owner's full shared planner. The left rail (`MyActivitiesRail`) gains a second tab "Friends' Plans" that lists each saved-friend planner as a passive context panel (no filter UI in V1 — overlap is auto-on for all saved friends).

**Tech Stack:** Next.js App Router (Server Component → Client Component data flow), TypeScript, Tailwind v4, Supabase RPCs (already deployed), vitest for unit tests.

---

## Scope check

V1 deliberately excludes:
- **Discovery in empty cells** — if a friend has activity in a week the user has nothing, the user's cell stays empty. Discussed and punted to a later phase (the "ghost cell" variant) because (a) low overlap rate is acceptable for V1, (b) bringing discovery in expands UX scope materially.
- **Per-friend toggles** — the rail tab is passive. If the user has noisy friends, they can unsave the share from the same tab.
- **Mobile rail tab implementation** — out of scope; the mobile sheet currently shows only "My Activities." Adding a tab toggle to the bottom sheet is a small follow-up but not part of this plan because the desktop tab UX is the priority.
- **Phase 2 of Layer B (signup name backfill)** — separate task chip. "Shared by [name]" already falls back to "a friend" if `display_name` is null, so this plan ships cleanly even without name data.

---

## File Structure

**New files:**
- `src/lib/overlap.ts` — pure `computeFriendOverlaps()` helper + `FriendOverlap` type (DI-friendly, fully testable)
- `tests/lib/overlap.test.ts` — unit tests covering empty input, single match, multi-friend stacking, week-boundary correctness
- `src/components/planner/overlap-badge-stack.tsx` — UI component: stacked avatar dots in a cell corner, click → popover
- `src/components/planner/friends-plans-panel.tsx` — passive list of saved-share planners (owner name + kids + remove)
- `src/components/planner/planner-rail.tsx` — tabbed container wrapping `MyActivitiesRail` content and `FriendsPlansPanel`

**Modified files:**
- `src/app/planner/page.tsx` — fetch friend payloads + compute overlaps; pass to client
- `src/app/planner/client.tsx` — accept new props; pass overlap map down to cells; render new `PlannerRail` instead of inline `MyActivitiesRail`
- `src/components/planner/planner-cell.tsx` — accept optional `overlap` prop; render badge stack in top-right corner when present
- `src/components/planner/my-activities-rail.tsx` — extract its rail content so the new tabbed container can host it (no functional change — just decomposition)

---

## Task 1: Pure overlap helper + tests

**Files:**
- Create: `src/lib/overlap.ts`
- Create: `tests/lib/overlap.test.ts`

- [ ] **Step 1: Write `src/lib/overlap.ts`**

```ts
/** A single friend-kid's enrollment that matches one of YOUR planner cells. */
export interface FriendOverlap {
  /** shared_schedules.id of the share the friend-kid comes from. */
  shareId: string;
  /** The share's URL token, for the "View Sarah's full planner →" link. */
  shareToken: string;
  /** Owner's display name (the parent who shared). Falls back to "a friend"
   *  upstream if null — this helper does NOT apply the fallback. */
  ownerName: string | null;
  /** Friend-kid's first name. */
  kidName: string;
  /** Friend-kid's identity color (from children.color), used to tint the dot. */
  kidColor: string;
}

/** A friend planner payload, as returned by get_shared_planner_by_token via the
 *  RPC mapper. We only need the subset of fields required for overlap matching;
 *  the matcher does NOT need the full SharedByTokenResult shape. */
export interface FriendPlannerForOverlap {
  shareId: string;
  shareToken: string;
  ownerName: string | null;
  kids: { id: string; name: string; color: string }[];
  /** Entries flattened to {child_id, activity_id, week_key}. The caller is
   *  responsible for projecting the raw entries into this minimal shape using
   *  the same getWeekKey() the user-planner code already uses. */
  entries: { child_id: string; activity_id: string; week_key: string }[];
}

/** One of YOUR planner entries (your kid, your activity, your week). */
export interface UserPlannerEntry {
  /** Your kid's id — used as the FIRST key in the output map. */
  child_id: string;
  /** The activity to match on. */
  activity_id: string;
  /** Week-key string from getWeekKey(). Used as the SECOND key. */
  week_key: string;
}

/** Map key shape: `${userKidId}::${weekKey}`. One entry per cell that has at
 *  least one matching friend-kid. Cells with zero overlaps are absent from the
 *  map (not present-with-empty-array) so the UI can do a simple lookup. */
export type OverlapMap = Record<string, FriendOverlap[]>;

const KEY_SEP = "::";

/** Compose a stable cell-lookup key from (userKidId, weekKey). Exported so
 *  callers can build the same key when reading the map. */
export function overlapKey(userKidId: string, weekKey: string): string {
  return `${userKidId}${KEY_SEP}${weekKey}`;
}

/** Pure overlap matcher. For each of YOUR planner cells (kid + week +
 *  activity), find all friend-kids enrolled in the SAME activity the SAME
 *  week. Returns a map keyed by `${userKidId}::${weekKey}` → list of friend
 *  overlaps, sorted by ownerName then kidName for stable rendering. */
export function computeFriendOverlaps(
  userEntries: UserPlannerEntry[],
  friendPlanners: FriendPlannerForOverlap[],
): OverlapMap {
  // Build a (activity_id, week_key) → friend overlaps[] index so we can do
  // one pass over user entries.
  const friendIndex = new Map<string, FriendOverlap[]>();
  for (const fp of friendPlanners) {
    const kidById = new Map(fp.kids.map((k) => [k.id, k]));
    for (const e of fp.entries) {
      const kid = kidById.get(e.child_id);
      if (!kid) continue;
      const k = `${e.activity_id}${KEY_SEP}${e.week_key}`;
      const list = friendIndex.get(k) ?? [];
      list.push({
        shareId: fp.shareId,
        shareToken: fp.shareToken,
        ownerName: fp.ownerName,
        kidName: kid.name,
        kidColor: kid.color,
      });
      friendIndex.set(k, list);
    }
  }

  const out: OverlapMap = {};
  for (const ue of userEntries) {
    const indexKey = `${ue.activity_id}${KEY_SEP}${ue.week_key}`;
    const matches = friendIndex.get(indexKey);
    if (!matches || matches.length === 0) continue;
    const cellKey = overlapKey(ue.child_id, ue.week_key);
    const existing = out[cellKey] ?? [];
    // De-dupe by (shareId, kidName) in case the user has the same activity
    // twice in the same cell (unusual but possible with multi-session weeks).
    for (const m of matches) {
      const dup = existing.some(
        (x) => x.shareId === m.shareId && x.kidName === m.kidName,
      );
      if (!dup) existing.push(m);
    }
    out[cellKey] = existing;
  }

  // Stable sort each cell's overlaps for consistent render order.
  for (const k of Object.keys(out)) {
    out[k].sort((a, b) => {
      const ao = (a.ownerName ?? "").localeCompare(b.ownerName ?? "");
      if (ao !== 0) return ao;
      return a.kidName.localeCompare(b.kidName);
    });
  }
  return out;
}
```

- [ ] **Step 2: Write the failing tests in `tests/lib/overlap.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  computeFriendOverlaps,
  overlapKey,
  type FriendPlannerForOverlap,
  type UserPlannerEntry,
} from "@/lib/overlap";

const jack = "kid-jack";
const teddy = "kid-teddy";
const W1 = "2026-W25";
const W2 = "2026-W26";
const galileo = "act-galileo";
const tennis = "act-tennis";

describe("computeFriendOverlaps", () => {
  it("returns empty map when there are no user entries", () => {
    expect(computeFriendOverlaps([], [])).toEqual({});
  });

  it("returns empty map when there are no friend planners", () => {
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, week_key: W1 },
    ];
    expect(computeFriendOverlaps(user, [])).toEqual({});
  });

  it("returns empty map when no friend kid is in the same camp the same week", () => {
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, week_key: W1 },
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kids: [{ id: "fk-liam", name: "Liam", color: "#abc" }],
        entries: [
          { child_id: "fk-liam", activity_id: tennis, week_key: W1 }, // diff activity
          { child_id: "fk-liam", activity_id: galileo, week_key: W2 }, // diff week
        ],
      },
    ];
    expect(computeFriendOverlaps(user, friends)).toEqual({});
  });

  it("returns one overlap when one friend-kid matches one user cell", () => {
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, week_key: W1 },
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kids: [{ id: "fk-liam", name: "Liam", color: "#aabbcc" }],
        entries: [{ child_id: "fk-liam", activity_id: galileo, week_key: W1 }],
      },
    ];
    const out = computeFriendOverlaps(user, friends);
    expect(out[overlapKey(jack, W1)]).toEqual([
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kidName: "Liam",
        kidColor: "#aabbcc",
      },
    ]);
  });

  it("stacks multiple friend-kids on the same user cell, sorted by owner then kid", () => {
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, week_key: W1 },
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s2",
        shareToken: "tok2",
        ownerName: "Tess",
        kids: [{ id: "fk-junie", name: "Junie", color: "#111" }],
        entries: [{ child_id: "fk-junie", activity_id: galileo, week_key: W1 }],
      },
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kids: [
          { id: "fk-liam", name: "Liam", color: "#222" },
          { id: "fk-olive", name: "Olive", color: "#333" },
        ],
        entries: [
          { child_id: "fk-liam", activity_id: galileo, week_key: W1 },
          { child_id: "fk-olive", activity_id: galileo, week_key: W1 },
        ],
      },
    ];
    const out = computeFriendOverlaps(user, friends);
    const names = out[overlapKey(jack, W1)].map((o) => `${o.ownerName}/${o.kidName}`);
    // Sarah/Liam, Sarah/Olive, Tess/Junie — alphabetical owner then kid
    expect(names).toEqual(["Sarah/Liam", "Sarah/Olive", "Tess/Junie"]);
  });

  it("matches per-kid per-week independently (different kids' cells stay separate)", () => {
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, week_key: W1 },
      { child_id: teddy, activity_id: galileo, week_key: W2 },
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kids: [{ id: "fk-liam", name: "Liam", color: "#aaa" }],
        entries: [
          { child_id: "fk-liam", activity_id: galileo, week_key: W1 },
          { child_id: "fk-liam", activity_id: galileo, week_key: W2 },
        ],
      },
    ];
    const out = computeFriendOverlaps(user, friends);
    expect(Object.keys(out).sort()).toEqual(
      [overlapKey(jack, W1), overlapKey(teddy, W2)].sort(),
    );
  });

  it("deduplicates when the user has the same activity twice in one cell", () => {
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, week_key: W1 },
      { child_id: jack, activity_id: galileo, week_key: W1 }, // duplicate
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kids: [{ id: "fk-liam", name: "Liam", color: "#aaa" }],
        entries: [{ child_id: "fk-liam", activity_id: galileo, week_key: W1 }],
      },
    ];
    const out = computeFriendOverlaps(user, friends);
    expect(out[overlapKey(jack, W1)].length).toBe(1);
  });

  it("ignores friend entries whose child_id isn't in the kids list", () => {
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, week_key: W1 },
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kids: [], // empty — entry below references an unknown child
        entries: [{ child_id: "fk-ghost", activity_id: galileo, week_key: W1 }],
      },
    ];
    expect(computeFriendOverlaps(user, friends)).toEqual({});
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run tests/lib/overlap.test.ts`
Expected: 8 passes.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: passes (only pre-existing `tests/scraper/llm-extractor.test.ts` errors).

- [ ] **Step 5: Commit**

```bash
git add src/lib/overlap.ts tests/lib/overlap.test.ts
git commit -m "feat(overlap): pure computeFriendOverlaps helper + tests"
```

---

## Task 2: Server-side fetch + overlap pre-computation in `/planner/page.tsx`

**Files:**
- Modify: `src/app/planner/page.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/app/planner/page.tsx` (around the existing imports), add:

```ts
import { fetchSavedShares, fetchSharedPlannerByToken } from "@/lib/queries";
import { computeFriendOverlaps, type FriendPlannerForOverlap, type UserPlannerEntry } from "@/lib/overlap";
import { getWeekKey } from "@/lib/format";
```

`fetchSavedShares` and `fetchSharedPlannerByToken` are already exported from queries.ts (used by /account/planners + /schedule/[token]).

- [ ] **Step 2: Fetch friend payloads in parallel after user data loads**

Insert this block right BEFORE the `return (` of `PlannerPage`, after the existing `ownerDisplayName` line:

```ts
  // Phase 2 overlap: fetch each saved friend's planner payload to compute
  // cell-level matches (same activity, same week as the user's own entries).
  // Pure derivation — no schema involved. Tombstoned saves are skipped
  // (token === null means the share was revoked).
  const savedShares = await fetchSavedShares(user.id);
  const friendPayloads = await Promise.all(
    savedShares
      .filter((s) => !s.isTombstone && s.token)
      .map(async (s) => {
        const result = await fetchSharedPlannerByToken(s.token!);
        if (result.type !== "planner") return null;
        const planner: FriendPlannerForOverlap = {
          shareId: result.shareId,
          shareToken: result.token,
          ownerName: result.ownerDisplayName,
          kids: result.kids.map((k) => ({
            id: k.id,
            name: k.name,
            color: k.color,
          })),
          entries: result.entries.map((e) => ({
            child_id: e.child_id,
            activity_id: e.session.activity.id,
            week_key: getWeekKey(new Date(e.session.starts_at + "T00:00:00")),
          })),
        };
        return planner;
      }),
  );
  const friendPlanners = friendPayloads.filter(
    (p): p is FriendPlannerForOverlap => p !== null,
  );

  // Project the user's own entries down to the minimal shape the matcher
  // needs, then compute the overlap map keyed by `${kidId}::${weekKey}`.
  const userEntriesForOverlap: UserPlannerEntry[] = allEntries.map((e) => ({
    child_id: e.child_id,
    activity_id: e.session.activity.id,
    week_key: getWeekKey(new Date(e.session.starts_at + "T00:00:00")),
  }));
  const overlapMap = computeFriendOverlaps(userEntriesForOverlap, friendPlanners);

  // Pass the saved-shares list to the client as well — the new "Friends'
  // Plans" tab in the rail renders this passively (owner name + kids + remove).
  const friendsForRail = savedShares.map((s) => ({
    savedShareId: s.savedShareId,
    shareId: s.shareId,
    token: s.token,
    isTombstone: s.isTombstone,
    plannerName: s.plannerName ?? s.plannerNameAtSave,
    ownerDisplayName: s.ownerDisplayName,
    kids: friendPlanners
      .find((p) => p.shareId === s.shareId)?.kids ?? [],
  }));
```

- [ ] **Step 3: Add new props to the PlannerClient call**

Append three new props to the `<PlannerClient ...>` element at the bottom of the file:

```tsx
      overlapMap={overlapMap}
      friendsForRail={friendsForRail}
```

(Don't remove or reorder any existing props.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: TypeScript errors in `client.tsx` because `PlannerClient` doesn't accept the new props yet. Those errors are expected and are fixed in Task 3.

- [ ] **Step 5: Commit**

```bash
git add src/app/planner/page.tsx
git commit -m "feat(overlap): fetch friend payloads + compute overlap map server-side"
```

---

## Task 3: Wire new props through `PlannerClient`

**Files:**
- Modify: `src/app/planner/client.tsx` (Props interface + component signature)

- [ ] **Step 1: Add a type import + extend Props**

At the top of `src/app/planner/client.tsx`, add:

```ts
import type { OverlapMap } from "@/lib/overlap";
```

Then locate the existing `interface Props` (search for `interface Props {` — it lives near the existing prop declarations like `kids`, `entries`, etc.). Add to it:

```ts
interface Props {
  // ... existing props unchanged ...
  overlapMap: OverlapMap;
  friendsForRail: {
    savedShareId: string;
    shareId: string;
    token: string | null;
    isTombstone: boolean;
    plannerName: string;
    ownerDisplayName: string | null;
    kids: { id: string; name: string; color: string }[];
  }[];
}
```

- [ ] **Step 2: Destructure the new props in the component signature**

Find the function declaration:

```tsx
export function PlannerClient({ kids, allUserKids, entries, userActivities, blocks, shareCampsDefault, planner, sharesActiveCount, ownerDisplayName, existingShareKidIds, existingShareIncludeCost, existingShareIncludePersonalBlockDetails }: Props) {
```

Append the two new fields at the end:

```tsx
export function PlannerClient({ kids, allUserKids, entries, userActivities, blocks, shareCampsDefault, planner, sharesActiveCount, ownerDisplayName, existingShareKidIds, existingShareIncludeCost, existingShareIncludePersonalBlockDetails, overlapMap, friendsForRail }: Props) {
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: passes. `overlapMap` and `friendsForRail` are now accepted as props but unused — Tasks 5 and 6 wire them up.

- [ ] **Step 4: Commit**

```bash
git add src/app/planner/client.tsx
git commit -m "feat(overlap): accept overlap map + friends list as client props"
```

---

## Task 4: `<OverlapBadgeStack>` component (avatar dots + popover)

**Files:**
- Create: `src/components/planner/overlap-badge-stack.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { FriendOverlap } from "@/lib/overlap";

interface Props {
  overlaps: FriendOverlap[];
}

/** Stack of small avatar dots rendered in the corner of a planner cell to
 *  signal friend-kids enrolled in the same camp the same week. Click the
 *  stack → popover lists each friend with a link to their full shared planner.
 *  Rendered nothing when overlaps is empty (caller is responsible for not
 *  mounting it in that case, but we no-op defensively). */
export function OverlapBadgeStack({ overlaps }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleDoc(e: MouseEvent | TouchEvent) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleDoc);
    document.addEventListener("touchstart", handleDoc);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleDoc);
      document.removeEventListener("touchstart", handleDoc);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  if (overlaps.length === 0) return null;

  return (
    <div ref={rootRef} className="absolute top-1 right-1 z-10">
      <button
        type="button"
        onClick={(e) => {
          // Prevent the click from also firing the cell's onAdd/onEntry handlers.
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={`${overlaps.length} friend ${overlaps.length === 1 ? "kid is" : "kids are"} also here this week`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex -space-x-1.5 cursor-pointer p-0.5"
      >
        {overlaps.slice(0, 3).map((o, idx) => (
          <span
            key={`${o.shareId}-${o.kidName}-${idx}`}
            className="w-4 h-4 rounded-full border border-white ring-1 ring-ink/30 inline-block"
            style={{ background: o.kidColor }}
            aria-hidden
          />
        ))}
        {overlaps.length > 3 && (
          <span
            className="w-4 h-4 rounded-full border border-white ring-1 ring-ink/30 bg-ink text-ink-inverse font-sans text-[8px] font-bold inline-flex items-center justify-center"
            aria-hidden
          >
            +{overlaps.length - 3}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Friends also here this week"
          className="absolute top-full right-0 mt-1 w-56 bg-surface border border-ink rounded-lg shadow-lg p-2 z-20"
        >
          <p className="font-sans text-[10px] uppercase tracking-widest text-ink-2 px-1 pb-1">
            Also here this week
          </p>
          <ul className="space-y-1">
            {overlaps.map((o, idx) => (
              <li
                key={`row-${o.shareId}-${o.kidName}-${idx}`}
                className="flex items-center gap-2 px-1 py-1"
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: o.kidColor }}
                  aria-hidden
                />
                <span className="flex-1 min-w-0">
                  <span className="block font-sans text-sm text-ink font-medium truncate">
                    {o.kidName}
                  </span>
                  <span className="block font-sans text-[11px] text-ink-2 truncate">
                    {o.ownerName ?? "a friend"}&apos;s family
                  </span>
                </span>
                {o.shareToken && (
                  <Link
                    href={`/schedule/${o.shareToken}`}
                    onClick={() => setOpen(false)}
                    className="font-sans text-[10px] uppercase tracking-widest text-ink-2 hover:text-ink underline-offset-2 hover:underline flex-shrink-0"
                  >
                    View
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: passes. Component is unused for now — Task 5 mounts it inside `PlannerCell`.

- [ ] **Step 3: Commit**

```bash
git add src/components/planner/overlap-badge-stack.tsx
git commit -m "feat(overlap): OverlapBadgeStack component with click-popover"
```

---

## Task 5: Render badges in `PlannerCell`

**Files:**
- Modify: `src/components/planner/planner-cell.tsx`

- [ ] **Step 1: Add the import + new optional prop**

At the top of `src/components/planner/planner-cell.tsx`, add:

```ts
import { OverlapBadgeStack } from "./overlap-badge-stack";
import type { FriendOverlap } from "@/lib/overlap";
```

Then locate the existing `interface Props { ... }` block (starts around line 35). Add this new prop at the end of the interface, before the closing brace:

```ts
  /** Friend-kid overlaps to render in the cell's top-right corner. Optional;
   *  callers that don't have overlap data simply omit this. */
  overlaps?: FriendOverlap[];
```

- [ ] **Step 2: Destructure `overlaps` in the component signature**

Find the destructure (search for `export function PlannerCell({`):

```tsx
export function PlannerCell({
  childId,
  weekStart,
  // ... existing
  onAddClick,
}: Props) {
```

Add `overlaps,` right before the closing brace:

```tsx
export function PlannerCell({
  childId,
  weekStart,
  // ... existing
  onAddClick,
  overlaps,
}: Props) {
```

- [ ] **Step 3: Mount the badge stack inside the outer wrapper**

Find the final `return (` of the component. It currently is:

```tsx
  return (
    <div className="relative h-full" data-cell-id={`${childId}-${weekStart}`}>
      <div className={`h-full ${isDraggingActivity ? "opacity-40 pointer-events-none" : ""}`}>{content}</div>
      {isDraggingActivity && (
        // ...drop zones...
      )}
    </div>
  );
```

Add a new conditional render of `<OverlapBadgeStack>` inside the outer `<div>` (it uses `absolute top-1 right-1 z-10` itself, so the outer `relative` already in place is the positioning anchor):

```tsx
  return (
    <div className="relative h-full" data-cell-id={`${childId}-${weekStart}`}>
      <div className={`h-full ${isDraggingActivity ? "opacity-40 pointer-events-none" : ""}`}>{content}</div>
      {overlaps && overlaps.length > 0 && !isDraggingActivity && (
        <OverlapBadgeStack overlaps={overlaps} />
      )}
      {isDraggingActivity && (
        // ...drop zones... (unchanged)
      )}
    </div>
  );
```

The `!isDraggingActivity` guard hides the badge stack during drag (it's noisy + competes with the drop affordance).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/planner/planner-cell.tsx
git commit -m "feat(overlap): render OverlapBadgeStack in PlannerCell when overlaps present"
```

---

## Task 6: Pass overlap data from `PlannerClient` down to each `PlannerCell`

**Files:**
- Modify: `src/app/planner/client.tsx`

- [ ] **Step 1: Add import**

At the top of `src/app/planner/client.tsx`, add (next to the other `@/lib/overlap` import if Task 3 left one):

```ts
import { overlapKey } from "@/lib/overlap";
```

(Task 3 already added `import type { OverlapMap } from "@/lib/overlap";` — keep both.)

- [ ] **Step 2: Look up the cell's overlaps in the weeks-building loop**

Find the `weeks` calculation (search for `const weeks: WeekRow[] = weekStarts.map(`). The inner `cells = kids.map((kid) => {` loop computes `timelineEntries`, `legendRows`, and `consideringChips`. Right before the `return { childId: kid.id, timelineEntries, legendRows, consideringChips };` line, add:

```ts
      const overlapsForCell = overlapMap[overlapKey(kid.id, weekKey)] ?? null;
```

And update the returned object to include it:

```ts
      return { childId: kid.id, timelineEntries, legendRows, consideringChips, overlaps: overlapsForCell };
```

- [ ] **Step 3: Extend the `WeekRow` cell shape** (if necessary)

Search for the `WeekRow` type definition in `client.tsx`. Locate the `cells: { ... }[]` array shape. Add `overlaps`:

```ts
type WeekRow = {
  // ... existing
  cells: {
    childId: string;
    timelineEntries: ...;
    legendRows: ...;
    consideringChips: ...;
    overlaps: import("@/lib/overlap").FriendOverlap[] | null;
  }[];
  // ... rest unchanged
};
```

(If `WeekRow` is declared with an interface or extended differently, adapt — the key addition is the `overlaps` field on each cell.)

- [ ] **Step 4: Pass `overlaps` to each `<PlannerCell>` render**

Find every place `<PlannerCell` is rendered (there's typically one in the desktop grid and one in the mobile/responsive variant — verify with `grep -n "<PlannerCell" src/app/planner/client.tsx`). For each render, add the new prop:

```tsx
<PlannerCell
  // ... existing props
  overlaps={cell.overlaps ?? undefined}
/>
```

- [ ] **Step 5: Type-check + visual smoke**

Run: `npx tsc --noEmit`
Expected: passes.

Then run dev server (`npm run dev`) only if you want to visually verify locally. Required check: when there are no friend planners saved, no badges render anywhere (the map is empty so the lookup returns `null` for every cell).

- [ ] **Step 6: Commit**

```bash
git add src/app/planner/client.tsx
git commit -m "feat(overlap): wire overlap data from client through to PlannerCell"
```

---

## Task 7: `<FriendsPlansPanel>` — passive context panel for the rail's second tab

**Files:**
- Create: `src/components/planner/friends-plans-panel.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { unsaveSharedPlanner } from "@/lib/actions";

export interface FriendForRail {
  savedShareId: string;
  shareId: string;
  /** Null when the share was revoked (tombstone). */
  token: string | null;
  isTombstone: boolean;
  plannerName: string;
  ownerDisplayName: string | null;
  kids: { id: string; name: string; color: string }[];
}

interface Props {
  friends: FriendForRail[];
  onRemoved?: (shareId: string) => void;
}

export function FriendsPlansPanel({ friends, onRemoved }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  function handleRemove(shareId: string) {
    startTransition(async () => {
      const r = await unsaveSharedPlanner(shareId);
      if (r.error) {
        toast(r.error, "error");
        return;
      }
      onRemoved?.(shareId);
      toast("Removed from your planners.", "success");
      router.refresh();
    });
  }

  if (friends.length === 0) {
    return (
      <p className="font-sans text-sm text-ink-2 italic leading-relaxed">
        Save a friend&apos;s shared planner to see overlaps with your own
        planner. Open a shared link they sent you and tap &ldquo;+ Save to my
        planners.&rdquo;
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {friends.map((f) => (
        <div
          key={f.savedShareId}
          className="rounded-lg border border-ink-3 bg-surface p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {f.isTombstone || !f.token ? (
                <p className="font-display font-extrabold text-sm text-ink-2 line-through truncate">
                  {f.plannerName}
                </p>
              ) : (
                <Link
                  href={`/schedule/${f.token}`}
                  className="block font-display font-extrabold text-sm text-ink hover:underline truncate"
                >
                  {f.plannerName}
                </Link>
              )}
              <p className="font-sans text-[11px] text-ink-2 mt-0.5">
                Shared by{" "}
                <span className="font-semibold text-ink">
                  {f.ownerDisplayName ?? "a friend"}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleRemove(f.shareId)}
              className="font-sans font-bold text-[10px] uppercase tracking-widest text-ink-2 hover:text-ink flex-shrink-0"
              aria-label={`Remove ${f.plannerName}`}
            >
              Remove
            </button>
          </div>
          {f.kids.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {f.kids.map((k) => (
                <span
                  key={k.id}
                  className="inline-flex items-center gap-1 font-sans text-[11px] text-ink bg-base px-1.5 py-0.5 rounded-full"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: k.color }}
                    aria-hidden
                  />
                  {k.name}
                </span>
              ))}
            </div>
          )}
          {f.isTombstone && (
            <p className="font-sans text-[11px] text-ink-2 italic mt-2">
              This planner is no longer being shared.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: passes. Component unused for now — Task 8 mounts it in a tabbed container.

- [ ] **Step 3: Commit**

```bash
git add src/components/planner/friends-plans-panel.tsx
git commit -m "feat(overlap): FriendsPlansPanel for second tab in left rail"
```

---

## Task 8: Extract `<MyActivitiesContent>` from `MyActivitiesRail` (refactor only)

This is a refactor — no behavior change. We split the rail's inner content (the railContent block) out into a small component so Task 9's tabbed container can host it without duplicating the `<aside>` chrome or mobile sheet.

**Files:**
- Create: `src/components/planner/my-activities-content.tsx`
- Modify: `src/components/planner/my-activities-rail.tsx`

- [ ] **Step 1: Create `src/components/planner/my-activities-content.tsx`**

Cut the `railContent` block + the `DraggableActivityItem` / `pendingRemove` state out of `my-activities-rail.tsx` into a new component. This becomes the shared inner content for both the standalone `MyActivitiesRail` and the new tabbed `PlannerRail`.

```tsx
"use client";

import { useState, useTransition } from "react";
import { useDraggable } from "@dnd-kit/core";
import { removeActivityFromShortlist } from "@/lib/actions";
import type { UserActivityWithDetails } from "@/lib/queries";

interface Props {
  activities: UserActivityWithDetails[];
  onChipClick: (activity: UserActivityWithDetails) => void;
  onAddClick: () => void;
  onChanged?: () => void;
}

/** Inner content of the My Activities rail — the heading, "+ Add activity"
 *  button, and the list of draggable activity chips. Owns the
 *  remove-confirmation modal locally because the modal only ever appears
 *  in response to a chip-level Remove tap. Wrapped by:
 *  - `<MyActivitiesRail>` for the standalone desktop <aside> + mobile sheet
 *  - `<PlannerRail>` for the tabbed-in-a-panel use */
export function MyActivitiesContent({
  activities,
  onChipClick,
  onAddClick,
  onChanged,
}: Props) {
  const [pendingRemove, setPendingRemove] = useState<{
    userCampId: string;
    name: string;
    entryCount: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmRemove() {
    if (!pendingRemove) return;
    startTransition(async () => {
      const result = await removeActivityFromShortlist(pendingRemove.userCampId);
      if (result.error) {
        alert(result.error);
        return;
      }
      setPendingRemove(null);
      onChanged?.();
    });
  }

  return (
    <>
      <h2 className="font-display font-extrabold text-lg text-ink tracking-tight mb-3 flex-shrink-0">My activities</h2>

      <button
        onClick={onAddClick}
        className="w-full mb-3 rounded-lg border border-dashed border-ink-3 text-ink-2 hover:border-ink hover:text-ink transition-colors font-sans text-[11px] uppercase tracking-wide py-2 flex-shrink-0"
      >
        + Add activity
      </button>

      <div className="space-y-2">
        {activities.length === 0 && (
          <p className="text-sm text-ink-3 italic">Nothing yet — add one above.</p>
        )}
        {activities.map((c) => (
          <DraggableActivityItem
            key={c.id}
            activity={c}
            onClick={() => onChipClick(c)}
            onRemoveClick={() =>
              setPendingRemove({
                userCampId: c.id,
                name: c.activity.name,
                entryCount: c.plannerEntryCount,
              })
            }
          />
        ))}
      </div>

      {pendingRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-ink/40 cursor-pointer" onClick={() => setPendingRemove(null)} />
          <div className="relative bg-surface rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-display font-extrabold text-xl text-ink mb-2">Remove {pendingRemove.name}?</h3>
            <p className="text-sm text-ink-2 mb-4 leading-relaxed">
              {pendingRemove.entryCount > 0 ? (
                <>
                  This will remove {pendingRemove.name} from your My Activities list AND delete{" "}
                  <strong>{pendingRemove.entryCount}</strong> planner entr
                  {pendingRemove.entryCount === 1 ? "y" : "ies"} across your weeks.
                  This cannot be undone.
                </>
              ) : (
                <>This will remove {pendingRemove.name} from your My Activities list.</>
              )}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setPendingRemove(null)}
                className="font-sans text-[11px] uppercase tracking-widest px-3 py-1.5 text-ink-2 hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemove}
                disabled={isPending}
                className="font-sans text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full bg-ink text-ink-inverse hover:bg-ink disabled:opacity-50"
              >
                {isPending ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Copy DraggableActivityItem verbatim from my-activities-rail.tsx — it's the
// chip + drag handle component currently defined at the bottom of that file.
// (Don't re-declare it here in this plan snippet; paste the existing function
// body from my-activities-rail.tsx.)
```

**Important:** the `DraggableActivityItem` function currently lives at the bottom of `my-activities-rail.tsx` (search for `function DraggableActivityItem(`). Copy it verbatim into this new file (or move it — your call; the cleanest is to move it so there's a single definition).

- [ ] **Step 2: Slim down `my-activities-rail.tsx` to use `MyActivitiesContent`**

In `src/components/planner/my-activities-rail.tsx`:

1. Remove the `useState`/`useTransition` for `pendingRemove` (now lives in `MyActivitiesContent`).
2. Remove the `confirmRemove` function (now lives in `MyActivitiesContent`).
3. Remove the `railContent` block construction.
4. Remove the `pendingRemove` modal at the bottom of the JSX.
5. Remove the `DraggableActivityItem` definition (now in `my-activities-content.tsx`).
6. Replace the desktop `<aside>` body with `<MyActivitiesContent ... />`.
7. Replace the mobile sheet body's `{mobileContent}` similarly — the mobile sheet's "Tap an activity to place it on a week" copy + the `TapToPlaceActivityItem` chips can either stay inline OR move to a separate `<MyActivitiesMobileContent>`. For V1, keep them inline in `my-activities-rail.tsx` since the mobile content is structurally different (tap-to-place vs drag-and-drop).

Resulting `my-activities-rail.tsx` should be substantially smaller (~150 lines down from ~370). Final outline:

```tsx
"use client";

import { useEffect } from "react";
import { MyActivitiesContent } from "./my-activities-content";
import type { UserActivityWithDetails } from "@/lib/queries";

interface Props {
  activities: UserActivityWithDetails[];
  onChipClick: (activity: UserActivityWithDetails) => void;
  onAddClick: () => void;
  onChanged?: () => void;
  onActivityPlacementTap?: (activity: UserActivityWithDetails) => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export function MyActivitiesRail({
  activities,
  onChipClick,
  onAddClick,
  onChanged,
  onActivityPlacementTap,
  mobileOpen = false,
  onMobileOpenChange,
}: Props) {
  useEffect(() => {
    if (!mobileOpen) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onMobileOpenChange?.(false);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mobileOpen, onMobileOpenChange]);

  return (
    <>
      {/* Desktop: inline side rail */}
      <aside className="hidden md:flex md:flex-col w-80 shrink-0 md:h-full md:overflow-y-auto bg-[#dfecf5] md:border-r md:border-ink px-6 sm:px-8 lg:px-10 pt-[22px] pb-4">
        <MyActivitiesContent
          activities={activities}
          onChipClick={onChipClick}
          onAddClick={onAddClick}
          onChanged={onChanged}
        />
      </aside>

      {/* Mobile bottom sheet — keep tap-to-place inline content as before */}
      <div className="md:hidden">
        {/* ...unchanged mobile sheet markup: backdrop, collapsed pill,
            sheet with mobileContent (TapToPlaceActivityItem chips)... */}
      </div>
    </>
  );
}

// Keep TapToPlaceActivityItem inline at the bottom of this file.
```

- [ ] **Step 3: Type-check + smoke**

Run: `npx tsc --noEmit`
Expected: passes.

Manual: `npm run dev` → visit `/planner`. The rail should look and behave identically (no visible change yet — Task 9 introduces the tabs).

- [ ] **Step 4: Commit**

```bash
git add src/components/planner/my-activities-content.tsx src/components/planner/my-activities-rail.tsx
git commit -m "refactor(planner): extract MyActivitiesContent from MyActivitiesRail"
```

---

## Task 9: `<PlannerRail>` tabbed container + integrate into `PlannerClient`

**Files:**
- Create: `src/components/planner/planner-rail.tsx`
- Modify: `src/app/planner/client.tsx`

- [ ] **Step 1: Create `src/components/planner/planner-rail.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { MyActivitiesContent } from "./my-activities-content";
import { MyActivitiesRail } from "./my-activities-rail";
import { FriendsPlansPanel, type FriendForRail } from "./friends-plans-panel";
import type { UserActivityWithDetails } from "@/lib/queries";

type TabKey = "activities" | "friends";

interface Props {
  // MyActivitiesRail props (desktop chrome + mobile sheet)
  activities: UserActivityWithDetails[];
  onChipClick: (activity: UserActivityWithDetails) => void;
  onAddClick: () => void;
  onChanged?: () => void;
  onActivityPlacementTap?: (activity: UserActivityWithDetails) => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  // Friends panel props
  friends: FriendForRail[];
  onFriendRemoved?: (shareId: string) => void;
}

export function PlannerRail(props: Props) {
  const [tab, setTab] = useState<TabKey>("activities");

  return (
    <>
      {/* Desktop: tabbed rail. Renders OUR own <aside> (matches the visual
          of MyActivitiesRail's desktop chrome but adds tabs). */}
      <aside className="hidden md:flex md:flex-col w-80 shrink-0 md:h-full md:overflow-y-auto bg-[#dfecf5] md:border-r md:border-ink px-6 sm:px-8 lg:px-10 pt-[22px] pb-4">
        <div
          role="tablist"
          aria-label="Planner sidebar"
          className="flex gap-1 mb-3 flex-shrink-0"
        >
          <button
            role="tab"
            type="button"
            aria-selected={tab === "activities"}
            aria-controls="panel-activities"
            onClick={() => setTab("activities")}
            className={`flex-1 font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-2 rounded-full border ${
              tab === "activities"
                ? "bg-ink text-ink-inverse border-ink"
                : "bg-transparent text-ink border-ink-3"
            }`}
          >
            My activities
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={tab === "friends"}
            aria-controls="panel-friends"
            onClick={() => setTab("friends")}
            className={`flex-1 font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-2 rounded-full border ${
              tab === "friends"
                ? "bg-ink text-ink-inverse border-ink"
                : "bg-transparent text-ink border-ink-3"
            }`}
          >
            Friends&apos; plans
            {props.friends.length > 0 ? ` (${props.friends.length})` : null}
          </button>
        </div>

        {tab === "activities" ? (
          <div role="tabpanel" id="panel-activities">
            <MyActivitiesContent
              activities={props.activities}
              onChipClick={props.onChipClick}
              onAddClick={props.onAddClick}
              onChanged={props.onChanged}
            />
          </div>
        ) : (
          <div role="tabpanel" id="panel-friends">
            <FriendsPlansPanel
              friends={props.friends}
              onRemoved={props.onFriendRemoved}
            />
          </div>
        )}
      </aside>

      {/* Mobile: reuse MyActivitiesRail's bottom-sheet path verbatim.
          Friends'-plans tab on mobile is intentionally out of scope for V1.
          MyActivitiesRail's own desktop <aside> is hidden md:flex — that
          would conflict with our desktop <aside> above. To prevent the
          double-aside, we render MyActivitiesRail only on mobile via a
          wrapping md:hidden container. */}
      <div className="md:hidden contents">
        <MyActivitiesRail
          activities={props.activities}
          onChipClick={props.onChipClick}
          onAddClick={props.onAddClick}
          onChanged={props.onChanged}
          onActivityPlacementTap={props.onActivityPlacementTap}
          mobileOpen={props.mobileOpen}
          onMobileOpenChange={props.onMobileOpenChange}
        />
      </div>
    </>
  );
}
```

**Note on the mobile wrapper:** the existing `MyActivitiesRail` desktop `<aside>` uses `hidden md:flex` — meaning it ALSO renders on desktop. To prevent two desktop `<aside>`s, the wrapper `<div className="md:hidden contents">` would attempt to hide it at md+, but `contents` makes the wrapper invisible to layout. Since this approach is brittle, prefer the cleaner alternative:

**Alternative for Step 1 (recommended):** instead of nesting `MyActivitiesRail` inside a wrapper, in `PlannerRail` directly render the mobile sheet inline (copy the mobile sheet markup from `MyActivitiesRail` for clarity). This means `PlannerRail` owns both desktop and mobile UI, and `MyActivitiesRail` becomes legacy — used only if any other caller still imports it. (Audit with `grep -n "MyActivitiesRail" src/` — the only caller is `client.tsx`, which we're updating in Step 2.)

So a cleaner Step 1 closing block:

```tsx
      {/* Mobile bottom sheet — inline (V1 friend-plans tab on mobile is OOS). */}
      {/* Copy the existing mobile sheet markup from MyActivitiesRail verbatim
          here, replacing {mobileContent} with: */}
      {/*   <div className="px-5 ...">                                       */}
      {/*     <button onAddClick.../>                                         */}
      {/*     {props.activities.map(...) → TapToPlaceActivityItem...}        */}
      {/*   </div>                                                           */}
```

If the inline copy makes `PlannerRail` too large (~250 lines), the right move is to also extract a `<MyActivitiesMobileSheet>` component in Task 8 (a small addition to that task). For the plan, you have latitude: either approach works as long as the final result has exactly one desktop `<aside>` and one mobile sheet on `/planner`. Take whichever the codebase's existing patterns favor.

- [ ] **Step 2: Replace `<MyActivitiesRail>` with `<PlannerRail>` in `client.tsx`**

In `src/app/planner/client.tsx`, find the `<MyActivitiesRail` render (around line 574) and replace with:

```tsx
          <PlannerRail
            activities={userActivities}
            onChipClick={(c) => setQuickViewActivityId(c.id)}
            onAddClick={() => setEntryModal({ childId: null, weekStart: null, tab: "activity" })}
            onChanged={() => router.refresh()}
            onActivityPlacementTap={handleActivityPlacementTap}
            mobileOpen={mobileActivitiesOpen}
            onMobileOpenChange={setMobileActivitiesOpen}
            friends={friendsForRail}
            onFriendRemoved={() => {
              // The friends list comes from server props (friendsForRail).
              // FriendsPlansPanel calls router.refresh() after a successful
              // unsave, so the next render will reflect the removal.
              // Optimistic local removal would smooth the transition — see
              // /account/planners/client.tsx for the pattern. Skipping for V1.
            }}
          />
```

Add the import next to the existing rail import:

```ts
import { PlannerRail } from "@/components/planner/planner-rail";
```

(Remove the existing `import { MyActivitiesRail } ...` line — it's no longer used directly.)

- [ ] **Step 3: Type-check + manual verify**

Run: `npx tsc --noEmit`
Expected: passes.

Manual:
1. `npm run dev`.
2. Visit `/planner` while logged in. Assert: rail shows "My activities | Friends' plans" tabs at top.
3. With zero saved friends → Friends' plans tab shows the empty-state copy from `FriendsPlansPanel`.
4. Save a friend's share (via /schedule/[token] → "+ Save to my planners"), return to `/planner` → friend appears in the tab + any overlapping cells now show avatar dots.
5. Click an avatar → popover shows friend-kid names + "View" links.
6. Click outside popover → it closes.
7. Click Remove on a friend card → card disappears + planner cells lose any badges from that friend after server refresh.

- [ ] **Step 4: Commit**

```bash
git add src/components/planner/planner-rail.tsx src/app/planner/client.tsx
git commit -m "feat(overlap): PlannerRail tabbed container with Friends' Plans tab"
```

---

## Task 10: Final integration check + PR

**Files:**
- None modified (verification only)

- [ ] **Step 1: Full type-check + test suite**

Run:

```bash
npx tsc --noEmit
npx vitest run
```

Expected:
- `tsc`: only the two pre-existing `tests/scraper/llm-extractor.test.ts` errors.
- `vitest`: 271 (baseline) + 8 (new overlap tests) = 279 passing, 0 failures.

- [ ] **Step 2: End-to-end manual flow**

With at least one saved friend share that overlaps your own planner:

1. `/planner` → desktop: rail shows "My activities | Friends' plans (N)" tabs.
2. Switch to Friends' plans tab → see saved-planner cards with owner name + kid pills + Remove button.
3. Switch back → My activities renders normally (no regression).
4. Cell with overlap → 1–3 avatar dots in top-right corner.
5. Click avatar → popover with friend-kid names + ownership context + "View" link.
6. Click "View" → routes to `/schedule/<token>` (shared planner viewer).
7. Back to /planner → click outside popover → popover closes.
8. Remove a friend → card vanishes, planner cells from that friend stop showing.

- [ ] **Step 3: Open PR**

```bash
git push -u origin <branch-name>
gh pr create --title "feat(overlap): Friends' plans tab + cell-level overlap avatars" --body "$(cat <<'EOF'
## Summary

Phase 2 of the friend-coordination feature. When you view your own planner, any cell where one of your kids is enrolled in the same camp the same week as a saved-friend's kid now shows 1–3 small avatar dots in the corner. Tap → popover lists each friend with a link to their full planner.

Adds a second tab "Friends' plans" to the left rail on `/planner` (desktop), showing a passive list of saved-planner sources with owner name + kid pills + Remove button.

## Architecture

- No schema, no new RPCs — uses the existing `get_shared_planner_by_token` resolver to fetch each saved-friend's planner payload server-side, then `computeFriendOverlaps()` derives a `<kidId>::<weekKey>` → friends[] map. Pure functional; fully unit-tested.
- Match definition: same `activity_id` + same week-start (Monday) date.
- Badges only render in cells where YOUR kid also has an entry — discovery in your empty weeks is intentionally deferred to a later phase.

## V1 scope decisions captured in the plan

- No per-friend filter UI (auto-on for all saved friends)
- Desktop tab UI only; mobile bottom sheet still shows only "My Activities"
- No new schema; no propagation work needed (owner name is JOIN-live)

## Test plan

[Bulleted checklist matches Task 9 Step 2 above]

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out of scope (intentional, do not build)

- **Discovery in empty cells** — ghost rendering of friend stuff in weeks where YOUR kid has nothing. Punted: low-risk, easy to add later, would expand V1 UX scope.
- **Per-friend toggle UI** — passive list only. Users with too much noise can unsave shares from the same tab.
- **Mobile rail tab** — mobile bottom sheet stays single-purpose ("My Activities"). Adding a tab toggle to the bottom sheet is a separate small task.
- **Save-share-count surfacing on friends tab** — the count we ship via `get_save_counts_for_share_owner` is for the OWNER to see on /account/planners, not for displaying inside the rail panel.
- **Cross-page overlap** — overlap rendering is only on `/planner`. The catalog page does not show "N friends did this camp" — that's a future Phase 3 thread.
