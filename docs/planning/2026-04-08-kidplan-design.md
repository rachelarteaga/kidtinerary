# Kidtinerary — Design Spec (formerly KidPlan)

**Date:** 2026-04-08
**Status:** Approved

## Overview

KidPlan is a local activity discovery and planning tool for parents of kids ages 3-12. It aggregates camp, class, and extracurricular activity data from across the Raleigh, NC area (30-mile radius) through broad, deep web scraping — solving the problem that no single source exists for this information today.

Parents can search, filter, and browse activities; build per-child schedules with a drag-and-drop planner; save favorites; get registration deadline reminders; and share plans with friends via simple links.

**What KidPlan is NOT:** It does not accept payment, handle registration, or serve activity organizers. It's a discovery and planning tool for parents. Registration happens on the camp/studio's own site via direct links.

## Target User

Parents of kids ages 3-12 in the Raleigh/Triangle area. The primary pain point: planning extracurricular activities is scattered across dozens of websites, text threads, and spreadsheets. KidPlan centralizes discovery and planning in one place.

## Product Name & Voice

**Name:** KidPlan

**Voice:** Warm, encouraging, conversational. An organized friend who already did the research. Not a database, not a tech platform.

**Key vocabulary:**
- "Penciled In" = considering/tentative status on planner
- "Locked In" = booked/confirmed status on planner
- Empty states use encouraging language: "Nothing penciled in for this week yet"
- Headlines are conversational: "This fall is going to be a good one"

## Design Aesthetic

Inspired by Trailborn Hotel and AutoCamp websites. Sophisticated outdoor hospitality meets playful kid energy. "Design-forward children's bookstore" — parents feel respected, kids feel invited.

### Color Palette

| Name       | Hex       | Usage                          |
|------------|-----------|--------------------------------|
| Cream      | #ECE8DF   | Base background                |
| Bark       | #2C261B   | Primary text                   |
| Sunset     | #E07845   | Primary CTA, energy moments    |
| Campfire   | #D4A574   | Secondary actions, warmth      |
| Meadow     | #5A8F6E   | Nature/success, category color |
| Lake       | #6B8CBB   | Schedule/calendar UI, info     |
| Driftwood  | #C4BFB4   | Muted text, borders            |
| Sand       | #F5E4C4   | Highlights, badges             |

### Typography

- **Headlines:** DM Serif Display — warmth, personality, editorial feel
- **Body:** Inter — clean readability
- **Labels/Data:** JetBrains Mono — monospace for ages, prices, distances. Uppercase, letterspaced.

### Design Principles

1. **Sophisticated Playground** — Design for the parent, delight the kid. Warm tones and playful touches (tilted icons, conversational headlines) without going cartoon.
2. **Color as Wayfinding** — Categories own their color. Green for nature, orange for arts, blue for schedule. Consistent, not decorative.
3. **Personality in the Copy** — "Your calendar is wide open" not "No events found."
4. **Density Without Clutter** — Camp cards pack real info (price, hours, age, distance, lunch, discounts) into a scannable layout. Whitespace is generous but purposeful.

### Anti-Slop Guardrails

**Avoid:** Primary-color cartoon aesthetic, clip art, Comic Sans/bubble fonts, gradient mesh blobs, blue/purple tech palettes, stock photos of smiling kids, emoji as visual design.

**Embrace:** Earth-tone palette with selective pops, slightly tilted/hand-placed elements, conversational copy, category color-coding, serif headlines, real content over placeholder art, playful empty states, scrapbook energy with editorial structure.

### UI Elements

- **Buttons:** Pill-shaped (border-radius: 999px), monospace labels, uppercase
- **Cards:** Soft border-radius (16px), cream background, muted shadows
- **Tags:** Color-coded by function — green for age, orange for category, blue for schedule
- **Category Icons:** Slightly rotated containers (transform: rotate(-3deg)), rounded-square shape, tinted backgrounds
- **Navigation:** Sticky header, minimal — Logo, Explore, My Planner, Favorites, My Kids, "Start Planning" CTA

## Tech Stack

- **Framework:** Next.js (App Router, Server Components)
- **Styling:** Tailwind CSS
- **Database:** Supabase (Postgres + PostGIS + Auth + Realtime)
- **Deployment:** Vercel
- **Scraping:** Node.js/TypeScript pipeline with Playwright + Cheerio
- **Email:** Resend
- **Geocoding:** Google Maps Geocoding API (cached per address)
- **Drag & Drop:** dnd-kit

## Data Model

### Organization
| Field       | Type    | Notes                    |
|-------------|---------|--------------------------|
| id          | uuid    | PK                       |
| name        | text    |                          |
| website     | text    | nullable                 |
| description | text    | nullable                 |

