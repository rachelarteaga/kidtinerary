# Account Menu Updates — Design

**Branch:** `account-menu-updates`
**Date:** 2026-04-22
**Scope:** My Kids polish, Edit User screen, Sharing MVP (planner + per-camp)

---

## Context

The Account menu (top-nav cluster, [auth-cluster.tsx](src/components/layout/auth-cluster.tsx:40)) links to three sections today:

- `/kids` — list of kid cards with add/edit/delete
- `/account/sharing` — a placeholder "coming soon" page
- Log out

There is no surface to edit the user's own profile. Sharing consists of one feature: a per-kid schedule link (`ShareScheduleButton`) that generates a token-based view-only URL. No co-parent accounts, no planner-level share, no per-camp share.

This spec covers three features that extend the Account menu. A fourth feature — a **My Planners** screen — is explicitly deferred.

## In Scope

1. **My Kids updates** — remove deprecated copy; add avatar editing to each kid card.
2. **Edit User screen** — new `/account/profile` route to edit name, phone, and address.
3. **Sharing MVP** — planner-level share (image or live link) and per-camp share link, with a shared-state indicator and revoke list.

## Out of Scope / Deferred

- **My Planners** screen (multi-planner management, default-planner switching, planner duplication). Deferred to a later session.
- **Co-parent invites / multi-user editing** of a planner. Link-share remains view-only.
- **Notification preferences** edit surface. `default_radius_miles` stays hidden for now.
- **Notes-in-share** opt-in. Private parent notes are never included in any share, by design.
- **Link expiration**. Recipient links live until revoked; MVP relies on the revoke list.
- **Public camp detail polish** beyond making the page unauthenticated-friendly.

---

## Feature 1: My Kids updates

### Changes

- Remove "planner coming soon" copy from `/kids`.
- Each kid card in [child-card.tsx](src/components/kids/child-card.tsx) gains an avatar thumbnail that is editable. Clicking the avatar opens [avatar-editor-modal.tsx](src/components/planner/avatar-editor-modal.tsx) — the same modal the planner column header uses.
- When `children.avatar_url` is null, the card falls back to the shape+initial treatment from [kid-avatar.tsx](src/components/planner/kid-avatar.tsx).
- Avatar edits are saved back to `children.avatar_url`. Both the Kids page and the planner column header re-render from the same row.

### Not needed

- No schema change — `avatar_url` already exists (migration 010).
- No new upload pipeline — reuse whatever `AvatarEditorModal` currently does.

---

## Feature 2: Edit User screen

### Route

`/account/profile` — linked from the Account menu (add new entry above "My kids").

### Fields

| Field | Source of truth | Editable | Notes |
|---|---|---|---|
| Name | `auth.users.user_metadata.full_name` | Yes | Write via `supabase.auth.updateUser({ data: { full_name } })`. **Do not** duplicate to `profiles` — single source of truth. |
| Email | `auth.users.email` | **No** | Read-only. Sub-label: *"Contact support to change"*. Email maps to unique account. |
| Address | `profiles.address` | Yes | Save re-geocodes `profiles.location` (geography point). Reuse the geocoding logic from the onboarding address step. |
| Phone | `profiles.phone` (**new column**) | Yes | For future SMS alerts. Free-text, E.164 validation on save. |

### Not shown

- `default_radius_miles` — hidden for now (feature not yet exposed to users).
- `notification_preferences` — deferred.

### Migration

```sql
alter table profiles add column phone text;
```

No backfill needed — nullable.

---

## Feature 3: Sharing MVP

Two share modes. Owner picks one per share event:

- **Share image view** — client-side render to PNG via `html-to-image`, sent through the Web Share API (`navigator.share({ files })`). No server state. Always renders detailed view. Respects the Include opt-ins.
- **Share a live link** — token-backed URL. Recipient sees a live view of the planner (read-only). Revocable.

### 3a. Share modal (planner)

Triggered from the planner toolbar. Replaces the current `ShareScheduleButton`.

**Sections, in order:**

1. **Which kids?** Checkbox list with avatars. Default: all active kids on this planner. At least one required.
2. **Include** (all off by default):
   - **Cost paid** — when on, `priceWeeklyCents` shows on legend rows and in the camp detail panel.
   - **Non-activity block details** — when on, non-camp blocks render with their real title (e.g., "Family trip to Maine"). When off, they render using the "NOTHING SCHEDULED" treatment (see below).
