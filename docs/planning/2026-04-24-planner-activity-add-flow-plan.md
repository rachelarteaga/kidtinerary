# Planner +Add flow redesign & camp → activity rename — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [2026-04-24-planner-activity-add-flow.md](./2026-04-24-planner-activity-add-flow.md)

**Goal:** Add a My Activities picker to the cell-scoped `+Add` modal, then rename `camp` → `activity` at the UI/code layer while keeping the DB schema untouched.

**Architecture:** A new presentational `ActivityPickerSection` composes into `AddCampModal` via an `embeddedPicker` slot. `AddEntryModal` passes the picker only when `scope.childId && scope.weekStart` are both set. The rename is sequenced as one commit per logical layer so each commit compiles and tests pass before moving on.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, vitest + @testing-library/react, Supabase server actions, @dnd-kit.

---

## File Structure

**Milestone A — feature:**
- Create `src/components/planner/activity-picker-section.tsx` — presentational list, tap handler, empty-state guard
- Create `tests/components/planner/activity-picker-section.test.tsx` — unit tests
- Modify `src/components/planner/add-camp-modal.tsx` — add `embeddedPicker?: React.ReactNode` slot, render above form
- Modify `src/components/planner/add-entry-modal.tsx` — accept `userCamps` prop, wire picker into `AddCampModal` for cell-scoped invocations only
- Modify `src/app/planner/client.tsx` — pass `userCamps` + `onActivityPick` callback to `AddEntryModal`; callback calls `assignCampToWeek` and closes modal

**Milestone B — rename (camp → activity):** renames are enumerated per task below. DB schema (`user_camps` table, `user_camp_id` columns) stays.

---

## Milestone A: +Add flow redesign

### Task A1: Create `ActivityPickerSection` component (TDD)

**Files:**
- Create: `src/components/planner/activity-picker-section.tsx`
- Create: `tests/components/planner/activity-picker-section.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/components/planner/activity-picker-section.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActivityPickerSection } from "@/components/planner/activity-picker-section";
import type { UserCampWithActivity } from "@/lib/queries";

function makeActivity(overrides: Partial<UserCampWithActivity> = {}): UserCampWithActivity {
  return {
    id: "uc-1",
    color: "#f4b76f",
    plannerEntryCount: 0,
    activity: {
      id: "act-1",
      name: "Camp Kanata",
      verified: false,
      organization: { id: "org-1", name: "YMCA of the Triangle" },
    },
    ...overrides,
  } as UserCampWithActivity;
}

describe("ActivityPickerSection", () => {
  it("renders nothing when the list is empty", () => {
    const { container } = render(
      <ActivityPickerSection activities={[]} onPick={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a section header when activities exist", () => {
    render(
      <ActivityPickerSection activities={[makeActivity()]} onPick={() => {}} />
    );
    expect(screen.getByText(/from my activities/i)).toBeInTheDocument();
  });

  it("renders one row per activity with name and org", () => {
    render(
      <ActivityPickerSection
        activities={[
          makeActivity(),
          makeActivity({
            id: "uc-2",
            activity: {
              id: "act-2",
              name: "Robotics",
              verified: true,
              organization: { id: "org-2", name: "Blue Ridge School" },
            },
          }),
        ]}
        onPick={() => {}}
      />
    );
    expect(screen.getByText("Camp Kanata")).toBeInTheDocument();
    expect(screen.getByText("YMCA of the Triangle")).toBeInTheDocument();
    expect(screen.getByText("Robotics")).toBeInTheDocument();
    expect(screen.getByText("Blue Ridge School")).toBeInTheDocument();
  });

  it("hides org when it matches the activity name or equals 'User-submitted'", () => {
    render(
      <ActivityPickerSection
        activities={[
          makeActivity({
            activity: {
              id: "act-a",
              name: "Match",
              verified: false,
              organization: { id: "o-a", name: "Match" },
            },
          }),
          makeActivity({
            id: "uc-b",
            activity: {
              id: "act-b",
              name: "Hidden",
              verified: false,
              organization: { id: "o-b", name: "User-submitted" },
            },
          }),
        ]}
        onPick={() => {}}
      />
    );
    expect(screen.queryByText(/user-submitted/i)).toBeNull();
    // "Match" appears once (as the name), not twice.
    expect(screen.getAllByText("Match")).toHaveLength(1);
  });

  it("calls onPick with the userCampId when a row is tapped", () => {
    const onPick = vi.fn();
    render(
      <ActivityPickerSection
        activities={[makeActivity({ id: "uc-42" })]}
        onPick={onPick}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /camp kanata/i }));
    expect(onPick).toHaveBeenCalledWith("uc-42");
  });

  it("shows verified badge and placement count when present", () => {
    render(
      <ActivityPickerSection
        activities={[
          makeActivity({
            plannerEntryCount: 3,
            activity: {
              id: "act-v",
              name: "Verified Camp",
              verified: true,
              organization: { id: "o-v", name: "Some Org" },
            },
          }),
        ]}
        onPick={() => {}}
      />
    );
    expect(screen.getByText("3x")).toBeInTheDocument();
    expect(screen.getByText(/verified/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run activity-picker-section`