### Activity
| Field            | Type        | Notes                                      |
|------------------|-------------|---------------------------------------------|
| id               | uuid        | PK                                          |
| organization_id  | uuid        | FK → Organization                           |
| name             | text        |                                             |
| slug             | text        | URL-friendly unique identifier               |
| description      | text        | nullable                                    |
| categories       | text[]      | e.g., ["sports", "outdoors"]                |
| age_min          | int         | minimum age in years                         |
| age_max          | int         | maximum age in years                         |
| indoor_outdoor   | enum        | indoor / outdoor / both                     |
| registration_url | text        | Direct link to camp's signup page            |
| source_url       | text        | Page this data was scraped from              |
| scraped_at       | timestamptz | Last time scraper ran on this source         |
| last_verified_at | timestamptz | Last time data was confirmed accurate        |
| data_confidence  | enum        | high / medium / low                          |
| is_active        | boolean     | Soft delete / expiration                     |

**Category enum values:** sports, arts, stem, nature, music, theater, academic, special_needs, religious, swimming, cooking, language

### ActivityLocation
| Field         | Type      | Notes                                  |
|---------------|-----------|----------------------------------------|
| id            | uuid      | PK                                     |
| activity_id   | uuid      | FK → Activity                          |
| address       | text      |                                        |
| location      | geography | PostGIS point (lat/lng)                |
| location_name | text      | nullable, e.g., "North Raleigh Campus" |

### Session
| Field                | Type        | Notes                                          |
|----------------------|-------------|-------------------------------------------------|
| id                   | uuid        | PK                                              |
| activity_id          | uuid        | FK → Activity                                   |
| activity_location_id | uuid        | FK → ActivityLocation                           |
| starts_at            | date        |                                                 |
| ends_at              | date        |                                                 |
| time_slot            | enum        | full_day / am_half / pm_half                    |
| hours_start          | time        |                                                 |
| hours_end            | time        |                                                 |
| spots_available      | int         | nullable — only if scrapeable                   |
| is_sold_out          | boolean     |                                                 |
| enrollment_group_id  | uuid        | nullable — links sessions that must be booked together |

### PriceOption
| Field      | Type        | Notes                                           |
|------------|-------------|-------------------------------------------------|
| id         | uuid        | PK                                              |
| activity_id| uuid        | FK → Activity                                   |
| session_id | uuid        | nullable — null means applies to all sessions    |
| label      | text        | e.g., "Standard", "Early Bird", "Sibling"       |
| price_cents| int         |                                                 |
| price_unit | enum        | per_week / per_day / per_session / per_block     |
| conditions | text        | nullable, e.g., "Register before May 1"         |
| valid_from | date        | nullable                                        |
| valid_until| date        | nullable                                        |
| confidence | enum        | verified / scraped / llm_extracted               |

### User
| Field                    | Type      | Notes                          |
|--------------------------|-----------|--------------------------------|
| id                       | uuid      | PK, Supabase Auth              |
| email                    | text      |                                |
| address                  | text      | nullable                       |
| location                 | geography | PostGIS point, nullable        |
| default_radius_miles     | int       | default 30                     |
| notification_preferences | jsonb     | per-type toggles and frequency |

### Child
| Field      | Type   | Notes                                |
|------------|--------|--------------------------------------|
| id         | uuid   | PK                                   |
| user_id    | uuid   | FK → User                            |
| name       | text   |                                      |
| birth_date | date   |                                      |
| interests  | text[] | category enum values                 |

### Favorite
| Field       | Type        | Notes          |
|-------------|-------------|----------------|
| id          | uuid        | PK             |
| user_id     | uuid        | FK → User      |
| activity_id | uuid        | FK → Activity  |
| created_at  | timestamptz |                |

### PlannerEntry
| Field      | Type        | Notes                                       |
|------------|-------------|---------------------------------------------|
| id         | uuid        | PK                                          |
| user_id    | uuid        | FK → User                                   |
| child_id   | uuid        | FK → Child                                  |
| session_id | uuid        | FK → Session                                |
| status     | enum        | penciled_in / locked_in / cancelled          |
| sort_order | int         | ordering within a week                       |
| notes      | text        | nullable, e.g., "pack swimsuit"             |
| created_at | timestamptz |                                              |

### Reminder
| Field       | Type        | Notes                                        |
|-------------|-------------|----------------------------------------------|
| id          | uuid        | PK                                           |
| user_id     | uuid        | FK → User                                    |
| activity_id | uuid        | FK → Activity                                |
| type        | enum        | registration_opens / registration_closes / custom |
| remind_at   | timestamptz |                                              |
| sent_at     | timestamptz | nullable — null means not yet sent           |