3. **Actions** (stacked):
   - `📷 Share image view` — helper: *"Always shows detailed view. Sent via text, email, or AirDrop."*
   - `🔗 Share a live link` — primary button. Helper: *"Read-only for recipient. Revocable anytime."*

**What is never shared:** private parent notes. Not configurable.

### 3b. Public shared view (live link)

Route: `/schedule/[token]` (existing) — extended to recognize planner-scoped tokens.

**Composition:**

- Reuses [planner-cell.tsx](src/components/planner/planner-cell.tsx) (`PlannerCell`) and [kid-column-header.tsx](src/components/planner/kid-column-header.tsx) (`KidColumnHeader`). Requires a small prop addition: a `readOnly` flag that suppresses the drag handle, avatar edit affordance, and kebab menu on `KidColumnHeader`. `PlannerCell` already takes `onAddClick` / `onEntryClick` as handlers — the public view passes a no-op add handler and an entry-click handler that opens the recipient-side camp detail panel (not the owner's drawer).
- Wraps them in a public-view chrome: header with owner name, "Shared · view-only" label, and a **Detail/Simple toggle**.
- Detail/Simple toggle flips `PlannerCell` between `viewMode="detail"` and `viewMode="simple"` — both already implemented. Recipient's choice persists to `localStorage` under a per-token key.
- No add buttons, no drag-drop, no status editing.
- Owner-filter rules applied server-side before rendering: kid filter (`kid_ids`), cost stripping (unless `include_cost`), personal-block masking (unless `include_personal_block_details`).

**Non-activity blocks with details hidden** render as the dotted-fill personal-block treatment from `BLOCK_FILL_STYLE` with label **"NOTHING SCHEDULED"** — `font-size: 11px, font-weight: 400, text-transform: uppercase, letter-spacing: 0.08em, color: var(--color-ink-2)`. The same treatment is used for truly empty weeks, making them visually indistinguishable from masked personal blocks (intentional).

### 3c. Camp detail panel (recipient-side)

Opens when recipient taps a camp. Fields, in order:

1. **Org** (camp provider) — uppercase label
2. **Camp name** — primary heading
3. **Location** — full address, two lines
4. **Link** — clickable, opens provider's booking page in a new tab
5. **About** — session description

If `include_cost` is true, weekly cost appears under the name. Status, registration details, and parent notes are never shown.

### 3d. Shared indicator pill

Always-visible pill next to the planner name in the planner header, rendered when any active `shared_schedules` row exists for the current `planner_id`.

- Visual: `#eef9f0` background, `#147a30` text, `#2cb14a` dot, 12px uppercase-ish "Shared" label.
- Tap → bottom sheet listing all active shares for this planner (link + created date + "Stop sharing" button per row).
- Pattern mirrors Google Docs' shared-doc indicator.

### 3e. Per-camp share

- Trigger: "Share camp" button on any camp's detail drawer / detail page.
- Share modal is minimal: optional **recommender note** field (e.g., *"Great for 5yo artists"*) + "Copy link" button. No image option.
- Link points to the existing camp detail page. The page must work unauthenticated — verify guards and add a public-friendly layout if needed.
- If `recommender_note` is set, it renders as a small quote block at the top of the camp page ("Shared by Rachel: …").

### 3f. `/account/sharing` page (replace "coming soon")

Lists all active `shared_schedules` rows the user owns, grouped by scope:

- **Shared planners** — each row shows planner name, kid count, created date, link, revoke button.
- **Shared camps** — each row shows camp name, recommender note (if any), created date, link, revoke button.

Revoking deletes the row. Tokens are not reissued.

---

## Data model

### `profiles`

```sql
alter table profiles add column phone text;
```

### `shared_schedules`

Current schema is kid-scoped only. Extend to support planner and camp scopes:

```sql
alter table shared_schedules add column scope text not null default 'planner'
  check (scope in ('planner', 'camp'));
alter table shared_schedules add column planner_id uuid references planners(id) on delete cascade;
alter table shared_schedules add column camp_id uuid; -- identifier resolved by the existing camp detail page
alter table shared_schedules add column kid_ids uuid[] not null default '{}';
alter table shared_schedules add column include_cost boolean not null default false;
alter table shared_schedules add column include_personal_block_details boolean not null default false;
alter table shared_schedules add column recommender_note text;
```

**Backfill for existing rows** (all currently kid-scoped): convert to `scope='planner'`, `planner_id` = the user's default planner, `kid_ids` = `[child_id]`.

**Column deprecation:** `shared_schedules.child_id` becomes legacy. Keep it nullable; stop writing to it; plan removal in a later cleanup.

**Integrity checks:**

- `scope='planner'` → `planner_id` required, `kid_ids` non-empty, `camp_id` null.
- `scope='camp'` → `camp_id` required, `planner_id` null, `kid_ids` empty.

### RLS

- Owner full CRUD on their own `shared_schedules` rows (existing policy).
- Public read of a `shared_schedules` row by token — existing behavior. Extend the resolver query to fetch planner/camp content based on scope.
- **No new cross-user writes.** The broad RLS writes on `activity_locations` / `sessions` flagged in auto-memory are not touched by this work.

---

## Components

### New

- `src/app/account/profile/page.tsx` + `client.tsx` — edit user screen.
- `src/app/account/sharing/page.tsx` — replace "coming soon" with active-shares list.
- `src/components/account/edit-profile-form.tsx`
- `src/components/account/active-shares-list.tsx`
- `src/components/planner/share-planner-modal.tsx` — replaces current share button flow.
- `src/components/planner/share-camp-modal.tsx`
- `src/components/planner/share-indicator-pill.tsx`
- `src/components/planner/shared-planner-view.tsx` — wraps the planner grid in public-view chrome.
- `src/lib/share/render-image.ts` — client-side `html-to-image` + Web Share API helper.

### Modified

- `src/components/layout/auth-cluster.tsx` — add "Edit profile" link above "My kids".
- `src/components/kids/child-card.tsx` — avatar thumbnail becomes a button that opens `AvatarEditorModal`.
- `src/app/kids/client.tsx` — remove "planner coming soon" copy.
- `src/components/planner/share-schedule-button.tsx` — deprecate/remove; the planner toolbar calls `SharePlannerModal` instead.
- `src/components/planner/planner-title.tsx` — consume a `sharesActiveCount` prop and render `SharedIndicatorPill` when > 0.
- `src/app/schedule/[token]/page.tsx` — handle all three scopes (legacy child, planner, camp). For planner scope, render `SharedPlannerView`.
- Camp detail page (wherever `camps/[id]` or equivalent lives) — confirm unauthenticated rendering, optionally display `recommender_note`.

---

## Open questions / follow-ups

1. **Camp identifier.** `camp_id` in `shared_schedules` — what is the canonical camp identity? Today the planner references `sessions` and `activity_locations`. Implementation plan needs to pick one (likely `activity_locations.id`) and confirm the public camp detail page keys off it.
2. **Web Share API fallback on desktop.** When `navigator.share` is unavailable, image download plus a "Copy image to clipboard" button is the expected fallback. Confirm during implementation.
3. **Copy cleanup of `share_camps_default`.** Unused boolean on `profiles` (migration 010). Consider dropping in a follow-up; not blocking this work.
4. **Pill micro-interaction.** Bottom sheet vs. popover for the "Shared" pill tap-target. Decide during implementation based on mobile/desktop parity.

---

## Verification plan

- Edit profile: name round-trips through `auth.users.user_metadata`; phone round-trips through `profiles.phone`; address re-geocodes.
- Kid avatar: edits from both `/kids` and the planner column header update the same row and re-render both surfaces.
- Share planner → live link: recipient sees only the selected kids; cost hidden unless opted in; personal blocks masked unless opted in; Detail/Simple toggle works recipient-side; revoke kills the link immediately.
- Share planner → image: PNG renders, opens native share sheet on mobile, downloads on desktop; always detailed view.
- Per-camp share: link opens camp detail page for unauthenticated visitor; recommender note renders when set.
- Shared indicator pill: appears only when ≥1 active share exists for the current planner; tap opens active-shares list; revoke from there removes the pill.
- `/account/sharing` lists all owned shares; revoke deletes the row.
