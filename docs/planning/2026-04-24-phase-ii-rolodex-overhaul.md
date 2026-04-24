# Kidtinerary Phase II — Rolodex + Coordination Overhaul

Date: 2026-04-24
Status: Direction locked on OQ1, OQ5, OQ2 (partial), and the camp-→-activity
naming overhaul (2026-04-24 session). Remaining OQs (onboarding capture
friction, rolodex UI name, inbound-share timing) stay open and are flagged
at the bottom.
Supersedes (in spirit, not in code): the "shared + verified public camp pool"
direction implicit in the current `add-camp-flow-overhaul` branch.

**Companion deep-dive:**
[2026-04-24-phase-ii-catalog-capture-sharing.md](./2026-04-24-phase-ii-catalog-capture-sharing.md)
— the beyond-planner product polish (Catalog IA, three capture paths,
sharing model, SMS reminders, evergreen activities).

---

## Mission

**Kidtinerary is the private, durable place where a parent catalogs everything
their kid is doing, considering, or has ever done — and gets nudged at exactly
the right moment to sign up, pay, pack, or show up.**

Three pillars, in priority order:

1. **Rolodex.** A personal, lifetime activity catalog, fed from wherever the
   parent already lives — web search, text threads, forwarded emails, booking
   receipts, word-of-mouth. Capture in seconds, remember forever.
2. **Planner.** The existing week × kid matrix stays as the core organizing
   surface. This is already strong; Phase II keeps it intact and feeds it from
   the rolodex.
3. **Nudges.** Reminders that make the rolodex active without making the
   parent log in. Registration opens, deadlines, payments, waitlists, first
   day, forms due.

Sharing is a **thin interop layer** (SMS/email share-sheet, read-only links)
that plays nicely with how parents already coordinate — not a social feature
that expects parents to return and engage.

## Product thesis

Discovery of kid activities is not a real product problem. Parents find things
via web search, school newsletters, Instagram, and conversations with other
parents. Three well-funded attempts prove a comprehensive catalog is nearly
impossible at scale:

- Campwing (~2,500 camps, LLM-extracted, 3 metros after multiple years)
- Winnie (~250K providers, state licensing records, camps a secondary add-on)
- Recess ($1.75M raise, 1 metro, provider-onboarded marketplace)

The real problem — the one parents universally report — is **organizing what
they've already found, remembering what worked last year, and not missing the
moment to act.** That problem compounds year over year. It gets harder as the
kid gets older, as more activities enter the mix, as siblings are added, as
schedules overlap. Nobody has built a durable personal tool for this.

Kidtinerary stops competing with discovery engines and becomes the tool parents
reach for *after* they've found something — and the tool they revisit every
year, every season, every sign-up window.

## Naming overhaul: "camp" → "activity"

**Decision (2026-04-24):** The product's primary noun shifts from **camp** to
**activity**. "Camp" demotes from the core concept to one value in an
`activity_type` enum, alongside classes, lessons, leagues, workshops, programs,
and clubs. This is a UI / copy / routing / component-name refactor; the data
layer is already correctly named (`activities`, `activity_locations`,
`price_options`, etc. — no table renames needed except `user_camps`).

### Why

1. **Schema and product reality were already mismatched.** The `activities`
   table models any kid activity; only the UI layer called them camps.
2. **Year-round usage requires generic vocabulary.** "Tuesday swim lessons"
   is not a camp. Making the product generic unlocks the evergreen pillar.
3. **Parents don't think of all their kid's activities as camps.** The
   Catalog, the planner, the reminders, the share-sheet — all make more
   sense when the noun is neutral.

### What changes

