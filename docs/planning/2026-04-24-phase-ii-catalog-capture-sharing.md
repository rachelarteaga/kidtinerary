# Kidtinerary Phase II — Catalog, Capture, and Sharing

Date: 2026-04-24
Status: Companion deep-dive to the Phase II overhaul plan.
Parent doc: [2026-04-24-phase-ii-rolodex-overhaul.md](./2026-04-24-phase-ii-rolodex-overhaul.md)

**Naming convention in this doc:** "Activity" is the primary noun throughout.
"Camp" is one value of `activity_type`, not the core concept. See the parent
doc's "Naming overhaul" section for the full pivot rationale and migration
sequencing.

This doc is the "beyond planner" polish — the three pillars that make
Kidtinerary more than a scheduler: the **Catalog**, the **capture paths**
that feed it, and the **sharing + reminders** loops that keep it active.

---

## The thesis, one sentence

> Parents don't need a bigger catalog of activities — they need a personal one,
> that captures anything from anywhere, remembers across years, nudges at the
> right moment via the channel they actually check (SMS), and shares with
> friends through the channels they already use (text).

---

## 1. What the Catalog is

The **Catalog** is the parent's personal, lifetime rolodex of kid activities.
It lives at `/catalog` (route renamed from `/explore` on 2026-04-24). It is
not a public directory, not a discovery engine, not a search index of camps
in the world. It is *your* catalog, of things you've saved, considered, done,
or are doing.

### What lives in the Catalog

Every saved activity, from any source, of any schedule shape. Specifically:

- **One-off sessions** — "Pine Hill Nature Camp, Week of July 7, 2026"
- **Recurring program runs** — "Fall soccer at Palo Alto YMCA, Sept–Nov 2026"
- **Evergreen / ongoing activities** — "Tuesday/Thursday swim lessons at the
  Y, no end date"
- **Activities under consideration** — saved but not yet signed up for
- **Historical activities** — completed or archived, kept for year-over-year
  memory

### Information architecture

Default view on `/catalog`:

- **Primary tabs (by kid):** "Max" / "Lila" / "All"
- **Secondary status tabs:** "Active" (ongoing/upcoming) / "Considering" /
  "Archive"
- **Search bar:** searches name, org, notes, location — across all years
- **Filters (collapsible):**
  - **Activity type** — camp, class, lesson, league, workshop, program,
    club, other (from `activities.activity_type`; single-select or multi)
  - **Topic** — STEM, arts, sports, music, outdoors, animals, academic,
    etc. (from `activities.categories`; multi-select)
  - **Year, season, organization, schedule type** (one-off / recurring /
    evergreen), price range, location
- **Sort:** most recent activity / start date / alphabetical / times repeated

**Two orthogonal taxonomies — worth naming explicitly:**

| Taxonomy | Column | Values | Answers |
| --- | --- | --- | --- |
| `activity_type` | single enum | camp, class, lesson, league, workshop, program, club, other | *How is this activity structured?* |
| `categories` (topics) | string array | STEM, sports, arts, music, outdoors, animals, academic, language, nature, science, etc. | *What is this activity about?* |

A rock-climbing summer camp has `activity_type = 'camp'` and
`categories = ['sports', 'outdoors']`. A Tuesday piano lesson has
`activity_type = 'lesson'` and `categories = ['music', 'arts']`. Both
filters are useful independently, so we keep them independent.

### The views

1. **Default view — "Current & upcoming."** Everything with a session date
   in the future or an evergreen activity flagged active. This is the
   answering-the-door view: "what's going on in my kid's life right now."
2. **Considering view.** Things saved but not yet on the planner. This is
   the shortlist — what you're weighing.
3. **Archive view.** Everything past. Most useful for the "do I want to do
   this again" moment before next year's sign-up window.
4. **Year view** (filter-driven). "Max, Summer 2025" shows the full rolodex
   for that kid × season × year. Year-over-year memory lives here.

### Why this beats a public catalog

A public catalog's value comes from breadth (more camps listed = more
valuable). A personal catalog's value comes from **depth per entry** (notes,
history, cost, who recommended it, what the kid thought) and **compounding
over time** (year 3 is 3x more valuable than year 1). Breadth is a commodity
race you will lose; depth + time compounding is a moat that gets stronger
with every saved item.

