# Color-Coded Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current pill-style toggle in the planner rail (and the matching mobile tabs on `/account/planners`) with file-folder-style tabs that color-code "mine" content (grey) vs "friends'/shared" content (blue). The active tab's color extends into the planner rail's content area below.

**Architecture:** Pure CSS/markup change on 2 existing client components. The planner rail's `<aside>` is split into a white "tab header" strip (always) and a colored content area (color = active tab). The `/account/planners` mobile tabs use the same tab styling but the page background doesn't shift (flat page, not a rail). Existing tab state management (`useState`), ARIA roles, and component composition are preserved.

**Tech Stack:** Next.js App Router + Tailwind CSS v4.

**Spec:** `docs/superpowers/specs/2026-05-17-color-coded-tabs-design.md` (approved).

**Branch:** Push to existing `style/browser-style-tabs` (PR #54). Don't open a new branch — the current PR is the right home for this work; we'll just push new commits on top of the existing pill-based attempt.

---

## File Structure

**Modified files (2):**
- `src/components/planner/planner-rail.tsx` — desktop rail tab restructure + content-area bg shift + rail width bump
- `src/app/account/planners/client.tsx` — mobile tab restructure (matching style, no content shift)

**No new files. No new components. No new CSS tokens.** Inactive-tab background hex values (`#f5f5f6`, `#f1f6fa`) are used inline; if they recur elsewhere we can promote them to `globals.css` tokens later.

---

## Task 1: Restructure planner rail with color-coded tabs + content shift + wider rail

**Files:**
- Modify: `src/components/planner/planner-rail.tsx`

The rail currently is a single `<aside>` with `bg-[#dfecf5]` (the old light blue) and the tablist + tab panel both inside. We're splitting it into a white "tab header" + a colored "content area" that swaps color based on active tab. The `<aside>`'s outer bg becomes `bg-surface` (white) so the tab header inherits white; the content area block sets its own bg based on `tab`.

- [ ] **Step 1: Update the `<aside>` opening tag**

Find the existing aside (search for `bg-[#dfecf5]` in the file — should be on the `<aside>` element). Replace its className from:

```tsx
className="hidden md:flex md:flex-col w-80 shrink-0 md:h-full md:overflow-y-auto bg-[#dfecf5] md:border-r md:border-ink px-6 sm:px-8 lg:px-10 pt-[22px] pb-4"
```

to:

```tsx
className="hidden md:flex md:flex-col w-96 shrink-0 md:h-full md:overflow-y-auto md:border-r md:border-ink bg-surface"
```

Changes: width `w-80` → `w-96` (320 → 384px so "Friends' plans (1)" doesn't wrap), bg `#dfecf5` → `bg-surface` (white is the tab-header backdrop), padding moved (we'll add it per-section inside).

- [ ] **Step 2: Replace the tablist block with the new tab markup**

Inside the `<aside>`, find the existing `<div role="tablist" ...>` block (the entire `<div role="tablist">...</div>` chunk that contains both `<button>` tabs). Replace it with this new structure that wraps everything inside the aside (tabbar AND tabpanel):

```tsx
        {/* White tab header — fixed at top, doesn't scroll */}
        <div className="bg-surface px-6 sm:px-8 lg:px-10 pt-[14px] flex-shrink-0">
          <div
            role="tablist"
            aria-label="Planner sidebar"
            className="flex gap-1.5 border-b-[1.5px] border-ink"
          >
            <button
              role="tab"
              type="button"
              aria-selected={tab === "activities"}
              aria-controls="panel-activities"
              onClick={() => setTab("activities")}
              className={`flex-1 px-2.5 py-2 font-sans font-bold text-[10px] uppercase tracking-widest whitespace-nowrap rounded-t-lg border-l-[1.5px] border-r-[1.5px] border-t-[1.5px] transition-colors ${
                tab === "activities"
                  ? "bg-[#ebecee] border-ink text-ink -mb-[1.5px] relative z-10"
                  : "bg-[#f5f5f6] border-ink-3 text-[#999] hover:text-ink"
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
              className={`flex-1 px-2.5 py-2 font-sans font-bold text-[10px] uppercase tracking-widest whitespace-nowrap rounded-t-lg border-l-[1.5px] border-r-[1.5px] border-t-[1.5px] transition-colors ${
                tab === "friends"
                  ? "bg-[#dfecf5] border-ink text-ink -mb-[1.5px] relative z-10"
                  : "bg-[#f1f6fa] border-ink-3 text-[#999] hover:text-ink"
              }`}
            >
              Friends&apos; plans
              {props.friends.length > 0 ? ` (${props.friends.length})` : null}
            </button>
          </div>
        </div>

        {/* Content area — color shifts with active tab; scrolls independently */}
        <div
          className={`flex-1 overflow-y-auto px-6 sm:px-8 lg:px-10 pt-4 pb-4 transition-colors ${
            tab === "activities" ? "bg-[#ebecee]" : "bg-[#dfecf5]"
          }`}
        >
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
        </div>
```

Replaces the entire current contents inside `<aside>...</aside>` for the desktop block (the tablist `<div>` + the ternary panel renderer). The mobile bottom-sheet render (`<MyActivitiesRail ... mobileOnly>` etc.) below the `</aside>` stays unchanged.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: passes. Only the two pre-existing `tests/scraper/llm-extractor.test.ts` errors remain.

- [ ] **Step 4: Commit**

```bash
git add src/components/planner/planner-rail.tsx
git commit -m "feat(rail): color-coded tabs + wider rail + content area color shift"
```

---

## Task 2: Match mobile tabs on /account/planners

**Files:**
- Modify: `src/app/account/planners/client.tsx`

Same tab styling for visual consistency. The mobile tabs sit above the content cards on a flat page (not a rail), so there's no "content area color shift" — only the tabs themselves get the color treatment.

- [ ] **Step 1: Replace the mobile tab block**

Find the existing `{/* Mobile tabs — browser-style */}` block (search for `mobileTab === "mine"` to locate it). It currently renders a `flex border-b border-ink` container with two `<button>` tabs. Replace the whole block with:

```tsx
      {/* Mobile tabs — color-coded (grey = mine, blue = shared) */}
      <div className="md:hidden mb-4 flex gap-1.5 border-b-[1.5px] border-ink">
        <button
          type="button"
          onClick={() => setMobileTab("mine")}
          className={`flex-1 px-2.5 py-2 font-sans font-bold text-[10px] uppercase tracking-widest whitespace-nowrap rounded-t-lg border-l-[1.5px] border-r-[1.5px] border-t-[1.5px] transition-colors ${
            mobileTab === "mine"
              ? "bg-[#ebecee] border-ink text-ink -mb-[1.5px] relative z-10"
              : "bg-[#f5f5f6] border-ink-3 text-[#999] hover:text-ink"
          }`}
        >
          My planners
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("shared")}
          className={`flex-1 px-2.5 py-2 font-sans font-bold text-[10px] uppercase tracking-widest whitespace-nowrap rounded-t-lg border-l-[1.5px] border-r-[1.5px] border-t-[1.5px] transition-colors ${
            mobileTab === "shared"
              ? "bg-[#dfecf5] border-ink text-ink -mb-[1.5px] relative z-10"
              : "bg-[#f1f6fa] border-ink-3 text-[#999] hover:text-ink"
          }`}
        >
          Shared with me {savedShares.length > 0 ? `(${savedShares.length})` : null}
        </button>
      </div>
```

- [ ] **Step 2: Type-check + run existing tests**

Run: `npx tsc --noEmit`
Expected: passes.

Run: `npx vitest run tests/app/account/planners/client.test.tsx`
Expected: passes (the existing tests don't assert on tab styling, just behavior).

- [ ] **Step 3: Commit**

```bash
git add src/app/account/planners/client.tsx
git commit -m "feat(my-planners): match mobile tabs to rail color-coded style"
```

---

## Task 3: Push + update PR #54 description

**Files:**
- None modified — git/gh only.

- [ ] **Step 1: Push to existing branch**

```bash
git push origin style/browser-style-tabs
```

Expected: the new commits land on `style/browser-style-tabs` and trigger a fresh Vercel preview build.

- [ ] **Step 2: Update PR #54 title + body**

The current PR title is `style(tabs): browser-style tabs in planner rail + mobile My Planners` — still accurate, but the body describes the earlier pill→white-bg variant. Replace the body to reflect the final color-coded design:

```bash
gh pr edit 54 --title "style(tabs): color-coded tabs (grey/blue) + wider rail" --body "$(cat <<'EOF'
## Summary

Replaces the pill-style tab toggle in the planner left rail and the mobile My Planners tabs with file-folder-style tabs that color-code "mine" content (grey) vs "friends'/shared" content (blue). On the planner rail, the active tab's color extends into the content area below so the entire pane communicates which "world" you're in.

Design approved via mockup. Full spec at `docs/superpowers/specs/2026-05-17-color-coded-tabs-design.md`.

## Visual highlights

- **Color identity:** grey `#ebecee` for "mine", blue `#dfecf5` for "friends/shared". Inactive tabs are faded (`ink-3` border, `#999` text, washed bg).
- **File-folder shape:** rounded top corners, borders on top/left/right (no bottom), single horizontal divider line under the tab strip; active tab's `-mb-[1.5px]` covers its segment of the divider so it visually merges into the content area.
- **No double line** anywhere on the divider — neither tab has a bottom border.
- **Rail width:** bumped from `w-80` (320px) to `w-96` (384px) so "Friends' plans (N)" never wraps.
- **White "tab header" area:** the top of the rail (above tabs + between/around them) is white. Only the content area below the tabs takes the active tab's color.

## Files changed

- `src/components/planner/planner-rail.tsx` — desktop tab restructure + content-area bg shift + wider rail
- `src/app/account/planners/client.tsx` — mobile tab restructure (matching style; flat page, no content shift)

## Test plan

- [ ] `/planner` desktop → rail shows "My activities | Friends' plans (N)" as two file-folder tabs at the top. White around the tabs. Active tab is grey or blue depending on selection.
- [ ] Click between tabs → content area below shifts color cleanly (grey ↔ blue) with the active tab.
- [ ] "Friends' plans (1)" fits on one line.
- [ ] Inactive tab has muted text, light border, and a faintly-tinted bg matching its identity color.
- [ ] No black double-line at the spot where the active tab meets the content area.
- [ ] `/account/planners` on mobile (<768px) → tabs show "My planners | Shared with me" in the same color-coded style. (Page bg doesn't shift since it's a flat page, not a rail — only the tabs carry the color.)
- [ ] All keyboard a11y preserved (\`role="tab"\`, \`aria-selected\`, \`aria-controls\` on the rail; mobile tabs are plain buttons as before).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: the PR description updates, and the `style/browser-style-tabs` branch now contains the spec doc + the two implementation commits.

- [ ] **Step 3: Verify**

Run: `gh pr view 54 --json state,mergeable,statusCheckRollup`
Expected: `state: OPEN`, `mergeable: MERGEABLE` (or PENDING while Vercel rebuilds). The Vercel preview should be available at the URL in the PR comments within a few minutes.

---

## Out of scope (intentional)

- **No new CSS tokens** — the four hex values (`#ebecee`, `#f5f5f6`, `#dfecf5`, `#f1f6fa`) are inline. If they recur in other components later, promote to `globals.css`.
- **No animations beyond `transition-colors`** — already in Tailwind defaults, no JS-driven motion.
- **No mobile bottom-sheet tab** — Phase 2 V1 still has only My Activities on the mobile bottom sheet. Friends' Plans tab on mobile remains out of scope.
- **No changes to `<SaveShareCTA>`** — that's an action button (pill), not section navigation.