| Surface | Before | After |
| --- | --- | --- |
| Core noun in UI copy | "camp" | "activity" |
| Nav label at `/catalog` | "Explore" (camp discovery) | **"Catalog"** (your activities) — route renamed on 2026-04-24 |
| Nav: `/submit`, add flows | "Add a camp" | "Add an activity" |
| Component: `MyCampsRail` | camp-specific shortlist | `MyActivitiesRail` or `CatalogRail` |
| Server actions | `submitCamp`, `addCamp` | `submitActivity`, `addActivity` |
| Table: `user_camps` | saved-camp shortlist | renamed to `user_activities` or `catalog_entries` (separate migration; see §Migration sequencing) |
| Routes: `/camps/*` if any, `/explore/*` | camp-specific / discovery-framed | `/catalog/*` (done) + `/activities/*` naming for future detail routes |
| Brand: "Kidtinerary" | unchanged | unchanged — the name is already generic-to-kids |

### `activity_type` taxonomy (new field)

One value per activity, inferred by LLM at extraction time or user-selected
at manual entry:

| Value | Shape | Typical reminders |
| --- | --- | --- |
| `camp` | Week-long or multi-week session, specific dates, registration window | registration_opens, first_day, payment_due |
| `class` | Weekly recurring over a semester/term, has start+end | semester_start, form_deadline, payment_due |
| `lesson` | Ongoing 1:1 or small-group, often evergreen (swim, piano) | payment_due, schedule_change |
| `league` | Season-bounded team sport with recurring practices + games | registration_opens, season_start, game_day |
| `workshop` | Single day or short series, one-off | first_day, registration_closes |
| `program` | Long-running structured (scouts, 4-H) | payment_due, meeting reminders |
| `club` | Informal recurring (chess club at school) | meeting reminders |
| `other` | Fallback | custom only |

**This is distinct from `categories` (topics)** — which already exists as an
array column. Categories are what the activity is *about* (STEM, sports,
music, outdoors, animals). `activity_type` is how it's *structured*. Both
filters show in the Catalog. See DQ6 in the companion doc.

### Migration sequencing (recommended)

1. **Add `activity_type` column** to `activities` table with a sensible
   default (`camp`, to preserve current behavior). Backfill existing rows;
   LLM can re-infer for user-submitted camps on next edit.
2. **UI refactor in parallel** — rename components, copy, routes.
   `/explore` → `/catalog` route rename completed 2026-04-24 (`src/app/catalog/`,
   `src/components/catalog/`, `tests/components/catalog/`, all internal route
   pushes, nav label, email CTA). No redirect from `/explore` — the old route
   is gone and there were no meaningful external bookmarks yet.
3. **Rename `user_camps` table** as a later migration once the UI is
   fully decoupled. Until then, alias internally.
4. **LLM extractor update** — add `activity_type` to the extraction schema;
   prompt-engineer to classify.
5. **Reminder trigger types** gain `semester_start`, `season_start`,
   `game_day`, `schedule_change` over time. None are P0-blocking.