### ScrapeSource
| Field            | Type        | Notes                          |
|------------------|-------------|--------------------------------|
| id               | uuid        | PK                             |
| url              | text        |                                |
| adapter_type     | enum        | dedicated / semi_structured / generic_llm |
| scrape_frequency | enum        | daily / weekly                 |
| last_scraped_at  | timestamptz | nullable                       |
| last_success_at  | timestamptz | nullable                       |
| error_count      | int         | default 0                      |
| is_paused        | boolean     | default false                  |

### ActivityReport
| Field       | Type        | Notes                                         |
|-------------|-------------|-----------------------------------------------|
| id          | uuid        | PK                                            |
| user_id     | uuid        | FK → User                                     |
| activity_id | uuid        | FK → Activity                                 |
| reason      | enum        | wrong_price / cancelled / wrong_dates / other |
| details     | text        | nullable — free-text explanation               |
| status      | enum        | pending / reviewed / resolved                 |
| created_at  | timestamptz |                                               |

### SharedSchedule
| Field      | Type        | Notes                                    |
|------------|-------------|------------------------------------------|
| id         | uuid        | PK                                       |
| user_id    | uuid        | FK → User                                |
| child_id   | uuid        | FK → Child                               |
| token      | text        | unique, URL-safe random string           |
| date_from  | date        | start of shared date range               |
| date_to    | date        | end of shared date range                 |
| created_at | timestamptz |                                          |

### ScrapeLog
| Field         | Type        | Notes                      |
|---------------|-------------|----------------------------|
| id            | uuid        | PK                         |
| source_id     | uuid        | FK → ScrapeSource          |
| started_at    | timestamptz |                            |
| completed_at  | timestamptz | nullable                   |
| status        | enum        | success / partial / failed |
| records_found | int         |                            |
| errors        | jsonb       | nullable                   |

## Pages & UI

### 1. Explore (Home/Discovery)
- Hero with search bar: keyword, age range, category, date range, radius slider
- Toggle between list view and map view (split-screen on desktop: list left, map right)
- Results as camp cards with infinite scroll and skeleton loading
- Sidebar filters: categories, price range, full/half day, extended care, indoor/outdoor, "new this year," "has availability"
- Sort by: distance, price (low/high), registration deadline (soonest)
- Curated sections: "Popular near you," "New this year," "Based on [Child]'s interests"
- Curated lists adapt to time of year: summer camps in spring, fall activities in August, etc.

### 2. Activity Detail
- Hero image/gallery (scraped if available, category gradient fallback)
- All structured data: org, location on map, sessions with availability, price options table, age range, hours, lunch, extended care
- **Prominent "Visit Camp Website" link** (Sunset orange CTA) — primary action since KidPlan doesn't handle registration
- **Organization website link** — secondary, visible
- Data freshness indicator: "Last updated 2 days ago" with "Verify on camp website" link
- Actions: Favorite, Add to Planner (pick child → pick session → adds as "Penciled In"), Share, Set Reminder
- "Report an Issue" button: Price is wrong / Camp is cancelled / Wrong dates / Other

### 3. My Planner
- Child selector tabs at top
- **Continuous calendar**, not summer-only. Default view: upcoming 3 months, zoomable to any range
- Week-by-week grid. Each week is a drop zone.
- Drag camps from a sidebar of favorites/search results
- Multiple camps per week, stacked as cards showing: name, time slot, price
- Status toggle: **Penciled In** (default) → **Locked In** (greys out other entries for that week, preserves them as backups)
- **Coverage gap indicator**: uncovered weeks show soft orange highlight + "Need coverage" prompt with smart suggestions
- Notes field per entry (expandable)
- Calendar export: push Locked In entries to Google/Apple Calendar with location, times, links

### 4. Favorites
- Grid of saved camp cards, organized by category or date
- Quick actions: add to planner, share, remove
- Filter/sort within favorites

### 5. My Kids (Profiles)
- Add/edit child profiles: name, birth date, interests (multi-select from categories)
- Each child shows planner summary: "8 of 10 weeks covered"
- Interest tags drive personalized recommendations on Explore

### 6. Auth
- Supabase Auth: email/password + Google OAuth
- Onboarding: set address → add first child → interests picker → land on Explore with personalized results

### 7. Submit a Camp
- Simple form: paste a URL for a camp not in the database
- Gets added to ScrapeSource queue for processing
- User notified when the camp is live in KidPlan

## Scraping Architecture

### Three-Tier System

**Tier 1: Dedicated Adapters (~15-20 at launch)**
Hand-written TypeScript scrapers for high-value Raleigh sources. High confidence data.

Target sources:
- Raleigh Parks & Rec
- Wake County Parks
- Town of Cary programs
- YMCA of the Triangle
- JCC of the Triangle
- Durham Parks & Rec
- Marbles Kids Museum
- Major sports/swim/gymnastics academies
- Community rec programs