---

## 2. Capture — three paths converging on the rolodex

All three paths produce the same type of record — a Catalog entry — but
differ in friction, metadata, and UX affordances. The rule: **the slowest
path should take less than 10 seconds.**

### Path 1 — Personal capture

The parent found something themselves (web search, newsletter, flyer,
bookmark). They bring it into Kidtinerary.

**Sub-paths:**

| Input type | UX | Backend |
| --- | --- | --- |
| URL paste | Existing — `/submit` style modal; user pastes, LLM extractor fires, drawer shows extracted fields for confirmation | `llm-extractor.ts` URL mode |
| Text paste (email body, free-form description) | NEW — same modal, accepts raw text; LLM extracts structured fields | `llm-extractor.ts` text mode (new adapter config) |
| Booking receipt paste | Subset of text paste; prompt-engineered to pull out session dates, amount paid, registration confirmation number | Same text adapter, metadata flag |
| Manual entry | Existing — structured form: org + name + optional URL. Phase II adds schedule type and kid association | Direct insert, no LLM |
| iOS / Android share-sheet | P1 — tap share on any webpage → Kidtinerary appears → LLM extracts in background | Deep link + background job |

**Design principle:** all sub-paths land in the same confirmation drawer.
The drawer is "trust the draft, one tap to save" — not a form to fill out.

### Path 2 — Friend-sourced capture

A friend shared something. The parent captures it.

**Path 2a: Friend texts a raw link.**
Identical to Path 1 URL paste — the parent copies from their message thread
and pastes into Kidtinerary. Kidtinerary doesn't need to know the link came
from a friend. This path is not a product feature; it's just: don't break
URL paste.

**Path 2b: Friend shares a Kidtinerary activity via the in-app share.**
This is the interesting one. Flow:

1. Alice is in Kidtinerary, on a Catalog entry for "Pine Hill Nature Camp."
2. Alice taps **Share** → native iOS/Android share-sheet with prefilled SMS
   body: *"Thought you'd love this for the kids: [link]"* + a Kidtinerary
   short link.
3. Alice picks Bob from her contacts, sends.
4. Bob receives the text, clicks the link.

Bob's experience depends on whether his phone is already on Kidtinerary:

- **If Bob is a Kidtinerary user** (phone matches a verified account):
  the link opens Kidtinerary directly to a preview of the activity with a
  prominent **Add to my Catalog** button. One tap → it's in his rolodex.
  Provenance is recorded: "saved from Alice, 2026-04-24."
- **If Bob is not a user:** the link opens a clean preview page (activity
  name, org, key details, link to the provider site) with a **Save this
  to Kidtinerary** CTA. Signup is phone-first (SMS verification). On
  verified signup, the activity auto-saves to Bob's new Catalog. His
  Catalog is not empty on day one.

This is the entire social loop: **one-tap SMS out, one-tap save in, no
feed, no friendship graph, no persistent shared list.** The recipient
either finds it valuable or they don't; either way no future interaction
is expected.

### Path 3 — Known / recurring / evergreen capture

"Max has been doing Tuesday/Thursday swim at the Y forever."

This is an activity with no source URL, no registration deadline, no end
date — just a standing commitment. Neither Campwing nor Winnie nor Recess
model this cleanly.

**UX:** a "+ Ongoing activity" quick-add on the Catalog page. Feels like
adding a reminder in Apple Reminders — <5 second interaction.

Fields (minimum):
- Activity name (required) — "Swim lessons"
- Organization (optional) — "Palo Alto YMCA"
- Kid(s) (required, multi-select)
- Schedule type (required, default: evergreen) — evergreen / recurring with
  end date / ongoing-until-cancelled
- Days of week (optional) — Tue, Thu
- Time (optional) — 4:00 PM
- Notes (optional)
- Cost (optional) — "$120/mo" or "$2400/year"

**Schema implication:** a new `schedule_type` enum on the activity or on
the saved entry. One-off sessions continue to use the existing `sessions`
table. Evergreen activities skip the sessions table entirely (or have a
single open-ended "session" with nullable end_date).

**Planner treatment:** evergreen activities appear as a standing rail on
the planner matrix ("every Tuesday: swim") rather than occupying a specific
week cell. Unobtrusive, always visible.