This is a naming + IA refactor, not a product rebuild. Most of it is
find/replace plus a few new enum values. Biggest risk is missing a copy
string; set up a lint rule or grep gate in CI to prevent "camp" from
leaking back into user-facing copy (with an allowlist for contexts where
it's accurate).

---

## Guiding principles (philosophy lock-in)

1. **Capture-first.** Every surface that accepts activity info should accept
   every format: URL, text paste, receipt, manual entry, forwarded email.
   Friction on capture is the only real churn risk.
2. **Personal tool, not a social network.** Busy parents will not return to
   another destination app. Social value flows through text and email,
   not through an in-app feed.
3. **Durable and year-aware.** The rolodex spans the kid's lifetime. Past
   summers, recurring camps, old favorites — all queryable. Year-over-year
   memory is the moat.
4. **Nudges beat logins.** The product's single highest-stakes surface is the
   outbound reminder (SMS/email/push). If reminders are great, parents never
   churn. If reminders are mediocre, nothing else matters.
5. **Don't build what Google already does.** Explicitly not building:
   discovery SEO pages, comprehensive camp catalogs, licensing databases,
   staff-verified public pools.
6. **The LLM extractor is a capture tool, not a moat.** Its job is to turn
   any pasted URL/text into a clean rolodex card in <5 seconds. It is not
   building a public dataset.
7. **Sharing is outbound.** The primary share action is "send this to a
   friend via the channel they already use." Inbound sharing (receiving a
   friend's list) is supported but is not the growth story.

## Non-goals (explicit)

These are not failures to reach — they are conscious exclusions.

- ❌ Comprehensive public camp catalog
- ❌ SEO landing pages per city / ZIP / category
- ❌ Staff-verified provider directory
- ❌ Activity reports / moderation pipeline for community data (kill the
  `activity_reports` table direction)
- ❌ In-app social feed of what friends are doing
- ❌ In-app registration / checkout / payment (always link out to provider)
- ❌ Provider-side SaaS (Winnie's model — different company)
- ❌ Commission / marketplace fees on bookings (Recess's model)
- ❌ Transportation / carpool coordination (at least not in Phase II)
- ❌ Packing lists (punted)
- ❌ Parent-to-parent in-app messaging

## What we keep (do not break)

- **Week × kid planner matrix.** The strongest part of the product. Keep the
  drag-drop, color coding, registration-status enum, cost fields, non-camp
  blocks.
- **Multi-kid household.** 1 parent → N kids is the core unit.
- **LLM URL extractor pipeline** (`src/scraper/adapters/llm-extractor.ts`).
  Keep the infrastructure. Reframe the purpose: capture UX, not data moat.
- **Structured form + URL submit paths** from the current branch work.
- **Reminders schema** (`reminders` table). Currently stubbed — becomes
  critical path in Phase II.
- **Token-based read-only share links** (`shared_schedules`). Works fine as
  the outbound sharing primitive.
- **Weekly × kid matrix structure.** The visual grid is good — what
  changes is only the date range behind it (see below).

## What we change

| Area | Current direction | Phase II direction |
| --- | --- | --- |
| `/catalog` page (renamed from `/explore` on 2026-04-24) | Placeholder for future discovery UI | **Activity Catalog** — searchable view over the parent's *own* lifetime rolodex (past + present + considering). Not a public pool. |
| `shared=true AND verified=true` autocomplete filter | Gating discovery, currently empty pool | **Remove or soft-keep.** Autocomplete pulls from the parent's own rolodex + anything friends have explicitly shared inbound. No staff verification needed. |
| Staff verification workflow | In-flight, UI not built | **Kill.** Don't build it. Trust model is "the parent saved this" or "a friend I accepted a list from saved this." |
| Activity reports / moderation | Table exists in schema | **Kill.** No community pool = nothing to moderate. |
| Notes per camp | Not in schema today | **Add.** First-class `notes` text field on `user_camps` (or equivalent). Rolodex without notes isn't a rolodex. |
| Reminders | Schema only | **Build the full loop** — triggers, scheduling job, delivery (email first, SMS second, push third), snooze, mark-done. |
| Capture surfaces | Form + URL modal | **Expand to 4 capture paths**: URL paste, text/email paste (LLM-extract from unstructured text), manual entry, iOS share-sheet (Phase II.5 if feasible). |
| Sharing | Token read-only URL | **Add outbound share-sheet action** on camp detail drawer + planner week view ("Send to a friend" → prefilled SMS/email body with the share link). |
| Activity types | Schema is generic; UI is camp-centric | **Pivot primary noun from "camp" to "activity"**; camp becomes one value in a new `activity_type` enum. See "Naming overhaul" section above. |
| Planner date range | Hard-coded 90-day span (summer-shaped) | **User-selected window** — parent picks start + end dates (default: summer season). Weekly matrix structure unchanged. Multiple planners per user already allowed by schema (`is_default` is per-user but not unique). |
| Landing page (`src/app/page.tsx`) | Summer/camp-centric, co-parent-coordination framing, "Explore camps" as a disabled CTA | **Rewrite to reflect Phase II thesis** — generic activity vocabulary, Catalog/Plan/Remind/Share pillars, SMS-first framing, enabled Catalog CTA. See §"Landing page copy rewrite" below. |
| "Child" in code/UI | Mixed | **"Kid" everywhere** per project voice rule. Schema column names can stay. |

## Phase II scope — prioritized

### P0 — Core Phase II (this overhaul)

1. **Rolodex as first-class concept.** Rename/re-IA `user_camps` surfaces to
   "My Rolodex" (or product-equivalent term — see Open Question 4). Show all
   saved activities regardless of planner assignment. Filter by kid, status,
   season, year.
2. **Notes field on saved activities.** Rich text (or markdown) per saved
   activity. This is the memory layer.
3. **Year-over-year memory.** See Open Question 2. At minimum: a saved
   activity persists past its session dates, and can be re-activated next
   year with one click ("Add Pine Hill Nature Camp to Summer 2027").
4. **Expanded capture.** Add a paste-anything modal: user pastes text (email
   body, SMS screenshot OCR later, free-form notes) → LLM structures it →
   parent confirms → saved to rolodex. URL path already exists and stays.
5. **Reminders loop, end to end.** Trigger types: `registration_opens`,
   `registration_closes`, `payment_due`, `first_day`, `form_deadline`,
   `custom`. Delivery: email (P0), SMS (P0 or P1), push (P1+). UI: list of
   active reminders per kid, snooze, mark done.
6. **Outbound share action.** One tap on any saved activity → iOS/Android
   share-sheet with prefilled message + the read-only token link. No
   recipient needs a Kidtinerary account to view.
7. **Onboarding capture step.** Optional step: "Paste any emails, texts, or
   links about activities you're considering." LLM extracts everything
   mentioned → pre-populates rolodex. Skippable. See Open Question 3.
8. **Activity Catalog page** (`/explore` rename). Searchable view of the
   parent's own lifetime rolodex. Filters: kid, season, year, status,
   organization, notes-contain. This is the "remember what I did last year"
   surface.

### P1 — Next, after P0 ships

- SMS reminder delivery (if P0 ships email-only)
- iOS share-sheet inbound capture (tap share on a camp website → Kidtinerary
  appears → saves with LLM extraction)
- Recurring-activity support (soccer every Tuesday, not a dated session)
- Inbound shared-list ingestion ("a friend sent you this list of 3 camps;
  add any to your rolodex with one tap")
- Cost rollup dashboard (total spent this summer, per kid, per season)
- Forms/deadlines tracker as a distinct reminder subtype with document
  attachment

### P2 — Later, not before real signal

- Push notifications (native app or PWA question first)
- Household with multiple editing parents (co-parent)
- Email-to-Kidtinerary capture address (`capture@user.kidtinerary.com`)
- Gmail / Apple Mail integration for automatic receipt capture
- Budgeting / projected-cost view for planning next year

## Landing page copy rewrite

The current landing page at `src/app/page.tsx` is the single most visible
Phase II mismatch — it frames Kidtinerary as a summer-camp co-parenting
coordination tool, which contradicts the overhaul on three dimensions
(camp-centric, co-parent-centric, summer-centric). It must ship with
Phase II, not after.

### What's currently there

| Element | Current copy |
| --- | --- |
| Headline | "Plan your kids' time off, together." |
| Subhead | "Lay out every camp, class, and off-school week on one timeline — then share it live with co-parents, sitters, and the friends coordinating alongside you." |
| Primary CTA | "Build a planner" |
| Secondary CTA | "Explore camps" (disabled, "Coming soon") |
| Pillar 1: Save | "Catalog the camps you love or want to try." |
| Pillar 2: Plan | "Every kid's camps, classes, and off-weeks on one timeline." |
| Pillar 3: Share | "Send a live link to co-parents, sitters, and grandparents." |
| Pillar 4: Coordinate | "Line up weeks with the friends planning the same summer." |

### What's wrong with it (in the Phase II lens)

1. **"Time off" and "the same summer"** frame the product as seasonal; Phase
   II pivots to year-round.
2. **"Together"** and the co-parent / sitter / grandparent framing push a
   collaboration story that isn't the P0 reality (co-parent editing is P2).
3. **"Camps"** as the dominant noun contradicts the camp-→-activity pivot.
4. **"Explore camps"** as a disabled CTA promises a discovery feature that
   is explicitly being cut.
5. **No reminders pillar at all** — SMS nudges are the highest-stakes
   product surface and are invisible here.

### Proposed rewrite

| Element | New copy |
| --- | --- |
| Headline | **"Every activity your kid does, in one place."** |
| Subhead | **"A personal catalog of every camp, class, lesson, and sport — past, present, and considering. With a text when it's time to sign up, pay, or show up."** |
| Primary CTA | **"Start your Catalog"** |
| Secondary CTA | **"Build a planner"** (currently primary; demoted to secondary) |
| Pillar 1: Capture | **"Paste a link, forward an email, or type it in — any activity lands in your Catalog in seconds. Kept year over year."** |
| Pillar 2: Plan | **"Arrange every kid's camps, classes, and lessons on one timeline — from one summer to the full school year."** |
| Pillar 3: Remind | **"SMS reminders when registration opens, payment is due, or the first day approaches. Never miss a window."** |
| Pillar 4: Share | **"Text any activity to a friend with one tap. They save it with one more."** |

### Rationale for each change

- **Headline.** "Every activity" signals breadth (not camps). "In one place"
  signals the Catalog/rolodex concept. "Your kid" keeps the project's
  voice rule ("kid" not "child" per `MEMORY.md`).
- **Subhead.** Lists all four activity types explicitly to communicate the
  generic-not-camp shift. "Past, present, considering" teases year-over-year
  memory. Closes with the SMS nudge framing.
- **Primary CTA.** Catalog leads because it's the entry point — a user with
  no saved activities can't plan anything yet. "Start your Catalog" is
  activating; "Build a planner" is intimidating for a new user with nothing
  to plan.
- **Four pillars.** Capture → Plan → Remind → Share maps directly to
  the Phase II mission's three pillars (Catalog, Planner, Nudges) plus the
  sharing interop layer. "Plan" keeps its own pillar because the planner is
  Kidtinerary's strongest existing differentiated feature — the week × kid
  matrix that no competitor has. The year-over-year memory story lives in
  the Capture pillar's closing line ("Kept year over year") rather than as
  its own pillar; it's a *property* of the Catalog, not a separate surface.
  The previous "Coordinate" pillar (friends planning the same summer) gets
  cut because it contradicts the "not a social platform" principle.
- **Voice/tone.** Stays in the existing typography and all-caps label
  pattern per the project's feedback rules (`feedback_keep_existing_caps_labels.md`).
  The existing display font + ink color system doesn't need to change.

### Secondary changes needed on the page

- **Remove the "Coming soon" pill on the secondary CTA** — it references
  the killed explore/discovery direction.
- **Wire the "Start your Catalog" CTA** to `/catalog` (once that route
  exists — see §Migration sequencing).
- **Add a phone-number capture** above the fold if we want to start
  warming leads before SMS onboarding is fully built. Optional; not
  blocking.
- **No hero image currently** — no change, but if one is added later,
  bias toward a screenshot of a populated Catalog, not a marketing
  illustration.

### What to NOT change

- The page's minimal aesthetic and typography treatment. The feedback
  memory explicitly calls out preserving existing caps/tracking; this
  rewrite respects that.
- No colored side borders per `feedback_no_colored_side_border.md`.
- No new nav or footer work in this pass.

---

## Data model implications

Concrete schema work implied by the plan. Not a migration plan — a heads-up
for whoever picks this up.

**Additions:**

- `activities.activity_type` (enum: `camp` | `class` | `lesson` | `league` |
  `workshop` | `program` | `club` | `other`) — default `camp` during
  backfill, LLM re-infers on edit. This is the big new taxonomy field.
- `activities.schedule_type` (enum: `one_off` | `recurring` | `evergreen`) —
  orthogonal to activity_type. A lesson can be evergreen; a camp is
  usually one_off.
- `activities.recurrence_pattern` (jsonb, nullable) — `{"days_of_week":
  ["tue","thu"], "time": "16:00", "starts": "...", "ends": null}`
- `user_camps.notes` (text, nullable) — the rolodex memory field
- `user_camps.first_added_at` and `user_camps.last_interacted_at`
  (timestamps) — for year-over-year surfacing
- `user_camps.archived_at` (nullable timestamp) — soft-archive for past
  activities without deleting
- `reminders` table: confirm the existing fields cover all P0 trigger types;
  add `delivery_channel` enum (`sms` | `email` | `push`, default `sms`) and
  `delivered_at` per channel if not present
- `profiles.phone_e164` (text, unique), `phone_verified_at`, `sms_opted_out`
  (boolean), `default_reminder_channel` enum
- New table: `share_events` — see companion doc for shape

**Renames (separate migration, after UI decoupling):**

- `user_camps` table → `user_activities` or `catalog_entries`. Defer until
  UI is fully decoupled from the `user_camps` name; alias in code in the
  interim.

**Reframings:**

- `activities.source` enum: keep `user` and `curated`, but deprioritize the
  verification flow around `curated`. Future community-catalog work, if ever
  revisited, starts from a different premise.
- `activities.shared` / `activities.verified` flags: keep columns (no cost
  to leave), stop building UI around them
- `entity_source`: keep as-is

**Deletions / deprecations:**

- `activity_reports` table — mark as deprecated in code, no new writes, don't
  render in UI. Drop in a later migration after a cooling period.
- Any half-built staff-verification admin surfaces — remove from routing.

**Untouched:**

- `planner_entries`, `planner_blocks`, `children`, `profiles` — no changes
  needed for Phase II
- `activity_locations`, `sessions`, `price_options` — schema already
  supports the rolodex model

## Success metrics (leading indicators)

Phase II ships well if, 60 days post-launch:

- **Time-to-first-save < 60 seconds** from signup (measures capture friction)
- **% of users with a note on ≥ 1 saved activity > 40%** (measures rolodex
  adoption)
- **% of reminders delivered that lead to a click-back within 48h > 25%**
  (measures reminder quality — the single highest-stakes metric)
- **Saves per active user per week > 2** during peak planning seasons
- **Year-1 retention (return next registration window) > 40%**

These are targets, not predictions. First real numbers calibrate them.

## Out of scope for Phase II — on the radar for Phase III+

- Native mobile app (PWA first; native only if P2 signal strong)
- Co-parent / household-shared editing (real multi-user)
- Any form of monetization — free through Phase II. Revisit after usage signal.
- School calendar integration (pulling school holidays into the planner)
- Provider integrations (official "this camp is on Kidtinerary" badge)

## Open Questions — need founder input

These are genuine forks; the doc assumes a direction but calls out the
decision.

### OQ1 — Activity Catalog scope — RESOLVED 2026-04-24

The **Catalog** (formerly `/explore`) is a **parent-generated, personal rolodex**
fed from three distinct capture paths:

1. **Personal search capture** — parent finds something on the web (Google,
   provider site, newsletter) and pastes a URL, receipt text, or manual entry.
2. **Friend-sourced capture** — either (a) a friend texts a raw link, which
   the parent pastes in (same as #1), or (b) a friend shares a Kidtinerary
   activity via text share-sheet → recipient clicks the link → one-tap "add to
   my Catalog."
3. **Known / recurring / evergreen activity capture** — the parent types in
   something they already know ("Max does Tuesday swim at the Y"), with no
   source URL. First-class support for recurring/evergreen schedules.

All three paths land in the same Catalog. Provenance is tracked on the saved
item (for later UX like "your friend Alice saved this") but is never a
segregating filter.

See companion deep-dive for flows, schema, and recipient experience.

### OQ2 — Year-round vs summer-centric — PARTIALLY RESOLVED 2026-04-24

**(a) Planner date range — RESOLVED.** The planner becomes **generic across
any time window**. Parent picks start + end dates (default: the current
summer season, or whatever the last one they used). Weekly × kid matrix
structure stays; only the range behind it changes. Multiple concurrent
planners per user are allowed (the schema already supports this — no
single-default constraint). Example: a parent can have a "Summer 2026"
planner and a "Fall 2026 school year" planner active at once.

**(b) Recurring / evergreen activities — RESOLVED.** Yes, first-class.
Handled via an `activity_type` enum and an optional `recurrence_pattern`
jsonb (see companion doc, Path 3). Evergreen activities render as a
standing rail above the planner matrix, not as individual week cells.

Remaining micro-question: should the planner default to the user's last-used
window, or to "right now + next 12 weeks" on each open? My bias: last-used
window is the better default once a user has one saved. Punt.

### OQ3 — Onboarding capture step — optional vs required
Doc says optional. Alternative: make it a required-but-skippable step (parent
sees the value prop before skipping). The difference is activation-rate vs
rolodex-seeded-rate. Which do we optimize for?

### OQ4 — Rolodex naming in UI
"Rolodex" works internally but may feel dated to younger parents. Candidates:
**My List**, **My Activities**, **My Catalog**, **My Kidtinerary**,
**Saved**, **My Rolodex**, **My Library**. Preference?

### OQ5 — Reminders delivery channel at P0 — RESOLVED 2026-04-24

**SMS first, email secondary.** People don't check email at the moment a
registration window opens; they do check texts. This decision has three
downstream implications that become P0 work:

1. **Phone is the primary identifier.** Phone verification is required during
   onboarding (not optional). Email stays as a secondary channel + fallback.
2. **SMS infrastructure in P0.** Twilio (or equivalent) integration, A2P 10DLC
   brand registration, opt-in/opt-out compliance (TCPA). Not trivial but not
   blocking.
3. **The friend-share mechanic becomes more powerful.** Because phone is the
   identifier, when Alice shares an activity to Bob's number, Kidtinerary can
   detect that Bob is already a user and surface a one-tap "add" action. If
   he's not, the signup flow can be phone-first and pre-populate his Catalog
   with the activity Alice shared. See companion doc for details.

Email stays as a genuine second channel (not just a fallback), and remains
the only channel for users who explicitly opt out of SMS.

### OQ6 — Inbound shared-list ingestion in P0 or P1
Outbound share is P0. Inbound ("Alice sent me 3 camps; add them to my
rolodex") is currently in P1. It's only valuable if outbound gets meaningful
use. If P0 outbound share-sheet is shipped and we see real usage, ship
inbound fast. Confirm P1 is acceptable?

---

## Appendix — what this plan implicitly rejects

Documented for future founders / advisors who may revisit:

- The "Campwing-but-everywhere" play — comprehensive LLM-scraped camp catalog.
  Rejected because (a) Campwing is 18 months ahead in 3 metros and still not
  comprehensive, (b) summer-camp long tail is structurally uncatalogable,
  (c) this would mean competing on SEO with Winnie, which has a 250K-provider
  head start.
- The "marketplace with transaction fees" play. Rejected because (a) requires
  provider density Kidtinerary will not have for years, (b) Recess's bet on
  this is well-funded and in the same lane, (c) it conflicts with
  "capture-first" positioning — parents already have booking flows.
- The "social network for parents" play. Rejected because (a) busy parents
  will not return to another destination app, (b) Nextdoor / Peanut-style
  engagement loops require moderation investment that conflicts with "personal
  tool" positioning.

---

## Document status

Next step: founder answers Open Questions 1–6. Post-sign-off, this doc
becomes the source of truth for planning ticket breakdowns and is
referenced from CLAUDE.md / AGENTS.md.