Expected: FAIL with "Cannot find module '@/components/planner/activity-picker-section'"

- [ ] **Step 3: Implement `ActivityPickerSection`**

Create `src/components/planner/activity-picker-section.tsx`:

```tsx
"use client";

import type { UserCampWithActivity } from "@/lib/queries";

interface Props {
  activities: UserCampWithActivity[];
  onPick: (userCampId: string) => void;
}

export function ActivityPickerSection({ activities, onPick }: Props) {
  if (activities.length === 0) return null;

  return (
    <div className="mb-4">
      <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">
        From my activities
      </h3>
      <div
        className="space-y-2 overflow-y-auto pr-1"
        style={{ maxHeight: 240 }}
      >
        {activities.map((a) => {
          const orgName = a.activity.organization?.name ?? null;
          const showOrg =
            !!orgName && orgName !== a.activity.name && orgName !== "User-submitted";
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onPick(a.id)}
              className="w-full text-left rounded-lg border border-ink-3 bg-white p-2.5 hover:border-ink transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-1.5">
                <span
                  className="w-2 h-2 mt-1.5 rounded-full flex-shrink-0"
                  style={{ background: a.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-ink break-words">
                    {a.activity.name}
                  </div>
                  {showOrg && (
                    <div className="mt-0.5 font-sans text-[11px] text-ink-2 break-words">
                      {orgName}
                    </div>
                  )}
                  <div className="mt-1 flex items-center gap-2 font-sans text-[10px] uppercase tracking-wide text-ink-2">
                    {a.plannerEntryCount > 0 && <span>{a.plannerEntryCount}x</span>}
                    {a.activity.verified && (
                      <span className="text-[#5fc39c]">verified</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run activity-picker-section`