**Why this matters:** it's the single feature that extends Kidtinerary's
audience from "parents planning summer" to "parents managing year-round life."
Adds huge usage frequency. Moves Kidtinerary from a seasonal tool to a weekly
tool. And neither competitor handles this — a real gap.

---

## 3. Sharing — outbound primitives only

### What we build (P0)

**Single-activity share via SMS.** On any Catalog entry, Share button →
native share-sheet → prefilled SMS with a Kidtinerary short link. That's it.

### What the recipient gets

A link that opens to a lightweight preview page:

```
[Activity photo if available]

Pine Hill Nature Camp — Week of July 7
Hosted by Pine Hill Outdoor School
Ages 6–10 · $650/week · Palo Alto, CA

[Visit Pine Hill's site →]

────────────────────────

Shared with you by Alice through Kidtinerary.
[Save this to my Catalog]    [What's Kidtinerary?]
```

If the recipient is a Kidtinerary user, Save is a one-tap action.
If they're not, Save triggers a phone-first signup, and the activity is the
first thing in their Catalog.

### What we don't build in Phase II

- Shared persistent lists ("Alice's Summer 2026 Picks")
- In-app messaging between parents
- Friends list / contacts integration inside the app
- Notifications of what friends just added
- Shared household editing (co-parent collaboration — this is a separate
  problem and a separate P2 initiative)
- Group planning ("we're looking for a camp our kids can do together")

All of these are tempting. None of them survive the "busy parents won't
return to a second destination app" principle from the parent doc.

### The inbound share inbox — deferred to P1

If outbound SMS share sees meaningful usage, build a "Shared with you"
Catalog tab — a queue of activities other people have sent you that you
haven't yet saved or dismissed. Don't build it pre-signal.

---

## 4. SMS-first reminders

### Trigger types (P0)