Each adapter: async TypeScript module using Playwright (JS-rendered pages) or fetch + Cheerio (static HTML). Returns normalized Activity + Session + PriceOption arrays.

**Tier 2: Semi-Structured Scraper**
Template-based extractors for common patterns: WordPress event plugins, Sawyer/Jumbula-powered registration pages, Google Forms. Medium confidence.

**Tier 3: LLM-Assisted Extraction**
For the long tail — small studios, individual coaches, church bulletins, PDF program guides.
- Feed page/PDF content to Claude (Haiku for initial pass, Sonnet for low-confidence escalation)
- Returns structured Activity JSON
- All data tagged `confidence: llm_extracted`
- Prices from this tier always show "verify on camp website" in UI
- Cache page content, only re-extract when HTML diff exceeds threshold to control costs

### Pipeline Flow

```
ScrapeSource table
  → Vercel Cron (daily trigger)
  → Fan out: one function invocation per source (avoids 300s timeout)
  → Route to Tier 1/2/3 based on adapter_type
  → Raw extraction
  → Normalization layer:
      - Deduplicate (fuzzy name match + geo proximity + date overlap)
      - Geocode addresses → lat/lng (Google Maps API, cached per unique address)
      - Assign/verify categories
      - Normalize prices to cents
      - Detect sold-out status
  → Upsert to Supabase
  → Diff detection: flag changed prices, new sessions, sold-out transitions
  → Trigger notifications for changes affecting user favorites/planner
```

### Scheduling
- Tier 1: daily scrape
- Tier 2/3: weekly full scrape, daily spot-check on favorited/planned activities
- Scrape health: 3 consecutive failures → adapter paused, admin alerted
- Data older than 14 days → stale warning badge in UI

### Deduplication
Fuzzy matching layer: normalized name similarity (trigram) + geo proximity (within 0.5 miles) + date overlap. Potential duplicates flagged for manual review, not auto-merged.

### Known Gaps
- Facebook/Instagram-only camps will not be in the database at launch. "Submit a Camp" flow helps fill gaps over time.
- Registration deadlines are often not published. For camps without explicit deadlines, users set custom reminders.
- PDF program guides are common (especially for rec departments). Tier 3 handles these.

## Notifications

### Channels
- **Email** (launch) via Resend
- **Push notifications** (future, via PWA)

### Notification Types
| Type                      | Trigger                                        | Frequency      |
|---------------------------|------------------------------------------------|----------------|
| Registration deadline     | remind_at reached for registration_opens/closes | Immediate      |
| Availability alert        | Sold-out session now has spots (scraper diff)  | Immediate      |
| Coverage gap nudge        | Child has uncovered weeks in viewed range       | Weekly digest   |
| New camp match            | New activity matches child's age + interests   | Weekly digest   |
| Data change alert         | Favorited/planned camp changed price/dates     | Immediate      |
| Custom reminder           | User-set remind_at reached                     | Immediate      |

### User Preferences
- Toggle each type on/off
- Frequency: immediate vs. weekly digest (per type)
- Quiet hours: no notifications before 7am or after 9pm

### Implementation
- Supabase Edge Functions triggered by scraper diffs and cron
- Daily cron for reminder processing: `remind_at <= now() AND sent_at IS NULL`
- Weekly cron for digest generation (new matches + coverage gaps)

## Sharing

### Share an Activity
- "Share" button on activity detail and camp cards
- Public URL: `kidplan.com/activity/[slug]` — viewable without login (good for SEO)
- Native share sheet on mobile (Web Share API), copy link, SMS/WhatsApp/email
- Shared page shows "Plan your kid's activities too" CTA for signups

### Share a Schedule
- "Share [Child]'s Schedule" on planner
- Read-only link: `kidplan.com/schedule/[token]`
- Shows calendar with Penciled In and Locked In activities (notes excluded — private)
- Works for any date range — summer, fall semester, full year
- CTA: "Build your own plan" → signup

### No Social Graph (MVP)
No tracking between sharer and receiver. Links just work. Share counts per activity can be added later.

## Geographic Scope

- **Launch:** 30-mile radius from Raleigh, NC (covers the Triangle: Raleigh, Durham, Chapel Hill, Cary, Apex, Wake Forest, etc.)
- **User customization:** Parents set their address and default radius (e.g., "only show within 5 miles of home")
- **Geo queries:** PostGIS `ST_DWithin` with index on geography columns
- **Expansion:** Additional metros added later by expanding ScrapeSource registry

## Out of Scope (MVP)

- Payment processing
- In-app registration
- Organizer-facing tools / dashboard
- Social graph / friends list / groups
- Budget tracking
- Side-by-side comparison view
- Ratings or reviews
- In-app messaging between parents