Expected: PASS, 6/6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/planner/activity-picker-section.tsx tests/components/planner/activity-picker-section.test.tsx
git commit -m "feat(planner): add ActivityPickerSection component for cell-scoped +Add modal"
```

---

### Task A2: Add `embeddedPicker` slot to `AddCampModal`

**Files:**
- Modify: `src/components/planner/add-camp-modal.tsx:18-31` (Props interface), `src/components/planner/add-camp-modal.tsx:128-133` (body JSX head)

- [ ] **Step 1: Add the `embeddedPicker` prop to Props**

In `src/components/planner/add-camp-modal.tsx`, modify the `Props` interface (currently lines 18-31):

```tsx
interface Props {
  open: boolean;
  onClose: () => void;
  plannerId: string;
  scope: { childId: string | null; weekStart: string | null };
  shareCampsDefault: boolean;
  onSubmitted: (result: {
    jobId?: string;
    userCampId?: string;
    plannerEntryId?: string | null;
    url?: string;
  }) => void;
  embedded?: boolean;
  /** Optional node rendered above the form body (used for the
   * "From my activities" picker in cell-scoped flows). */
  embeddedPicker?: React.ReactNode;
}
```

And update the destructure (currently line 33):

```tsx
export function AddCampModal({
  open,
  onClose,
  plannerId,
  scope,
  shareCampsDefault,
  onSubmitted,
  embedded = false,
  embeddedPicker,
}: Props) {
```

- [ ] **Step 2: Render the picker inside the body**

Modify the `body` JSX. Currently the body starts:

```tsx
const body = (
  <>
    <h2 className="font-display font-extrabold text-2xl mb-1">Add a camp</h2>
    <p className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-4">
      Drop a URL and we&apos;ll fill in the rest — or type it in manually
    </p>

    <form onSubmit={handleSubmit} className="space-y-4">
```

Insert the picker + divider between the tagline and the form:

```tsx
const body = (
  <>
    <h2 className="font-display font-extrabold text-2xl mb-1">Add a camp</h2>
    <p className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-4">
      Drop a URL and we&apos;ll fill in the rest — or type it in manually
    </p>

    {embeddedPicker}

    {embeddedPicker && (
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 border-t border-ink-3" />
        <span className="font-sans text-[10px] uppercase tracking-widest text-ink-2">
          OR ADD NEW
        </span>
        <div className="flex-1 border-t border-ink-3" />
      </div>
    )}

    <form onSubmit={handleSubmit} className="space-y-4">
```

- [ ] **Step 3: Type-check**

Run: `npm run lint && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Run existing tests**

Run: `npm test`
Expected: all previously-passing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/planner/add-camp-modal.tsx
git commit -m "feat(planner): add embeddedPicker slot to AddCampModal"
```

---

### Task A3: Wire picker into `AddEntryModal` for cell-scoped flows

**Files:**
- Modify: `src/components/planner/add-entry-modal.tsx` (entire file)

- [ ] **Step 1: Update Props and inner component**

Replace the full contents of `src/components/planner/add-entry-modal.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { AddCampModal } from "./add-camp-modal";
import { AddBlockModal } from "./add-block-modal";
import { ActivityPickerSection } from "./activity-picker-section";
import type { UserCampWithActivity } from "@/lib/queries";

interface ChildLite {
  id: string;
  name: string;
  color: string;
  avatar_url: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  plannerId: string;
  scope: { childId: string | null; weekStart: string | null };
  shareCampsDefault: boolean;
  kids: ChildLite[];
  userCamps: UserCampWithActivity[];
  initialTab?: "camp" | "block";
  onCampSubmitted: (result: {
    jobId?: string;
    userCampId?: string;
    plannerEntryId?: string | null;
    url?: string;
  }) => void;
  onBlockSubmitted: () => void;
  /** Invoked when a user taps a row in the picker. The parent handles the
   * actual placement action (assignCampToWeek) and closes the modal. Called
   * only when both childId and weekStart are set in scope. */
  onActivityPick: (userCampId: string) => void;
}

export function AddEntryModal(props: Props) {
  if (!props.open) return null;
  return <AddEntryModalInner key={`${props.initialTab ?? "camp"}`} {...props} />;
}

function AddEntryModalInner({
  onClose,
  plannerId,
  scope,
  shareCampsDefault,
  kids,
  userCamps,
  initialTab = "camp",
  onCampSubmitted,
  onBlockSubmitted,
  onActivityPick,
}: Props) {
  const [tab, setTab] = useState<"camp" | "block">(initialTab);

  const cellScoped = scope.childId !== null && scope.weekStart !== null;
  const picker = cellScoped && tab === "camp" ? (
    <ActivityPickerSection activities={userCamps} onPick={onActivityPick} />
  ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-ink/40 cursor-pointer" onClick={onClose} />
      <div className="relative bg-base rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex rounded-full border border-ink-3 bg-surface overflow-hidden">
            <button
              onClick={() => setTab("camp")}
              className={`font-sans text-[11px] uppercase tracking-widest px-3 py-1.5 transition-colors ${
                tab === "camp" ? "bg-ink text-ink-inverse" : "text-ink-2 hover:text-ink"
              }`}
            >
              Camp
            </button>
            <button
              onClick={() => setTab("block")}
              className={`font-sans text-[11px] uppercase tracking-widest px-3 py-1.5 transition-colors ${
                tab === "block" ? "bg-ink text-ink-inverse" : "text-ink-2 hover:text-ink"
              }`}
            >
              Block
            </button>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-2 hover:text-ink text-lg">✕</button>
        </div>

        {tab === "camp" ? (
          <AddCampModal
            open={true}
            embedded={true}
            onClose={onClose}
            plannerId={plannerId}
            scope={scope}
            shareCampsDefault={shareCampsDefault}
            onSubmitted={onCampSubmitted}
            embeddedPicker={picker}
          />
        ) : (
          <AddBlockModal
            open={true}
            embedded={true}
            onClose={onClose}
            plannerId={plannerId}
            // eslint-disable-next-line react/no-children-prop
            children={kids}
            scope={scope}
            onSubmitted={onBlockSubmitted}
          />
        )}
      </div>
    </div>
  );
}
```

Note: tab labels (`Camp` / `Block`) stay untouched — they get updated during Milestone B.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: errors at the call site in `src/app/planner/client.tsx` (missing new props `userCamps` and `onActivityPick`) — that's the next task.

- [ ] **Step 3: Commit** (do NOT commit yet — the tree doesn't compile)

Skip commit; combined with Task A4 into one commit since the two changes are coupled.

---

### Task A4: Pass `userCamps` + `onActivityPick` from planner client

**Files:**
- Modify: `src/app/planner/client.tsx:672-680` (AddEntryModal render site)

- [ ] **Step 1: Add the pick handler**

In `src/app/planner/client.tsx`, add a new `useCallback` near the other handlers (adjacent to `handleCampPlacementTap`, around line 206):

```tsx
const handleActivityPickFromModal = useCallback(
  async (userCampId: string) => {
    const childId = entryModal?.childId;
    const weekStart = entryModal?.weekStart;
    if (!childId || !weekStart) return;
    setEntryModal(null);
    const result = await assignCampToWeek(planner.id, userCampId, childId, weekStart);
    if (result.error) {
      alert(result.error);
      return;
    }
    router.refresh();
  },
  [entryModal, planner.id, router]
);
```

- [ ] **Step 2: Pass new props to `AddEntryModal`**

Find the `<AddEntryModal ... />` render (around line 672-703) and add:

```tsx
<AddEntryModal
  open={entryModal !== null}
  onClose={() => setEntryModal(null)}
  plannerId={planner.id}
  scope={entryModal ?? { childId: null, weekStart: null }}
  shareCampsDefault={shareCampsDefault}
  kids={kids}
  userCamps={userCamps}
  initialTab={entryModal?.tab ?? "camp"}
  onActivityPick={handleActivityPickFromModal}
  onCampSubmitted={(result) => {
    // ...existing body unchanged
  }}
  onBlockSubmitted={() => {
    // ...existing body unchanged
  }}
/>
```

- [ ] **Step 3: Type-check and lint**

Run: `npm run lint && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit A3 + A4 together**

```bash
git add src/components/planner/add-entry-modal.tsx src/app/planner/client.tsx
git commit -m "feat(planner): wire activity picker into cell-scoped +Add modal

When +Add is clicked on an empty week cell (childId + weekStart set),
the modal now shows a tap-to-place list of the user's saved activities
above the add-new form. Top-level +Add (no scope) is unchanged.

Tap places at default 'considering' status and closes the modal —
intentional divergence from DnD, which routes through the cell-anchored
status picker popover."
```

---

### Task A5: Manual verification in dev

**Files:** none

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify cell-scoped flow**

1. Log in, open a planner with at least two saved camps (My Camps rail non-empty).
2. Click `+Add` on an empty week cell for a kid.
3. Verify: "FROM MY ACTIVITIES" header appears above the URL field, list shows all saved camps, divider "OR ADD NEW" is visible.
4. Tap an activity row — modal closes, activity appears on that week for that kid at "considering" status.
5. Verify the status can still be changed afterward via the entry's status picker.

- [ ] **Step 3: Verify header (unscoped) flow is unchanged**

1. Click the global `+Add` button in the planner header (not a cell).
2. Verify: no "FROM MY ACTIVITIES" section, no divider — just the original form.

- [ ] **Step 4: Verify empty-rail case**

1. With My Camps empty, click `+Add` on a cell.
2. Verify: no section header, no divider — just the form.

- [ ] **Step 5: Verify mobile**

1. Narrow viewport to <768px or use responsive DevTools.
2. Tap `+Add` on a cell; verify the list + form both render in the bottom sheet modal.
3. Tap a row; verify placement and cell flash/scroll behavior.

- [ ] **Step 6: If any issue found, fix inline and commit separately**

Do not proceed to Milestone B until the feature works end-to-end.

---

## Milestone B: camp → activity rename

**Rule (from spec):** UI button copy + module titles change. Descriptive copy stays. Code identifiers (files, exports, props, variables) change. DB schema does not.

**Sequencing principle:** one commit per logical layer. Each commit must compile and tests must pass before moving on. After every task in this milestone, run `npm run lint && npx tsc --noEmit && npm test` before committing.

### Task B1: Rename rail — `MyCampsRail` → `MyActivitiesRail`

**Files:**
- Rename: `src/components/planner/my-camps-rail.tsx` → `src/components/planner/my-activities-rail.tsx`
- Modify: `src/app/planner/client.tsx` (import + JSX)
- The component exports `MyCampsRail` → `MyActivitiesRail`

- [ ] **Step 1: Rename the file**

```bash
git mv src/components/planner/my-camps-rail.tsx src/components/planner/my-activities-rail.tsx
```

- [ ] **Step 2: Rename the exported component and update internal UI copy**

In `src/components/planner/my-activities-rail.tsx`:
- Export name: `MyCampsRail` → `MyActivitiesRail`
- `<h2>My camps</h2>` → `<h2>My activities</h2>` (both desktop and mobile sheet header)
- Mobile pill label: `My Camps` → `My Activities`
- `+ Add camp` button labels → `+ Add activity` (both desktop and mobile)
- `aria-label="Open My Camps"` → `aria-label="Open My Activities"`
- `aria-label="My Camps"` on the sheet → `aria-label="My Activities"`
- `aria-label={`Drag ${camp.activity.name}`}` → `aria-label={`Drag ${activity.activity.name}`}` (rename var `camp` → `activity` in the `DraggableCampItem` and `TapToPlaceCampItem` local prop names; the inner component names also get renamed)
- Local components: `DraggableCampItem` → `DraggableActivityItem`, `TapToPlaceCampItem` → `TapToPlaceActivityItem`
- Props parameter: `camps: UserCampWithActivity[]` → `activities: UserCampWithActivity[]` (type rename is in a later task)
- `camps.length` → `activities.length`
- `camps.map(...)` → `activities.map(...)`
- Remove confirm modal: `from your My Camps list` → `from your My Activities list`

Keep unchanged: `Nothing yet — add one above.` (descriptive copy), `UserCampWithActivity` type import (renamed later).

- [ ] **Step 3: Update the call site in `src/app/planner/client.tsx`**

- Change `import { MyCampsRail } from "@/components/planner/my-camps-rail";` → `import { MyActivitiesRail } from "@/components/planner/my-activities-rail";`
- JSX: `<MyCampsRail camps={userCamps} ... />` → `<MyActivitiesRail activities={userCamps} ... />` (note: the prop name also changes from `camps` to `activities`; the variable `userCamps` is renamed in Task B4)

- [ ] **Step 4: Verify**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(planner): rename MyCampsRail to MyActivitiesRail"
```

---

### Task B2: Rename modal — `AddCampModal` → `AddActivityModal`

**Files:**
- Rename: `src/components/planner/add-camp-modal.tsx` → `src/components/planner/add-activity-modal.tsx`
- Modify: `src/components/planner/add-entry-modal.tsx` (import, JSX, tab label, prop names)
- Modify: `src/app/planner/client.tsx` (prop names passed to `AddEntryModal`)

- [ ] **Step 1: Rename the file**

```bash
git mv src/components/planner/add-camp-modal.tsx src/components/planner/add-activity-modal.tsx
```

- [ ] **Step 2: Rename the component and update UI copy**

In `src/components/planner/add-activity-modal.tsx`:
- Export: `AddCampModal` → `AddActivityModal`
- Modal title `Add a camp` → `Add an activity`
- Form field label `Camp name` → `Activity name`
- Button label `Add camp` → `Add activity`
- Disclosure copy about directory (line ~219-221) — audit: currently says "Share this camp with Kidtinerary's directory so other parents can find it." This is UI copy in a module → change to `Share this activity with Kidtinerary's directory so other parents can find it.`

- [ ] **Step 3: Update `AddEntryModal`**

In `src/components/planner/add-entry-modal.tsx`:
- Import: `AddCampModal` → `AddActivityModal`
- JSX: `<AddCampModal ... />` → `<AddActivityModal ... />`
- Tab label: `Camp` → `Activity`
- State type: `useState<"camp" | "block">` — keep as `"camp"` internal identifier for now; rename in Task B4 along with other state (too many downstream props coupled to the `tab: "camp"` shape).
- (Defer tab key rename to B4.)

- [ ] **Step 4: Verify**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(planner): rename AddCampModal to AddActivityModal and update UI labels"
```

---

### Task B3: Rename server actions

**Files:**
- Modify: `src/lib/actions.ts` (export names at lines 539, 927, 1016)
- Modify: every call site in `src`

- [ ] **Step 1: Rename the exports in actions.ts**

In `src/lib/actions.ts`:
- `export async function submitCamp(...)` → `export async function submitActivity(...)`
- `export async function assignCampToWeek(...)` → `export async function assignActivityToWeek(...)`
- `export async function removeCampFromShortlist(...)` → `export async function removeActivityFromShortlist(...)`

Do NOT rename `submitCampUrl` (line 128) — that's scrape-flow adjacent; revisit in Task B6 sweep.

Inside each renamed action, any internal variable still referencing `camp` as a term for the user-saved shortlist row can stay for now (DB-adjacent local var); the wire is the export name.

- [ ] **Step 2: Update call sites**

Run `rg -n 'submitCamp\b|assignCampToWeek\b|removeCampFromShortlist\b' src/` to enumerate, then update each one. Expected sites (verify by grep):

- `src/components/planner/add-activity-modal.tsx` — `submitCamp` in `import` and `submitCamp(payload, ...)` call
- `src/components/planner/my-activities-rail.tsx` — `removeCampFromShortlist` in `import` and call
- `src/app/planner/client.tsx` — `assignCampToWeek` in `import` and call
- Any drawers (e.g. `camp-detail-drawer.tsx`) that call these

Update both imports and call sites to the new names.

- [ ] **Step 3: Verify**

Run: `rg -n '\bsubmitCamp\b|\bassignCampToWeek\b|\bremoveCampFromShortlist\b' src/`
Expected: no results.

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(planner): rename camp-related server actions to activity"
```

---

### Task B4: Rename client.tsx state + variables + prop names

**Files:**
- Modify: `src/app/planner/client.tsx` (extensive)
- Modify: `src/components/planner/add-entry-modal.tsx` (props)
- Modify: `src/components/planner/matrix.tsx` (if prop names propagated)
- Modify: `src/components/planner/planner-cell.tsx` (if prop names propagated)

- [ ] **Step 1: Rename client.tsx state**

In `src/app/planner/client.tsx`:
- `quickViewCampId` / `setQuickViewCampId` → `quickViewActivityId` / `setQuickViewActivityId`
- `placementCamp` / `setPlacementCamp` → `placementActivity` / `setPlacementActivity`
- `draggingCamp` / `setDraggingCamp` → `draggingActivity` / `setDraggingActivity`
- `handleCampPlacementTap` → `handleActivityPlacementTap`
- `previewCamp` → `previewActivity`
- `pendingAssignment` fields: `userCampId` → keep (matches DB column convention at the boundary), other fields unchanged
- `userCamps` prop on `Props` → `userActivities` (rename in interface and all usages in the function body)
- `handleDragEnd` drag data type check: `activeData?.type === "camp"` → `activeData?.type === "activity"` (and update the matching `data` object built in the draggable item, Task B4b)

- [ ] **Step 2: Update `Matrix` and `PlannerCell` props**

Rename prop names that flow through:
- `onAddCampClick` → `onAddActivityClick` in `src/components/planner/matrix.tsx` (Props interface + call) and in `src/components/planner/planner-cell.tsx` (Props interface + call)
- `onAddBlockClick` — unchanged
- `isDraggingCamp` → `isDraggingActivity` in `matrix.tsx`, `planner-cell.tsx`, `cell-drop-zones.tsx`

- [ ] **Step 3: Update `AddEntryModal` prop shape**

In `src/components/planner/add-entry-modal.tsx`:
- `userCamps: UserCampWithActivity[]` → `userActivities: UserCampWithActivity[]` (type rename deferred to Task B5)
- `onCampSubmitted` → `onActivitySubmitted`
- `initialTab?: "camp" | "block"` → `initialTab?: "activity" | "block"`
- Internal `tab` state `"camp" | "block"` → `"activity" | "block"` and update the `setTab("camp")` / `tab === "camp"` references.
- The tab-key change ripples to `client.tsx`: the `entryModal` state shape changes from `{ childId, weekStart, tab: "camp" | "block" }` to `{ childId, weekStart, tab: "activity" | "block" }`. Update all `tab: "camp"` literal to `tab: "activity"`.

- [ ] **Step 4: Update `DraggableActivityItem` drag data**

In `src/components/planner/my-activities-rail.tsx`, inside `DraggableActivityItem`:
- The `data` memo currently has `type: "camp" as const`. Change to `type: "activity" as const`.
- The corresponding `activeData?.type === "camp"` check in `client.tsx` (Step 1) matches.

- [ ] **Step 5: Verify**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: clean.

Smoke test: `npm run dev`, verify DnD still works (drag an item from the rail onto a cell → status picker appears → place).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(planner): rename camp→activity in state, prop names, and dnd payload"
```

---

### Task B5: Rename the `UserCampWithActivity` type

**Files:**
- Modify: `src/lib/queries.ts` (type definition)
- Modify: all importers

- [ ] **Step 1: Rename the type**

In `src/lib/queries.ts`, find the `UserCampWithActivity` type export. Rename to `UserActivityWithDetails`:

```ts
export type UserActivityWithDetails = {
  id: string;
  color: string;
  plannerEntryCount: number;
  activity: {
    id: string;
    name: string;
    verified: boolean;
    organization: { id: string; name: string } | null;
  };
};
```

(Adjust shape to match current definition — do not change shape, only the name.)

Also rename the function that returns it — if there's a `getUserCamps` style query, rename to `getUserActivities`. The DB table `user_camps` stays.

- [ ] **Step 2: Update all importers**

Run `rg -n 'UserCampWithActivity' src/`. Expected files to update:
- `src/app/planner/client.tsx`
- `src/components/planner/my-activities-rail.tsx`
- `src/components/planner/add-entry-modal.tsx`
- `src/components/planner/activity-picker-section.tsx`
- `tests/components/planner/activity-picker-section.test.tsx`

Replace all `UserCampWithActivity` → `UserActivityWithDetails`.

- [ ] **Step 3: Verify**

Run: `rg -n 'UserCampWithActivity' .`
Expected: no hits in code (docs may reference old name — fine).

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(planner): rename UserCampWithActivity type to UserActivityWithDetails"
```

---

### Task B6: UI copy sweep across the app

**Files:** any remaining UI-copy hits per rule in spec Part 2.

- [ ] **Step 1: Enumerate candidates**

Run:

```bash
rg -n --type tsx --type ts '\b[Cc]amp[s]?\b' src/ | grep -v 'user_camps\|camp_url\|UserCamp\|submitCampUrl\|camp-palette' > /tmp/camp-hits.txt
```

Review `/tmp/camp-hits.txt`. For each hit, categorize:
- **Change** — button copy, module/section title, form label, modal title, confirmation text
- **Keep** — descriptive copy, marketing/landing, DB-adjacent identifiers, scrape-flow camp URL, class names in `globals.css` prefixed by the design system

Expected candidates for change (non-exhaustive, verify each):
- `src/components/planner/scrape-confirm-drawer.tsx` — any user-facing "camp" labels
- `src/components/planner/camp-preview-modal.tsx` — button/header copy (file name itself is a B7 concern, covered there)
- `src/components/planner/camp-detail-drawer.tsx` — button/header copy
- `src/components/planner/add-block-modal.tsx` — check if `camp` appears in copy
- `src/components/planner/kid-column-header.tsx` — check placeholder text
- `src/app/account/planners/client.tsx` — check labels
- `src/components/planner/planner-range-picker.tsx` — check labels

Expected candidates to keep:
- `src/app/page.tsx` — landing page with "summer camps" as example
- `src/lib/email.ts` — case-by-case
- `src/lib/ics.ts` — calendar titles; likely stays since it refers to external context
- `src/lib/camp-palette.ts` — code identifier, scrape/color infrastructure; stays
- `src/lib/submit-camp-validation.ts` — URL submission validation; stays (scrape-flow)
- `src/app/globals.css` — design tokens; verify none are UI-facing text

- [ ] **Step 2: Apply changes**

For each "change" hit, edit the file: replace the camp word with activity (preserve case: `camp` → `activity`, `Camp` → `Activity`, `CAMP` → `ACTIVITY`, `camps` → `activities`, etc.).

For the `scrape-confirm-drawer`: review each hit individually. Scrape flow describes a camp URL being processed — that's partly UI, partly scrape-flow. Conservative default: user-facing labels change ("Added to your activities"); log lines and internal debug copy stay.

- [ ] **Step 3: Verify**

Run: `npm run lint && npx tsc --noEmit && npm test`
Run: `npm run dev` and smoke-test the changed modules.
Expected: all labels read "activity" where previously "camp" in UI chrome.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(planner): sweep remaining camp→activity UI copy"
```

---

### Task B7: Rename remaining `camp-*.tsx` component files

**Files:**
- Rename: `src/components/planner/camp-detail-drawer.tsx` → `activity-detail-drawer.tsx`
- Rename: `src/components/planner/camp-preview-modal.tsx` → `activity-preview-modal.tsx`
- Rename: `src/components/planner/shared-camp-detail-panel.tsx` → `shared-activity-detail-panel.tsx`
- Rename: `tests/components/planner/shared-camp-detail-panel.test.tsx` → `tests/components/planner/shared-activity-detail-panel.test.tsx`
- Rename component exports: `CampDetailDrawer` → `ActivityDetailDrawer`, `CampPreviewModal` → `ActivityPreviewModal`, `SharedCampDetailPanel` → `SharedActivityDetailPanel`

- [ ] **Step 1: Rename files**

```bash
git mv src/components/planner/camp-detail-drawer.tsx src/components/planner/activity-detail-drawer.tsx
git mv src/components/planner/camp-preview-modal.tsx src/components/planner/activity-preview-modal.tsx
git mv src/components/planner/shared-camp-detail-panel.tsx src/components/planner/shared-activity-detail-panel.tsx
git mv tests/components/planner/shared-camp-detail-panel.test.tsx tests/components/planner/shared-activity-detail-panel.test.tsx
```

- [ ] **Step 2: Rename component exports**

In each renamed file, rename the exported component name accordingly. Update the import path string inside the test file.

- [ ] **Step 3: Update importers**

Run: `rg -n 'CampDetailDrawer|CampPreviewModal|SharedCampDetailPanel|camp-detail-drawer|camp-preview-modal|shared-camp-detail-panel' src/ tests/`
Update each hit to the new name / path.

- [ ] **Step 4: Verify**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(planner): rename remaining camp-*.tsx files to activity-*.tsx"
```

---

### Task B8: Final audit

**Files:** none (analysis only)

- [ ] **Step 1: Run the final grep**

```bash
rg -n --type tsx --type ts '\b[Cc]amp[s]?\b' src/ tests/
```

- [ ] **Step 2: Categorize every remaining hit**

For each hit, confirm it falls into one of the allowed "keep" categories:
- DB column / table reference (`user_camps`, `camp_url`, etc.)
- Scrape/infrastructure (`camp-palette.ts`, `submit-camp-validation.ts`, `src/scraper/...`)
- Descriptive copy (landing page "summer camps" examples, marketing blurbs)
- Code identifier that is DB-boundary and intentionally not renamed (e.g. `userCampId` where it matches the DB join row ID)

If any hit does not fit a "keep" category, fix it (either change to activity or document why it stays with an inline comment referencing this plan).

- [ ] **Step 3: Write an audit note**

Append a short section to [docs/planning/2026-04-24-planner-activity-add-flow.md](./2026-04-24-planner-activity-add-flow.md) titled `## Rename audit — 2026-04-24` listing each intentional "keep" and the reason.

- [ ] **Step 4: Verify full test + lint + build**

Run:
```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs(planner): camp→activity rename audit note"
```

---

## Self-Review Checklist

Complete before marking the plan done.

**Spec coverage:**
- [x] Cell-scoped `+Add` shows picker → Task A1–A4
- [x] Top-level `+Add` unchanged → Task A3 (`cellScoped` gate)
- [x] Empty rail → no section → Task A1 (`if (activities.length === 0) return null`)
- [x] Tap = place at default status, close modal → Task A4
- [x] Rail rename (copy + component + file) → Task B1
- [x] Modal rename (copy + component + file) → Task B2
- [x] Server action rename → Task B3
- [x] State + prop + dnd-payload rename → Task B4
- [x] Type rename → Task B5
- [x] Copy sweep → Task B6
- [x] Remaining file renames → Task B7
- [x] Audit trail → Task B8

**Placeholder scan:** No "TBD", "etc.", "fill in" steps — each step has actual code, commands, or a grep command that enumerates the targets.

**Type consistency:** `UserCampWithActivity` (used in A1–A4) is renamed in Task B5 only after all A-tasks are complete, so type names match within their own milestone.

**Risk notes:**
- Task B4 has the highest blast radius (client.tsx has many references). A pause between B3 and B4 to rerun the full test + smoke test is wise.
- Task B6 (copy sweep) is case-by-case judgment. The executing agent should err on the side of "keep" when a hit is ambiguous and flag to the user rather than mass-rename.
- Package manager: this project uses `npm` (`package-lock.json` present). All commands use `npm`/`npx` accordingly.