| Trigger | When it fires | Default channel | Fallback |
| --- | --- | --- | --- |
| `registration_opens` | 24h before + at open time | SMS | Email |
| `registration_closes` | 48h and 6h before close | SMS | Email |
| `payment_due` | 72h and 24h before due | SMS | Email |
| `first_day` | 48h before, 7am day-of | SMS | Email |
| `form_deadline` | 7 days and 48h before | Email | — (forms are less urgent, don't be annoying) |
| `custom` | user-defined | SMS default, user-selectable | Email |

**Design principle:** SMS is for **time-urgent, action-required** moments.
Email is for **informational or low-urgency** reminders. Never both for the
same reminder unless SMS fails delivery.

### Delivery implementation notes

- **Provider:** Twilio Programmable Messaging is the standard choice.
  Alternative: MessageBird, Plivo. Pricing is ~$0.008/SMS in the US, so
  at ~5 reminders/user/month this is a few cents per active user per month.
- **Compliance:** A2P 10DLC brand + campaign registration is required for
  reliable US SMS delivery to consumer phones. Needs to be done before
  launch; takes 1–3 weeks for approval. Cost: ~$50-200 in registration
  fees plus per-message surcharges.
- **Opt-in:** phone verification during onboarding doubles as opt-in.
  Include clear opt-out language in first SMS ("Reply STOP to opt out").
- **Sender identity:** use a short code or a long code with verified
  brand name. Long code is cheaper and faster to set up; short code is
  better for volume.
- **Deliverability:** monitor bounce/fail rates; auto-fallback to email
  on 2 consecutive SMS failures to the same number.

### UI implications

- Onboarding: phone verification step (required). Email is still captured
  but secondary.
- Per-kid reminders page: list of active reminders with snooze / mark-done /
  edit-channel.
- Opt-out: both global (no SMS from Kidtinerary) and per-reminder-type
  (no payment SMS, only registration SMS).

### What not to build in P0

- Push notifications (require PWA install flow or native app — too much
  for P0; revisit in P1 when signal shows which platform wins)
- Calendar event creation (nice-to-have but the reminder is the action;
  adding a .ics invite is extra surface area without much lift)
- Smart send-time optimization — just send at configured times; iterate
  based on usage data later

---

## 5. Schema implications (incremental, not a migration plan)

### `profiles`

- `phone_e164` (text, unique) — primary identifier, verified via SMS OTP
- `phone_verified_at` (timestamptz)
- `sms_opted_out` (boolean, default false) — respects STOP replies
- `default_reminder_channel` (enum: `sms` | `email`, default `sms`)

### `activities`

- `activity_type` (enum: `camp` | `class` | `lesson` | `league` | `workshop`
  | `program` | `club` | `other`) — the new primary taxonomy; default `camp`
  for backfill. LLM extractor should infer this at ingest time.
- `schedule_type` (enum: `one_off` | `recurring` | `evergreen`) — orthogonal
  to activity_type. A lesson can be evergreen; a camp is usually one_off.
- `recurrence_pattern` (jsonb, nullable) — `{"days_of_week": ["tue","thu"],
  "time": "16:00", "starts": "2026-09-01", "ends": null}` — nullable for
  one-off activities. Only relevant when schedule_type ≠ `one_off`.

### `user_camps` (to be renamed `user_activities` or `catalog_entries`)

- `notes` (text, nullable) — the rolodex memory field
- `first_added_at`, `last_interacted_at`, `archived_at` — for year-over-year
  surfacing and soft-archive
- Table rename deferred until UI is fully decoupled from the
  `user_camps` name. Alias internally in the interim.

### Share events

New table: `share_events`

- `id` uuid
- `sharer_user_id` uuid → `auth.users`
- `shared_entity_type` text (initially always `'activity'`)
- `shared_entity_id` uuid
- `short_link_token` text (unique, public)
- `recipient_phone_hash` text (nullable, optional for analytics — hash the
  recipient number, don't store plaintext)
- `created_at` timestamptz
- `opened_at` timestamptz (nullable) — set when link is first clicked
- `saved_by_user_id` uuid (nullable) — set when recipient saves the activity

This supports: analytics on share → open → save conversion, link expiration
if needed, and attribution ("Bob saved this from Alice").

### Reminders

Existing `reminders` table expands:

- `channel` (enum: `sms` | `email` | `push` | `calendar`) — currently
  implied; make explicit
- `delivered_at` + `delivery_status` per attempt (create `reminder_deliveries`
  child table if retries matter)
- `trigger_type` adds `payment_due`, `first_day`, `form_deadline` if not
  present

### Deletions

- `activity_reports` — mark deprecated per parent doc; drop after cool-off
- Any half-built staff verification UIs

---

## 6. Interaction between pillars

This is where the design decisions compound:

| Interaction | How it works |
| --- | --- |
| Catalog + Capture | Catalog is fed by all three capture paths. Any entry can always be edited or augmented later. |
| Capture + Sharing | Every Catalog entry is shareable via the share-sheet, regardless of how it was captured. Evergreen activities are shareable too (schema just needs to accept them). |
| Sharing + SMS | Phone-as-identifier means Alice's share to Bob's number can route to his Kidtinerary account if he has one. No friend graph needed. |
| Sharing + Reminders | The recipient's saved copy gets its own reminders (tied to the recipient, not the sharer). Alice's reminder for Pine Hill doesn't silently extend to Bob. |
| Catalog + Reminders | Reminders are attached to Catalog entries. Archiving an entry suspends its reminders. |
| Catalog + Planner | One-off sessions from the Catalog are the things that appear on the planner. Evergreen activities appear as a standing rail above the weekly grid. Considering-status entries don't appear on the planner at all. |

---

## 7. What ships, in order

Within P0 (the Phase II overhaul), a rough sequence to de-risk integration:

1. **Schema groundwork**: `schedule_type`, `notes`, `phone_e164` column,
   `share_events` table.
2. **Phone verification in onboarding.** Gates everything SMS-related.
3. **Evergreen capture path.** Simplest of the three new paths; validates
   the schema change.
4. **Text-paste capture path.** Extends the existing LLM pipeline.
5. **Catalog IA rebuild.** Rename `/explore`, build views/filters.
6. **Outbound share-sheet action.** Depends on `share_events` and phone.
7. **Recipient preview page** (the shared link landing page).
8. **One-tap save for existing users.**
9. **SMS reminders pipeline** (Twilio + 10DLC + opt-in UI).
10. **Reminders UI** (list, snooze, mark-done).
11. **Recurring/evergreen rail on planner.**

This order assumes schema before UI, capture before retrieval, outbound
before inbound, and SMS infrastructure before its UI consumers. It is
not a sprint plan — it is a dependency graph.

---

## 8. Open design questions

### DQ1 — Recipient preview page: branded or utilitarian?
Should the preview page feel like a lightweight webpage (minimal branding,
link-out dominant) or a Kidtinerary marketing landing page (conversion CTA
dominant)? First is better UX for recipients. Second is better for growth.
My bias: lightweight for P0, measure conversion, add more conversion
surface if signal is weak.

### DQ2 — Should evergreen activities support "frequency without day-of-week"?
"Swim lessons once a week, usually Tuesday" is different from "every
Tuesday at 4 PM sharp." Do we model frequency as a guideline or a strict
schedule? My bias: model strict by default, with a "loose schedule" flag
that suppresses reminders for specific times.

### DQ3 — Cost tracking granularity
Current schema has `price_cents` per planner entry. For evergreen
activities, do we need "monthly cost" vs "per-session cost" vs
"per-semester"? How does annual cost roll-up work? Probably fine to punt
past P0, but worth naming.

### DQ4 — Share link permanence
Does the share link expire? If Alice shares something and Bob clicks it
6 months later, should it still work? My bias: short-link lives forever;
content update reflects current state of the activity in Alice's
Catalog (or shows "this activity is no longer available" if she archives
it and has share notifications on).

### DQ5 — Provenance display
When Bob saves an activity Alice shared, his Catalog entry can show "saved
from Alice." How prominent? A subtle badge? A note field? My bias: subtle
footer metadata on the detail view, not a visible filter. Don't make the
Catalog feel social.

### DQ6 — `activity_type` vs `categories` — RESOLVED 2026-04-24

**Keep them orthogonal.** `activity_type` answers "how is this activity
structured" (camp / class / lesson / league / etc.); `categories` answers
"what is this activity about" (sports / STEM / arts / etc.). A rock-climbing
camp has `activity_type='camp'` and `categories=['sports', 'outdoors']`.

Collapsing into one taxonomy is rejected because a parent searching for
"STEM camp" shouldn't also need a parallel filter for "is this a camp or an
afterschool class?" — that's a lossy conflation.

Edge case to watch: "sports" is both a topic and *sort of* a structure hint
(sports often implies leagues or teams). If this creates UI friction after
real usage, revisit — but don't preemptively conflate.

### DQ7 — LLM classification of `activity_type` at ingest
LLM extractor should propose `activity_type` from URL context. Parent
confirms in the drawer. If the LLM is wrong often enough, we either
prompt-engineer better or make the dropdown more prominent. No P0
blocker; just want telemetry on correction rate once it ships.

---

## Appendix — worked example

Rachel's Catalog after 14 months of Phase II usage (illustrative):

```
Max (8) ─────────────────────────────────────────────────
  Active:
    · [lesson] Tues/Thurs swim lessons (Palo Alto YMCA) — ongoing since 2024
    · [camp]   Pine Hill Nature Camp, Week of July 13 2026 — registered $650
    · [club]   Thursday coding club, Fall 2026 — considering, open Sep 1
  Considering:
    · [league] Jr Giants baseball — saved from Jenna, awaiting spring info
  Archive:
    · [camp]   Pine Hill Nature Camp, Week of July 8 2025 — "loved the
               counselors, Max cried when it ended. Same week next year
               if possible." $620
    · [41 more historical entries]

Lila (5) ─────────────────────────────────────────────────
  Active:
    · [class]    Monday ballet (Menlo Dance) — ongoing since 2025
    · [camp]     Little Dragons Week of June 15 — registered
  Considering:
    · [workshop] KidArt summer workshop — $300
  Archive:
    · [8 historical entries]

Reminders this week:
  · SMS Fri 8 AM: "Jr Giants registration opens Monday 9 AM"
  · SMS Sun 10 AM: "Pine Hill payment due Tuesday"
```

The `[type]` prefix in the example is just to make the mental model vivid;
in the real UI, activity_type probably renders as a small icon/pill rather
than a bracketed label.

This is what success looks like in Phase II. Not a feed. Not a marketplace.
A personal, durable, nudging tool.
