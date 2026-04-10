# Kidtinerary Scraping Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three-tier scraping pipeline that ingests camp/activity data from Raleigh-area sources into Supabase — dedicated adapters (Tier 1), LLM extraction (Tier 3), deduplication, geocoding, and a Vercel Cron orchestrator.

**Architecture:** A source registry in Supabase (`scrape_sources`) drives daily/weekly cron runs. Each source is routed to an adapter (dedicated TypeScript cheerio scraper or generic LLM extractor) that returns normalized `ScrapedActivity` arrays. The normalization layer slugifies names, converts prices to cents, assigns categories, and geocodes addresses via a DB-cached wrapper before upserting to Supabase with fuzzy-duplicate detection.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres + PostGIS), cheerio (HTML parsing), `@anthropic-ai/sdk` (Tier 3), tsx (CLI runner), vitest (tests), Vercel Cron.

---

## File Map

| File | Responsibility |
|---|---|
| `src/scraper/types.ts` | Shared TS interfaces: `ScrapedActivity`, `ScrapedSession`, `ScrapedPrice`, `AdapterResult`, `Adapter` |
| `src/scraper/normalize.ts` | Pure functions: `toSlug`, `priceToCents`, `assignCategories`, `extractAgeRange` |
| `src/scraper/geocode-cache.ts` | `geocodeWithCache(address)` — checks `activity_locations` table first, falls back to Google Maps |
| `src/scraper/adapters/raleigh-parks.ts` | Tier 1 dedicated adapter for Raleigh Parks & Rec |
| `src/scraper/adapters/ymca-triangle.ts` | Tier 1 dedicated adapter for YMCA Triangle |
| `src/scraper/adapters/llm-extractor.ts` | Tier 3 generic LLM adapter using Claude API |
| `src/scraper/adapters/index.ts` | Adapter registry: maps `adapter_type` + source URL to adapter function |
| `src/scraper/dedupe.ts` | `findDuplicates(candidate, existing[])` — trigram + geo + date overlap |
| `src/scraper/upsert.ts` | `upsertActivity(scraped, orgId)` — writes activity, locations, sessions, prices to Supabase |
| `src/scraper/pipeline.ts` | `runSource(sourceId)` — fetch → adapt → normalize → dedupe → geocode → upsert → log |
| `src/scraper/run.ts` | CLI entrypoint: `npx tsx src/scraper/run.ts --source raleigh-parks` |
| `src/app/api/cron/scrape/route.ts` | Vercel Cron POST handler — fans out one `runSource` call per active source |
| `tests/scraper/normalize.test.ts` | Unit tests for all normalize functions |
| `tests/scraper/dedupe.test.ts` | Unit tests for duplicate detection logic |
| `tests/scraper/llm-extractor.test.ts` | Tests for LLM extractor with mocked Anthropic responses |

---

## Task 1: Scraper Infrastructure — Types & Normalization

**Files:**
- Create: `src/scraper/types.ts`
- Create: `src/scraper/normalize.ts`
- Create: `tests/scraper/normalize.test.ts`

### Step 1.1: Write the failing normalize tests

Create `tests/scraper/normalize.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  toSlug,
  priceToCents,
  assignCategories,
  extractAgeRange,
} from "@/scraper/normalize";

describe("toSlug", () => {
  it("lowercases and hyphenates", () => {
    expect(toSlug("Raleigh Summer Camp 2025")).toBe("raleigh-summer-camp-2025");
  });

  it("strips special characters", () => {
    expect(toSlug("Art & Drama: Ages 6–10!")).toBe("art-drama-ages-6-10");
  });

  it("collapses multiple hyphens", () => {
    expect(toSlug("swim  camp---raleigh")).toBe("swim-camp-raleigh");
  });

  it("trims leading/trailing hyphens", () => {
    expect(toSlug("  -Camp Fun- ")).toBe("camp-fun");
  });
});

describe("priceToCents", () => {
  it("parses dollar amounts", () => {
    expect(priceToCents("$250")).toBe(25000);
  });

  it("parses amounts with decimals", () => {
    expect(priceToCents("$49.99")).toBe(4999);
  });

  it("parses amounts without dollar sign", () => {
    expect(priceToCents("150")).toBe(15000);
  });

  it("strips commas from large amounts", () => {
    expect(priceToCents("$1,200.00")).toBe(120000);
  });

  it("returns null for non-numeric strings", () => {
    expect(priceToCents("Free")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(priceToCents("")).toBeNull();
  });
});

describe("assignCategories", () => {
  it("detects sports from name", () => {
    const cats = assignCategories("Soccer Skills Camp", "");
    expect(cats).toContain("sports");
  });

  it("detects stem from description", () => {
    const cats = assignCategories("Summer Fun", "Coding, robotics, and engineering challenges");
    expect(cats).toContain("stem");
  });

  it("detects swimming from name", () => {
    const cats = assignCategories("Swim & Splash Camp", "");
    expect(cats).toContain("swimming");
  });

  it("detects arts from name", () => {
    const cats = assignCategories("Creative Arts Studio", "Painting, drawing, crafts");
    expect(cats).toContain("arts");
  });

  it("detects music from name", () => {
    const cats = assignCategories("Rock Band Music Camp", "");
    expect(cats).toContain("music");
  });

  it("detects nature from description", () => {
    const cats = assignCategories("Outdoor Adventure", "Hiking, nature exploration, ecology");
    expect(cats).toContain("nature");
  });

  it("returns at least one category for unrecognized input", () => {
    const cats = assignCategories("General Fun Camp", "Various activities for kids");
    expect(cats.length).toBeGreaterThan(0);
  });

  it("does not return duplicates", () => {
    const cats = assignCategories("Swimming Sports Camp", "water sports swim");
    const unique = [...new Set(cats)];
    expect(cats).toEqual(unique);
  });
});

describe("extractAgeRange", () => {
  it("parses 'ages 6-12'", () => {
    expect(extractAgeRange("Fun camp for ages 6-12")).toEqual({ min: 6, max: 12 });
  });

  it("parses 'ages 6 to 12'", () => {
    expect(extractAgeRange("Kids ages 6 to 12 welcome")).toEqual({ min: 6, max: 12 });
  });

  it("parses 'grades K-5'", () => {
    const result = extractAgeRange("Open to grades K-5");
    expect(result.min).toBe(5);
    expect(result.max).toBe(11);
  });

  it("parses 'grades 1-6'", () => {
    const result = extractAgeRange("For grades 1-6");
    expect(result.min).toBe(6);
    expect(result.max).toBe(12);
  });

  it("parses 'ages 8+'", () => {
    expect(extractAgeRange("For ages 8 and up")).toEqual({ min: 8, max: 12 });
  });

  it("returns null for no age info", () => {
    expect(extractAgeRange("Summer camp, all welcome")).toBeNull();
  });
});
```

- [ ] **Step 1.2: Run the tests to verify they fail**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npx vitest run tests/scraper/normalize.test.ts
```

Expected: FAIL — `Cannot find module '@/scraper/normalize'`

- [ ] **Step 1.3: Create `src/scraper/types.ts`**

```typescript
import type { Category, PriceUnit, TimeSlot, IndoorOutdoor } from "@/lib/constants";

export interface ScrapedPrice {
  label: string;                      // e.g. "Standard", "Early Bird"
  priceString: string;                // raw string: "$250", "250.00"
  priceUnit: PriceUnit;
  conditions?: string;                // e.g. "Register before May 1"
  validFrom?: string;                 // ISO date string
  validUntil?: string;                // ISO date string
}

export interface ScrapedSession {
  startsAt: string;                   // ISO date string, e.g. "2025-06-16"
  endsAt: string;                     // ISO date string, e.g. "2025-06-20"
  timeSlot: TimeSlot;
  hoursStart?: string;                // e.g. "09:00"
  hoursEnd?: string;                  // e.g. "15:00"
  spotsAvailable?: number;
  isSoldOut: boolean;
  locationAddress?: string;           // if session has its own location
  locationName?: string;
  prices?: ScrapedPrice[];            // prices specific to this session
}

export interface ScrapedActivity {
  name: string;
  description?: string;
  organizationName: string;
  organizationWebsite?: string;
  registrationUrl?: string;
  sourceUrl: string;
  address: string;                    // primary location address
  locationName?: string;              // e.g. "North Raleigh Campus"
  indoorOutdoor: IndoorOutdoor;
  ageText?: string;                   // raw text, e.g. "Ages 6-12" — normalized later
  categories?: Category[];            // optional: adapter can supply, else assigned by normalize
  sessions: ScrapedSession[];
  prices: ScrapedPrice[];             // activity-level prices (apply to all sessions)
}

export interface AdapterResult {
  activities: ScrapedActivity[];
  sourceUrl: string;
  scrapedAt: string;                  // ISO timestamp
  errors: string[];
}

export interface Adapter {
  name: string;
  sourceUrl: string;
  fetch(): Promise<AdapterResult>;
}
```

- [ ] **Step 1.4: Create `src/scraper/normalize.ts`**

```typescript
import type { Category } from "@/lib/constants";
import { CATEGORIES } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Slug
// ---------------------------------------------------------------------------

export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// Price
// ---------------------------------------------------------------------------

export function priceToCents(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return Math.round(num * 100);
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  sports:        ["sport", "soccer", "baseball", "basketball", "football", "lacrosse", "tennis", "volleyball", "athletic", "athletics"],
  arts:          ["art", "craft", "paint", "draw", "creative", "design", "sculpture", "ceramics", "pottery"],
  stem:          ["stem", "science", "coding", "code", "robot", "engineer", "math", "technology", "computer", "programming"],
  nature:        ["nature", "outdoor", "environment", "ecology", "hiking", "garden", "wildlife", "forest", "conservation"],
  music:         ["music", "band", "orchestra", "choir", "sing", "instrument", "guitar", "piano", "drum", "vocal"],
  theater:       ["theater", "theatre", "drama", "acting", "improv", "stage", "perform", "musical"],
  academic:      ["academic", "tutoring", "reading", "writing", "literacy", "math", "language arts", "homework"],
  special_needs: ["special needs", "adaptive", "inclusion", "disability", "sensory"],
  religious:     ["church", "faith", "bible", "vacation bible", "vbs", "jewish", "christian", "catholic", "religious"],
  swimming:      ["swim", "pool", "aquatic", "water polo", "diving"],
  cooking:       ["cook", "culinary", "baking", "kitchen", "chef", "food"],
  language:      ["spanish", "french", "mandarin", "chinese", "language", "bilingual", "immersion"],
};

export function assignCategories(name: string, description: string): Category[] {
  const text = `${name} ${description}`.toLowerCase();
  const found: Category[] = [];

  for (const category of CATEGORIES) {
    const keywords = CATEGORY_KEYWORDS[category];
    if (keywords.some((kw) => text.includes(kw))) {
      found.push(category);
    }
  }

  // Fallback: if nothing matched, label as "sports" (most common camp type)
  if (found.length === 0) {
    found.push("sports");
  }

  return found;
}

// ---------------------------------------------------------------------------
// Age range
// ---------------------------------------------------------------------------

// Kindergarten counts as age 5; grade N maps to roughly age N+5
const GRADE_TO_AGE: Record<string, number> = {
  k: 5, K: 5,
  "1": 6, "2": 7, "3": 8, "4": 9, "5": 10,
  "6": 11, "7": 12, "8": 13, "9": 14, "10": 15,
  "11": 16, "12": 17,
};

export function extractAgeRange(
  text: string
): { min: number; max: number } | null {
  // "ages 6-12" or "ages 6 to 12"
  const ageRange = text.match(/ages?\s+(\d+)\s*(?:-|to)\s*(\d+)/i);
  if (ageRange) {
    return { min: parseInt(ageRange[1], 10), max: parseInt(ageRange[2], 10) };
  }

  // "ages 8+" or "ages 8 and up"
  const ageUp = text.match(/ages?\s+(\d+)\s*(?:\+|and up)/i);
  if (ageUp) {
    return { min: parseInt(ageUp[1], 10), max: 12 };
  }

  // "grades K-5" or "grades 1-6"
  const gradeRange = text.match(/grades?\s+(K|\d+)\s*(?:-|to)\s*(K|\d+)/i);
  if (gradeRange) {
    const minGrade = gradeRange[1];
    const maxGrade = gradeRange[2];
    const minAge = GRADE_TO_AGE[minGrade] ?? 5;
    const maxAge = (GRADE_TO_AGE[maxGrade] ?? 12) + 1; // grade max → end-of-year age
    return { min: minAge, max: maxAge };
  }

  return null;
}
```

- [ ] **Step 1.5: Run the tests — expect them to pass**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npx vitest run tests/scraper/normalize.test.ts
```

Expected: All tests PASS.

- [ ] **Step 1.6: Commit**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && git add src/scraper/types.ts src/scraper/normalize.ts tests/scraper/normalize.test.ts
git commit -m "feat(scraper): types, normalize functions, and unit tests"
```

---

## Task 2: Geocode Cache

**Files:**
- Create: `src/scraper/geocode-cache.ts`

The existing `src/lib/geocode.ts` calls Google Maps unconditionally. This wrapper first checks the `activity_locations` table for a matching address before making an API call.

- [ ] **Step 2.1: Create `src/scraper/geocode-cache.ts`**

```typescript
import { createClient } from "@supabase/supabase-js";
import { geocodeAddress, type GeoResult } from "@/lib/geocode";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not set for scraper");
  return createClient(url, key);
}

/**
 * Returns lat/lng for the given address.
 * Checks activity_locations table first (PostGIS POINT stored as text "POINT(lng lat)").
 * Falls back to Google Maps API on cache miss, but does NOT write — the upsert
 * step owns writing locations to the DB.
 */
export async function geocodeWithCache(address: string): Promise<GeoResult | null> {
  const supabase = getServiceClient() as any;

  // Check if we already have this address geocoded in the DB
  const { data } = await supabase
    .from("activity_locations")
    .select("location")
    .eq("address", address)
    .not("location", "is", null)
    .limit(1)
    .maybeSingle();

  if (data?.location) {
    // location is a PostGIS geography serialized as GeoJSON by Supabase
    // Supabase returns it as { type: "Point", coordinates: [lng, lat] }
    try {
      const geo = typeof data.location === "string"
        ? JSON.parse(data.location)
        : data.location;
      const [lng, lat] = geo.coordinates as [number, number];
      return { lat, lng, formatted_address: address };
    } catch {
      // fall through to API
    }
  }

  // Cache miss — call Google Maps
  return geocodeAddress(address);
}
```

- [ ] **Step 2.2: Verify TypeScript compiles**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npx tsc --noEmit
```

Expected: No errors (or only pre-existing errors unrelated to scraper files).

- [ ] **Step 2.3: Commit**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && git add src/scraper/geocode-cache.ts
git commit -m "feat(scraper): geocode cache wrapper using activity_locations table"
```

---

## Task 3: Tier 1 Dedicated Adapters

**Files:**
- Create: `src/scraper/adapters/raleigh-parks.ts`
- Create: `src/scraper/adapters/ymca-triangle.ts`
- Create: `src/scraper/adapters/index.ts`

### Step 3.1: Install cheerio

- [ ] **Step 3.1: Install cheerio**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm install cheerio
```

Expected: `cheerio` added to `dependencies` in `package.json`.

- [ ] **Step 3.2: Create `src/scraper/adapters/raleigh-parks.ts`**

Raleigh Parks & Rec posts camp listings at `https://raleighnc.gov/parks/camps`. The HTML structure uses `.views-row` containers with `.views-field` children. This adapter is resilient: if selectors miss, it logs and returns partial results.

```typescript
import * as cheerio from "cheerio";
import type { Adapter, AdapterResult, ScrapedActivity, ScrapedSession } from "@/scraper/types";

const SOURCE_URL = "https://raleighnc.gov/parks/camps";

export const RaleighParksAdapter: Adapter = {
  name: "raleigh-parks",
  sourceUrl: SOURCE_URL,
  async fetch(): Promise<AdapterResult> {
    const errors: string[] = [];
    const activities: ScrapedActivity[] = [];
    const scrapedAt = new Date().toISOString();

    let html: string;
    try {
      const res = await fetch(SOURCE_URL, {
        headers: { "User-Agent": "KidPlan-Scraper/1.0 (+https://kidplan.app)" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        errors.push(`HTTP ${res.status} fetching ${SOURCE_URL}`);
        return { activities, sourceUrl: SOURCE_URL, scrapedAt, errors };
      }
      html = await res.text();
    } catch (err) {
      errors.push(`Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
      return { activities, sourceUrl: SOURCE_URL, scrapedAt, errors };
    }

    const $ = cheerio.load(html);

    // Raleigh Parks uses a Drupal views listing — adapt selectors if site changes
    $(".views-row, .program-item, article.camp").each((_, el) => {
      try {
        const name =
          $(el).find(".views-field-title a, h3 a, .field-name-title a").first().text().trim() ||
          $(el).find("h2, h3, h4").first().text().trim();

        if (!name) return;

        const description =
          $(el).find(".views-field-body, .field-name-body, .description").first().text().trim() ||
          undefined;

        const registrationUrl =
          $(el).find("a[href*='register'], a[href*='registration'], .register-link a").attr("href") ||
          $(el).find("a").filter((_, a) => /register/i.test($(a).text())).attr("href") ||
          undefined;

        const ageText =
          $(el).find(".views-field-field-age-range, .age-range, [class*='age']").text().trim() ||
          undefined;

        const dateText =
          $(el).find(".views-field-field-date, .date-range, [class*='date']").text().trim() ||
          "";

        const priceText =
          $(el).find(".views-field-field-price, .price, [class*='price'], [class*='cost']").text().trim() ||
          "";

        const locationText =
          $(el).find(".views-field-field-location, .location, [class*='location']").text().trim() ||
          "Raleigh, NC";

        // Parse a simple date range like "June 16 - 20, 2025" into ISO dates
        const session = parseDateRangeToSession(dateText);

        const activity: ScrapedActivity = {
          name,
          description: description || undefined,
          organizationName: "Raleigh Parks & Recreation",
          organizationWebsite: "https://raleighnc.gov/parks",
          registrationUrl: registrationUrl
            ? new URL(registrationUrl, SOURCE_URL).href
            : SOURCE_URL,
          sourceUrl: SOURCE_URL,
          address: locationText.includes(",") ? locationText : `${locationText}, Raleigh, NC`,
          indoorOutdoor: guessIndoorOutdoor(name, description ?? ""),
          ageText: ageText || undefined,
          sessions: session ? [session] : [],
          prices: priceText
            ? [{ label: "Standard", priceString: priceText, priceUnit: "per_week" }]
            : [],
        };

        activities.push(activity);
      } catch (err) {
        errors.push(`Row parse error: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    if (activities.length === 0) {
      errors.push("No activities found — page structure may have changed");
    }

    return { activities, sourceUrl: SOURCE_URL, scrapedAt, errors };
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDateRangeToSession(dateText: string): ScrapedSession | null {
  if (!dateText) return null;

  // "June 16 - 20, 2025" or "June 16–June 20, 2025"
  const fullRange = dateText.match(
    /(\w+ \d+)\s*[-–]\s*(\w+ \d+),?\s*(\d{4})/
  );
  if (fullRange) {
    const [, startRaw, endRaw, year] = fullRange;
    const starts = parseMonthDay(`${startRaw} ${year}`);
    const ends = parseMonthDay(`${endRaw} ${year}`);
    if (starts && ends) {
      return { startsAt: starts, endsAt: ends, timeSlot: "full_day", isSoldOut: false };
    }
  }

  // "June 16 - 20, 2025" (same month, just day range)
  const sameMonthRange = dateText.match(
    /(\w+)\s+(\d+)\s*[-–]\s*(\d+),?\s*(\d{4})/
  );
  if (sameMonthRange) {
    const [, month, startDay, endDay, year] = sameMonthRange;
    const starts = parseMonthDay(`${month} ${startDay} ${year}`);
    const ends = parseMonthDay(`${month} ${endDay} ${year}`);
    if (starts && ends) {
      return { startsAt: starts, endsAt: ends, timeSlot: "full_day", isSoldOut: false };
    }
  }

  return null;
}

function parseMonthDay(text: string): string | null {
  const d = new Date(text);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function guessIndoorOutdoor(name: string, desc: string): "indoor" | "outdoor" | "both" {
  const text = `${name} ${desc}`.toLowerCase();
  const outdoorKeywords = ["outdoor", "nature", "hiking", "field", "park", "garden", "forest"];
  const indoorKeywords  = ["indoor", "studio", "classroom", "gym", "pool", "aquatic"];
  const isOutdoor = outdoorKeywords.some((kw) => text.includes(kw));
  const isIndoor  = indoorKeywords.some((kw) => text.includes(kw));
  if (isOutdoor && isIndoor) return "both";
  if (isOutdoor) return "outdoor";
  if (isIndoor)  return "indoor";
  return "both";
}
```

- [ ] **Step 3.3: Create `src/scraper/adapters/ymca-triangle.ts`**

YMCA Triangle posts camps at `https://ymcatriangle.org/camps`. Uses Bootstrap card layout.

```typescript
import * as cheerio from "cheerio";
import type { Adapter, AdapterResult, ScrapedActivity, ScrapedSession } from "@/scraper/types";

const SOURCE_URL = "https://ymcatriangle.org/camps";

export const YMCATriangleAdapter: Adapter = {
  name: "ymca-triangle",
  sourceUrl: SOURCE_URL,
  async fetch(): Promise<AdapterResult> {
    const errors: string[] = [];
    const activities: ScrapedActivity[] = [];
    const scrapedAt = new Date().toISOString();

    let html: string;
    try {
      const res = await fetch(SOURCE_URL, {
        headers: { "User-Agent": "KidPlan-Scraper/1.0 (+https://kidplan.app)" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        errors.push(`HTTP ${res.status} fetching ${SOURCE_URL}`);
        return { activities, sourceUrl: SOURCE_URL, scrapedAt, errors };
      }
      html = await res.text();
    } catch (err) {
      errors.push(`Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
      return { activities, sourceUrl: SOURCE_URL, scrapedAt, errors };
    }

    const $ = cheerio.load(html);

    // YMCA Triangle uses Bootstrap cards — try multiple selectors for resilience
    const cardSel = ".card, .camp-card, .program-card, article[class*='camp'], .views-row";
    $(cardSel).each((_, el) => {
      try {
        const name =
          $(el).find(".card-title, h2, h3, h4").first().text().trim();
        if (!name) return;

        const description =
          $(el).find(".card-text, .description, p").first().text().trim() || undefined;

        const registrationUrl =
          $(el).find("a[href*='register'], a[href*='join'], .btn-primary").attr("href") ||
          $(el).find("a").attr("href") ||
          undefined;

        const detailUrl = $(el).find("a[href*='/camp'], a.card-link").attr("href");
        const fullDetailUrl = detailUrl
          ? new URL(detailUrl, SOURCE_URL).href
          : undefined;

        const ageText =
          $(el).find("[class*='age'], .ages, .grade").text().trim() || undefined;

        const dateText =
          $(el).find("[class*='date'], .dates, .session-dates").text().trim() || "";

        const priceText =
          $(el).find("[class*='price'], .cost, .fee").text().trim() || "";

        const locationText =
          $(el).find("[class*='location'], .branch, .facility").text().trim() ||
          "Triangle Area, NC";

        const session = parseDateText(dateText);

        const activity: ScrapedActivity = {
          name,
          description,
          organizationName: "YMCA of the Triangle",
          organizationWebsite: "https://ymcatriangle.org",
          registrationUrl: registrationUrl
            ? new URL(registrationUrl, SOURCE_URL).href
            : fullDetailUrl ?? SOURCE_URL,
          sourceUrl: fullDetailUrl ?? SOURCE_URL,
          address: locationText.includes(",")
            ? locationText
            : `${locationText}, Raleigh, NC`,
          indoorOutdoor: guessIndoorOutdoor(name, description ?? ""),
          ageText: ageText || undefined,
          sessions: session ? [session] : [],
          prices: priceText
            ? [
                { label: "Member", priceString: priceText, priceUnit: "per_week" },
              ]
            : [],
        };

        activities.push(activity);
      } catch (err) {
        errors.push(`Row parse error: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    if (activities.length === 0) {
      errors.push("No activities found — page structure may have changed");
    }

    return { activities, sourceUrl: SOURCE_URL, scrapedAt, errors };
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDateText(text: string): ScrapedSession | null {
  if (!text) return null;
  // Try "Month D - Month D, YYYY" or "Month D-D, YYYY"
  const withYear = text.match(/(\w+ \d+)\s*[-–]\s*(\w+ \d+),?\s*(\d{4})/);
  if (withYear) {
    const starts = safeDate(`${withYear[1]} ${withYear[3]}`);
    const ends   = safeDate(`${withYear[2]} ${withYear[3]}`);
    if (starts && ends) {
      return { startsAt: starts, endsAt: ends, timeSlot: "full_day", isSoldOut: false };
    }
  }
  const sameMonth = text.match(/(\w+)\s+(\d+)\s*[-–]\s*(\d+),?\s*(\d{4})/);
  if (sameMonth) {
    const [, month, d1, d2, year] = sameMonth;
    const starts = safeDate(`${month} ${d1} ${year}`);
    const ends   = safeDate(`${month} ${d2} ${year}`);
    if (starts && ends) {
      return { startsAt: starts, endsAt: ends, timeSlot: "full_day", isSoldOut: false };
    }
  }
  return null;
}

function safeDate(text: string): string | null {
  const d = new Date(text);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function guessIndoorOutdoor(name: string, desc: string): "indoor" | "outdoor" | "both" {
  const text = `${name} ${desc}`.toLowerCase();
  const outdoorKeywords = ["outdoor", "nature", "hiking", "field", "park", "garden", "forest", "swim", "pool"];
  const indoorKeywords  = ["indoor", "studio", "classroom", "gym", "aquatic"];
  const isOutdoor = outdoorKeywords.some((kw) => text.includes(kw));
  const isIndoor  = indoorKeywords.some((kw) => text.includes(kw));
  if (isOutdoor && isIndoor) return "both";
  if (isOutdoor) return "outdoor";
  if (isIndoor)  return "indoor";
  return "both";
}
```

- [ ] **Step 3.4: Create `src/scraper/adapters/index.ts`**

```typescript
import { RaleighParksAdapter } from "@/scraper/adapters/raleigh-parks";
import { YMCATriangleAdapter } from "@/scraper/adapters/ymca-triangle";
import type { Adapter } from "@/scraper/types";

// Registry: map adapter name → Adapter instance
export const ADAPTER_REGISTRY: Record<string, Adapter> = {
  "raleigh-parks": RaleighParksAdapter,
  "ymca-triangle": YMCATriangleAdapter,
};

/**
 * Returns all registered adapters.
 */
export function getAllAdapters(): Adapter[] {
  return Object.values(ADAPTER_REGISTRY);
}

/**
 * Returns adapter by name, or null if not found.
 */
export function getAdapter(name: string): Adapter | null {
  return ADAPTER_REGISTRY[name] ?? null;
}
```

- [ ] **Step 3.5: Verify TypeScript compiles**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npx tsc --noEmit
```

Expected: No new errors.

- [ ] **Step 3.6: Commit**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && git add src/scraper/adapters/
git commit -m "feat(scraper): Tier 1 dedicated adapters — raleigh-parks, ymca-triangle, registry"
```

---

## Task 4: Tier 3 LLM Extractor

**Files:**
- Create: `src/scraper/adapters/llm-extractor.ts`
- Create: `tests/scraper/llm-extractor.test.ts`

### Step 4.1: Install Anthropic SDK

- [ ] **Step 4.1: Install the Anthropic SDK**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm install @anthropic-ai/sdk
```

- [ ] **Step 4.2: Write the failing LLM extractor tests**

Create `tests/scraper/llm-extractor.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractWithLLM, buildExtractionPrompt } from "@/scraper/adapters/llm-extractor";

// Mock the Anthropic SDK so tests don't make real API calls
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}));

const MOCK_VALID_RESPONSE = JSON.stringify({
  activities: [
    {
      name: "Summer Splash Camp",
      description: "A week of swimming and water games",
      organizationName: "Happy Swimmers LLC",
      organizationWebsite: "https://happyswimmers.com",
      registrationUrl: "https://happyswimmers.com/register",
      sourceUrl: "https://happyswimmers.com/camps",
      address: "123 Pool Ln, Raleigh, NC 27601",
      indoorOutdoor: "outdoor",
      ageText: "Ages 6-12",
      sessions: [
        {
          startsAt: "2025-06-16",
          endsAt: "2025-06-20",
          timeSlot: "full_day",
          hoursStart: "09:00",
          hoursEnd: "15:00",
          isSoldOut: false,
        },
      ],
      prices: [
        {
          label: "Standard",
          priceString: "$250",
          priceUnit: "per_week",
        },
      ],
    },
  ],
});

describe("buildExtractionPrompt", () => {
  it("includes the source URL in the prompt", () => {
    const prompt = buildExtractionPrompt("https://example.com/camps", "<html>content</html>");
    expect(prompt).toContain("https://example.com/camps");
  });

  it("includes the HTML content in the prompt", () => {
    const prompt = buildExtractionPrompt("https://example.com/camps", "Summer Camp 2025");
    expect(prompt).toContain("Summer Camp 2025");
  });

  it("asks for JSON output", () => {
    const prompt = buildExtractionPrompt("https://example.com", "content");
    expect(prompt.toLowerCase()).toContain("json");
  });
});

describe("extractWithLLM", () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default as any;
    mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: MOCK_VALID_RESPONSE }],
    });
    Anthropic.mockImplementation(() => ({
      messages: { create: mockCreate },
    }));
  });

  it("returns parsed activities from valid LLM response", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const result = await extractWithLLM(
      "https://happyswimmers.com/camps",
      "<html><body>Summer Splash Camp, $250/week, June 16-20</body></html>"
    );
    expect(result.activities).toHaveLength(1);
    expect(result.activities[0].name).toBe("Summer Splash Camp");
    expect(result.activities[0].prices[0].priceString).toBe("$250");
  });

  it("tags all activities with confidence source", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const result = await extractWithLLM(
      "https://happyswimmers.com/camps",
      "<html>Some camp content</html>"
    );
    expect(result.activities.every((a) => a._confidence === "llm_extracted")).toBe(true);
  });

  it("returns error when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const result = await extractWithLLM("https://example.com", "<html></html>");
    expect(result.errors).toContain("ANTHROPIC_API_KEY not set");
    expect(result.activities).toHaveLength(0);
  });

  it("returns error on malformed JSON response", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const Anthropic = (await import("@anthropic-ai/sdk")).default as any;
    Anthropic.mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "not valid json {{{" }],
        }),
      },
    }));
    const result = await extractWithLLM("https://example.com", "<html>content</html>");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/parse/i);
  });
});
```

- [ ] **Step 4.3: Run the tests to verify they fail**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npx vitest run tests/scraper/llm-extractor.test.ts
```

Expected: FAIL — `Cannot find module '@/scraper/adapters/llm-extractor'`

- [ ] **Step 4.4: Create `src/scraper/adapters/llm-extractor.ts`**

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { AdapterResult, ScrapedActivity } from "@/scraper/types";

// Extend ScrapedActivity to carry the LLM confidence tag
export interface LLMScrapedActivity extends ScrapedActivity {
  _confidence: "llm_extracted";
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export function buildExtractionPrompt(sourceUrl: string, content: string): string {
  return `You are a data extraction assistant for KidPlan, a children's activity discovery platform.

Extract ALL camp, class, or activity listings from the following web page content.
Source URL: ${sourceUrl}

Return ONLY a valid JSON object with this exact structure — no markdown, no code fences, no explanation:

{
  "activities": [
    {
      "name": "string — activity name",
      "description": "string or null",
      "organizationName": "string — organization running this activity",
      "organizationWebsite": "string URL or null",
      "registrationUrl": "string URL or null",
      "sourceUrl": "${sourceUrl}",
      "address": "string — full street address including city, state, zip",
      "locationName": "string or null — e.g. 'North Raleigh Campus'",
      "indoorOutdoor": "indoor | outdoor | both",
      "ageText": "string or null — raw age text, e.g. 'Ages 6-12'",
      "sessions": [
        {
          "startsAt": "YYYY-MM-DD",
          "endsAt": "YYYY-MM-DD",
          "timeSlot": "full_day | am_half | pm_half",
          "hoursStart": "HH:MM or null",
          "hoursEnd": "HH:MM or null",
          "isSoldOut": false,
          "spotsAvailable": null
        }
      ],
      "prices": [
        {
          "label": "Standard",
          "priceString": "$250",
          "priceUnit": "per_week | per_day | per_session | per_block",
          "conditions": "string or null"
        }
      ]
    }
  ]
}

Rules:
- Include every distinct camp/class/activity you find on the page.
- If a field is genuinely unknown, use null. Do not guess prices.
- For sessions: use YYYY-MM-DD format. If only a year is given, use June 1–August 31 of that year as a placeholder and set isSoldOut to false.
- For prices: preserve the raw price string exactly (e.g. "$250", "250.00"). Do not convert.
- If the page has no recognizable camp/class listings, return { "activities": [] }.

Page content:
---
${content.slice(0, 80_000)}
---`;
}

// ---------------------------------------------------------------------------
// Extractor
// ---------------------------------------------------------------------------

/**
 * Generic LLM-assisted extractor for Tier 3 sources.
 * Fetches the page, sends to Claude, parses structured output.
 */
export async function extractWithLLM(
  sourceUrl: string,
  htmlContent: string
): Promise<AdapterResult & { activities: LLMScrapedActivity[] }> {
  const scrapedAt = new Date().toISOString();
  const errors: string[] = [];
  const activities: LLMScrapedActivity[] = [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    errors.push("ANTHROPIC_API_KEY not set");
    return { activities, sourceUrl, scrapedAt, errors };
  }

  const client = new Anthropic({ apiKey });
  const prompt = buildExtractionPrompt(sourceUrl, htmlContent);

  let rawText: string;
  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      errors.push("LLM returned no text content");
      return { activities, sourceUrl, scrapedAt, errors };
    }
    rawText = textBlock.text;
  } catch (err) {
    errors.push(`Claude API error: ${err instanceof Error ? err.message : String(err)}`);
    return { activities, sourceUrl, scrapedAt, errors };
  }

  let parsed: { activities: ScrapedActivity[] };
  try {
    // Strip markdown code fences if model wrapped output anyway
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    errors.push(`Failed to parse LLM response as JSON: ${err instanceof Error ? err.message : String(err)}`);
    return { activities, sourceUrl, scrapedAt, errors };
  }

  if (!Array.isArray(parsed?.activities)) {
    errors.push("LLM response missing 'activities' array");
    return { activities, sourceUrl, scrapedAt, errors };
  }

  for (const raw of parsed.activities) {
    activities.push({ ...raw, _confidence: "llm_extracted" });
  }

  return { activities, sourceUrl, scrapedAt, errors };
}

// ---------------------------------------------------------------------------
// Adapter that fetches and then calls extractWithLLM
// ---------------------------------------------------------------------------

export function createLLMAdapter(sourceUrl: string) {
  return {
    name: `llm:${sourceUrl}`,
    sourceUrl,
    async fetch(): Promise<AdapterResult> {
      const errors: string[] = [];
      const scrapedAt = new Date().toISOString();

      let html: string;
      try {
        const res = await globalThis.fetch(sourceUrl, {
          headers: { "User-Agent": "KidPlan-Scraper/1.0 (+https://kidplan.app)" },
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) {
          errors.push(`HTTP ${res.status} fetching ${sourceUrl}`);
          return { activities: [], sourceUrl, scrapedAt, errors };
        }
        html = await res.text();
      } catch (err) {
        errors.push(`Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
        return { activities: [], sourceUrl, scrapedAt, errors };
      }

      return extractWithLLM(sourceUrl, html);
    },
  };
}
```

- [ ] **Step 4.5: Update the adapter registry to handle generic_llm sources**

Edit `src/scraper/adapters/index.ts` — replace the whole file:

```typescript
import { RaleighParksAdapter } from "@/scraper/adapters/raleigh-parks";
import { YMCATriangleAdapter } from "@/scraper/adapters/ymca-triangle";
import { createLLMAdapter } from "@/scraper/adapters/llm-extractor";
import type { Adapter } from "@/scraper/types";

// Registry of named Tier 1 dedicated adapters
export const ADAPTER_REGISTRY: Record<string, Adapter> = {
  "raleigh-parks": RaleighParksAdapter,
  "ymca-triangle": YMCATriangleAdapter,
};

export function getAllAdapters(): Adapter[] {
  return Object.values(ADAPTER_REGISTRY);
}

export function getAdapter(name: string): Adapter | null {
  return ADAPTER_REGISTRY[name] ?? null;
}

/**
 * Returns an adapter for a scrape source.
 * - adapter_type "dedicated": looks up by name (slug of the source URL or adapter field)
 * - adapter_type "generic_llm": creates an LLM adapter on the fly
 */
export function resolveAdapter(
  adapterType: "dedicated" | "semi_structured" | "generic_llm",
  sourceUrl: string,
  adapterName?: string
): Adapter | null {
  if (adapterType === "dedicated") {
    if (adapterName && ADAPTER_REGISTRY[adapterName]) {
      return ADAPTER_REGISTRY[adapterName];
    }
    // Try to match by URL
    const byUrl = Object.values(ADAPTER_REGISTRY).find(
      (a) => a.sourceUrl === sourceUrl
    );
    return byUrl ?? null;
  }

  if (adapterType === "generic_llm") {
    return createLLMAdapter(sourceUrl);
  }

  // semi_structured not yet implemented — fall back to LLM
  return createLLMAdapter(sourceUrl);
}
```

- [ ] **Step 4.6: Run all scraper tests**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npx vitest run tests/scraper/
```

Expected: All tests pass.

- [ ] **Step 4.7: Commit**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && git add src/scraper/adapters/llm-extractor.ts src/scraper/adapters/index.ts tests/scraper/llm-extractor.test.ts
git commit -m "feat(scraper): Tier 3 LLM extractor using Claude API + updated adapter registry"
```

---

## Task 5: Deduplication

**Files:**
- Create: `src/scraper/dedupe.ts`
- Create: `tests/scraper/dedupe.test.ts`

- [ ] **Step 5.1: Write the failing dedupe tests**

Create `tests/scraper/dedupe.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  trigramSimilarity,
  isGeographicallyClose,
  hasDateOverlap,
  isDuplicateOf,
} from "@/scraper/dedupe";

describe("trigramSimilarity", () => {
  it("returns 1.0 for identical strings", () => {
    expect(trigramSimilarity("Summer Camp", "Summer Camp")).toBe(1.0);
  });

  it("returns high score for near-identical strings", () => {
    const score = trigramSimilarity("Raleigh Summer Camp", "Raleigh Summer Camps");
    expect(score).toBeGreaterThan(0.8);
  });

  it("returns low score for unrelated strings", () => {
    const score = trigramSimilarity("Swimming Lessons", "Robotics Club");
    expect(score).toBeLessThan(0.3);
  });

  it("handles empty strings", () => {
    expect(trigramSimilarity("", "anything")).toBe(0);
    expect(trigramSimilarity("anything", "")).toBe(0);
  });

  it("is case-insensitive", () => {
    const score = trigramSimilarity("SUMMER CAMP", "summer camp");
    expect(score).toBe(1.0);
  });
});

describe("isGeographicallyClose", () => {
  // Raleigh City Hall: 35.7796° N, 78.6382° W
  const raleigh = { lat: 35.7796, lng: -78.6382 };
  // ~0.3 miles north
  const nearRaleigh = { lat: 35.7840, lng: -78.6382 };
  // Durham: ~20 miles away
  const durham = { lat: 35.9940, lng: -78.8986 };

  it("returns true for points within 0.5 miles", () => {
    expect(isGeographicallyClose(raleigh, nearRaleigh, 0.5)).toBe(true);
  });

  it("returns false for points more than 0.5 miles apart", () => {
    expect(isGeographicallyClose(raleigh, durham, 0.5)).toBe(false);
  });

  it("respects a custom threshold in miles", () => {
    expect(isGeographicallyClose(raleigh, durham, 25)).toBe(true);
    expect(isGeographicallyClose(raleigh, durham, 10)).toBe(false);
  });
});

describe("hasDateOverlap", () => {
  it("returns true for overlapping date ranges", () => {
    expect(
      hasDateOverlap(
        { startsAt: "2025-06-16", endsAt: "2025-06-20" },
        { startsAt: "2025-06-18", endsAt: "2025-06-22" }
      )
    ).toBe(true);
  });

  it("returns true for contained ranges", () => {
    expect(
      hasDateOverlap(
        { startsAt: "2025-06-01", endsAt: "2025-06-30" },
        { startsAt: "2025-06-10", endsAt: "2025-06-15" }
      )
    ).toBe(true);
  });

  it("returns false for non-overlapping ranges", () => {
    expect(
      hasDateOverlap(
        { startsAt: "2025-06-01", endsAt: "2025-06-07" },
        { startsAt: "2025-06-14", endsAt: "2025-06-20" }
      )
    ).toBe(false);
  });

  it("returns true for adjacent ranges (same end/start day)", () => {
    expect(
      hasDateOverlap(
        { startsAt: "2025-06-07", endsAt: "2025-06-14" },
        { startsAt: "2025-06-14", endsAt: "2025-06-21" }
      )
    ).toBe(true);
  });
});

describe("isDuplicateOf", () => {
  const base = {
    name: "Summer Splash Camp",
    lat: 35.7796,
    lng: -78.6382,
    sessions: [{ startsAt: "2025-06-16", endsAt: "2025-06-20" }],
  };

  it("flags near-identical activity at same location same week as duplicate", () => {
    const candidate = {
      name: "Summer Splash Camps",
      lat: 35.7797,
      lng: -78.6383,
      sessions: [{ startsAt: "2025-06-16", endsAt: "2025-06-20" }],
    };
    expect(isDuplicateOf(candidate, base)).toBe(true);
  });

  it("does not flag same name at distant location", () => {
    const candidate = {
      name: "Summer Splash Camp",
      lat: 35.9940,
      lng: -78.8986,
      sessions: [{ startsAt: "2025-06-16", endsAt: "2025-06-20" }],
    };
    expect(isDuplicateOf(candidate, base)).toBe(false);
  });

  it("does not flag same name same location different time of year", () => {
    const candidate = {
      name: "Summer Splash Camp",
      lat: 35.7796,
      lng: -78.6382,
      sessions: [{ startsAt: "2025-09-01", endsAt: "2025-09-05" }],
    };
    expect(isDuplicateOf(candidate, base)).toBe(false);
  });
});
```

- [ ] **Step 5.2: Run to verify failure**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npx vitest run tests/scraper/dedupe.test.ts
```

Expected: FAIL — `Cannot find module '@/scraper/dedupe'`

- [ ] **Step 5.3: Create `src/scraper/dedupe.ts`**

```typescript
/**
 * Fuzzy deduplication utilities.
 * Spec requirement: trigram name similarity + geo proximity (within 0.5 mi) + date overlap.
 * Potential duplicates are FLAGGED — not auto-merged.
 */

// ---------------------------------------------------------------------------
// Trigram similarity
// ---------------------------------------------------------------------------

function buildTrigrams(str: string): Set<string> {
  const s = str.toLowerCase().replace(/\s+/g, " ").trim();
  const trigrams = new Set<string>();
  const padded = `  ${s}  `;
  for (let i = 0; i < padded.length - 2; i++) {
    trigrams.add(padded.slice(i, i + 3));
  }
  return trigrams;
}

export function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const ta = buildTrigrams(a);
  const tb = buildTrigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  ta.forEach((t) => { if (tb.has(t)) intersection++; });
  return (2 * intersection) / (ta.size + tb.size);
}

// ---------------------------------------------------------------------------
// Geographic proximity (Haversine)
// ---------------------------------------------------------------------------

const EARTH_RADIUS_MILES = 3_958.8;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function distanceMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const chord =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(chord));
}

export function isGeographicallyClose(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  thresholdMiles = 0.5
): boolean {
  return distanceMiles(a, b) <= thresholdMiles;
}

// ---------------------------------------------------------------------------
// Date overlap
// ---------------------------------------------------------------------------

export function hasDateOverlap(
  a: { startsAt: string; endsAt: string },
  b: { startsAt: string; endsAt: string }
): boolean {
  const aStart = new Date(a.startsAt).getTime();
  const aEnd   = new Date(a.endsAt).getTime();
  const bStart = new Date(b.startsAt).getTime();
  const bEnd   = new Date(b.endsAt).getTime();
  // Overlap when one starts before the other ends
  return aStart <= bEnd && bStart <= aEnd;
}

// ---------------------------------------------------------------------------
// Composite duplicate check
// ---------------------------------------------------------------------------

export interface DupeCandidate {
  name: string;
  lat: number;
  lng: number;
  sessions: { startsAt: string; endsAt: string }[];
}

/**
 * Returns true if `candidate` is likely a duplicate of `existing`.
 * Criteria: name similarity ≥ 0.7 AND geo ≤ 0.5 miles AND at least one session overlaps.
 */
export function isDuplicateOf(
  candidate: DupeCandidate,
  existing: DupeCandidate,
  options = { nameSimilarityThreshold: 0.7, geoThresholdMiles: 0.5 }
): boolean {
  const nameSim = trigramSimilarity(candidate.name, existing.name);
  if (nameSim < options.nameSimilarityThreshold) return false;

  const close = isGeographicallyClose(
    { lat: candidate.lat, lng: candidate.lng },
    { lat: existing.lat, lng: existing.lng },
    options.geoThresholdMiles
  );
  if (!close) return false;

  // At least one session from each must overlap
  const sessionOverlap = candidate.sessions.some((cs) =>
    existing.sessions.some((es) => hasDateOverlap(cs, es))
  );
  return sessionOverlap;
}
```

- [ ] **Step 5.4: Run the dedupe tests — expect them to pass**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npx vitest run tests/scraper/dedupe.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5.5: Commit**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && git add src/scraper/dedupe.ts tests/scraper/dedupe.test.ts
git commit -m "feat(scraper): fuzzy deduplication — trigram + geo proximity + date overlap"
```

---

## Task 6: Upsert Layer

**Files:**
- Create: `src/scraper/upsert.ts`

This module writes a `ScrapedActivity` (after normalization) to Supabase. It upserts the organization, activity, location, sessions, and prices — handling both creates and updates idempotently via the `slug` unique key on activities.

- [ ] **Step 6.1: Create `src/scraper/upsert.ts`**

```typescript
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { ScrapedActivity, ScrapedPrice, ScrapedSession } from "@/scraper/types";
import { toSlug, priceToCents, assignCategories, extractAgeRange } from "@/scraper/normalize";
import { geocodeWithCache } from "@/scraper/geocode-cache";

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role env vars not set");
  return createClient(url, key);
}

export interface UpsertResult {
  activityId: string | null;
  created: boolean;
  errors: string[];
}

/**
 * Upserts a single scraped activity (plus its org, locations, sessions, prices)
 * into Supabase. Returns the activity UUID.
 */
export async function upsertActivity(
  scraped: ScrapedActivity,
  confidence: "high" | "medium" | "low" = "medium"
): Promise<UpsertResult> {
  const supabase = getServiceClient() as any;
  const errors: string[] = [];

  // --- 1. Upsert Organization ---
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .upsert(
      {
        name: scraped.organizationName,
        website: scraped.organizationWebsite ?? null,
      },
      { onConflict: "name", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (orgError || !org) {
    errors.push(`Org upsert failed: ${orgError?.message}`);
    return { activityId: null, created: false, errors };
  }
  const orgId: string = org.id;

  // --- 2. Normalize activity fields ---
  const name = scraped.name.trim();
  const slug = toSlug(name);
  const categories =
    scraped.categories?.length
      ? scraped.categories
      : assignCategories(name, scraped.description ?? "");
  const ageRange = scraped.ageText ? extractAgeRange(scraped.ageText) : null;

  const activityPayload = {
    organization_id: orgId,
    name,
    slug,
    description: scraped.description ?? null,
    categories,
    age_min: ageRange?.min ?? null,
    age_max: ageRange?.max ?? null,
    indoor_outdoor: scraped.indoorOutdoor,
    registration_url: scraped.registrationUrl ?? null,
    source_url: scraped.sourceUrl,
    scraped_at: new Date().toISOString(),
    data_confidence: confidence,
    is_active: true,
  };

  // --- 3. Upsert Activity ---
  const { data: activity, error: actError } = await supabase
    .from("activities")
    .upsert(activityPayload, { onConflict: "slug" })
    .select("id")
    .single();

  if (actError || !activity) {
    errors.push(`Activity upsert failed: ${actError?.message}`);
    return { activityId: null, created: false, errors };
  }
  const activityId: string = activity.id;

  // --- 4. Geocode & upsert primary location ---
  const geoResult = await geocodeWithCache(scraped.address);
  if (geoResult) {
    const locationPayload = {
      activity_id: activityId,
      address: scraped.address,
      location_name: scraped.locationName ?? null,
      // PostGIS geography point — Supabase accepts WKT via rpc or raw insert
      // Use raw string: POINT(lng lat)
      location: `POINT(${geoResult.lng} ${geoResult.lat})`,
    };
    const { error: locError } = await supabase
      .from("activity_locations")
      .upsert(locationPayload, { onConflict: "activity_id,address" });
    if (locError) {
      errors.push(`Location upsert failed: ${locError.message}`);
    }
  } else {
    errors.push(`Geocode failed for address: ${scraped.address}`);
  }

  // --- 5. Get the location ID we just upserted ---
  const { data: locationRow } = await supabase
    .from("activity_locations")
    .select("id")
    .eq("activity_id", activityId)
    .eq("address", scraped.address)
    .maybeSingle();
  const locationId: string | null = locationRow?.id ?? null;

  // --- 6. Upsert sessions ---
  for (const session of scraped.sessions) {
    const sessionPayload = {
      activity_id: activityId,
      activity_location_id: locationId,
      starts_at: session.startsAt,
      ends_at: session.endsAt,
      time_slot: session.timeSlot,
      hours_start: session.hoursStart ?? null,
      hours_end: session.hoursEnd ?? null,
      spots_available: session.spotsAvailable ?? null,
      is_sold_out: session.isSoldOut,
    };
    const { error: sessError } = await supabase
      .from("sessions")
      .upsert(sessionPayload, {
        onConflict: "activity_id,starts_at,ends_at,time_slot",
      });
    if (sessError) {
      errors.push(`Session upsert failed (${session.startsAt}): ${sessError.message}`);
    }
  }

  // --- 7. Upsert activity-level prices ---
  await upsertPrices(supabase, activityId, null, scraped.prices, confidence, errors);

  return { activityId, created: true, errors };
}

async function upsertPrices(
  supabase: any,
  activityId: string,
  sessionId: string | null,
  prices: ScrapedPrice[],
  confidence: "high" | "medium" | "low",
  errors: string[]
): Promise<void> {
  // Map confidence level: high scraper → verified, medium → scraped, low → llm_extracted
  const priceConfidence =
    confidence === "high" ? "verified" : confidence === "low" ? "llm_extracted" : "scraped";

  for (const price of prices) {
    const priceCents = priceToCents(price.priceString);
    if (priceCents === null) {
      errors.push(`Could not parse price "${price.priceString}" — skipped`);
      continue;
    }

    const payload = {
      activity_id: activityId,
      session_id: sessionId,
      label: price.label,
      price_cents: priceCents,
      price_unit: price.priceUnit,
      conditions: price.conditions ?? null,
      valid_from: price.validFrom ?? null,
      valid_until: price.validUntil ?? null,
      confidence: priceConfidence,
    };

    const { error } = await supabase
      .from("price_options")
      .upsert(payload, { onConflict: "activity_id,session_id,label" });
    if (error) {
      errors.push(`Price upsert failed ("${price.label}"): ${error.message}`);
    }
  }
}
```

- [ ] **Step 6.2: Verify TypeScript compiles**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npx tsc --noEmit
```

Expected: No new errors.

- [ ] **Step 6.3: Commit**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && git add src/scraper/upsert.ts
git commit -m "feat(scraper): upsert layer for activities, locations, sessions, and prices"
```

---

## Task 7: Pipeline Orchestrator

**Files:**
- Create: `src/scraper/pipeline.ts`

This is the core orchestrator. It reads a single `ScrapeSource` row, routes to the right adapter, normalizes, runs dedupe checks against existing DB records, geocodes, upserts, logs to `scrape_logs`, and handles error backoff.

- [ ] **Step 7.1: Create `src/scraper/pipeline.ts`**

```typescript
import { createClient } from "@supabase/supabase-js";
import { resolveAdapter } from "@/scraper/adapters/index";
import { upsertActivity } from "@/scraper/upsert";
import { isDuplicateOf, type DupeCandidate } from "@/scraper/dedupe";
import { geocodeWithCache } from "@/scraper/geocode-cache";
import { toSlug } from "@/scraper/normalize";
import type { ScrapedActivity } from "@/scraper/types";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role env vars not set");
  return createClient(url, key) as any;
}

export interface PipelineResult {
  sourceId: string;
  recordsFound: number;
  recordsUpserted: number;
  duplicatesSkipped: number;
  status: "success" | "partial" | "failed";
  errors: string[];
}

/**
 * Runs the full scrape pipeline for a single ScrapeSource row.
 * Writes a scrape_logs row on completion.
 */
export async function runSource(sourceId: string): Promise<PipelineResult> {
  const supabase = getServiceClient();
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsUpserted = 0;
  let duplicatesSkipped = 0;

  // --- 1. Load the source row ---
  const { data: source, error: sourceError } = await supabase
    .from("scrape_sources")
    .select("id, url, adapter_type, error_count, is_paused")
    .eq("id", sourceId)
    .single();

  if (sourceError || !source) {
    return {
      sourceId,
      recordsFound: 0,
      recordsUpserted: 0,
      duplicatesSkipped: 0,
      status: "failed",
      errors: [`Source not found: ${sourceId}`],
    };
  }

  if (source.is_paused) {
    return {
      sourceId,
      recordsFound: 0,
      recordsUpserted: 0,
      duplicatesSkipped: 0,
      status: "failed",
      errors: ["Source is paused"],
    };
  }

  // --- 2. Resolve adapter ---
  const adapter = resolveAdapter(source.adapter_type, source.url);
  if (!adapter) {
    const msg = `No adapter for type '${source.adapter_type}' url '${source.url}'`;
    errors.push(msg);
    await writeLog(supabase, sourceId, startedAt, "failed", 0, errors);
    await incrementErrorCount(supabase, sourceId, source.error_count);
    return { sourceId, recordsFound: 0, recordsUpserted: 0, duplicatesSkipped: 0, status: "failed", errors };
  }

  // --- 3. Fetch via adapter ---
  let adapterResult;
  try {
    adapterResult = await adapter.fetch();
  } catch (err) {
    const msg = `Adapter threw: ${err instanceof Error ? err.message : String(err)}`;
    errors.push(msg);
    await writeLog(supabase, sourceId, startedAt, "failed", 0, errors);
    await incrementErrorCount(supabase, sourceId, source.error_count);
    return { sourceId, recordsFound: 0, recordsUpserted: 0, duplicatesSkipped: 0, status: "failed", errors };
  }

  errors.push(...adapterResult.errors);
  recordsFound = adapterResult.activities.length;

  // --- 4. Load existing activities for dedupe check ---
  const existingCandidates = await loadExistingCandidates(supabase);

  // --- 5. Process each scraped activity ---
  const confidence = source.adapter_type === "dedicated" ? "high"
    : source.adapter_type === "generic_llm" ? "low"
    : "medium";

  for (const scraped of adapterResult.activities) {
    try {
      // Geocode to get lat/lng for dedupe check
      const geo = await geocodeWithCache(scraped.address);

      if (geo) {
        const candidate: DupeCandidate = {
          name: scraped.name,
          lat: geo.lat,
          lng: geo.lng,
          sessions: scraped.sessions.map((s) => ({
            startsAt: s.startsAt,
            endsAt: s.endsAt,
          })),
        };

        const isDupe = existingCandidates.some((ex) => isDuplicateOf(candidate, ex));
        if (isDupe) {
          duplicatesSkipped++;
          continue;
        }

        // Add to in-memory dedupe set so we don't also dedupe against ourselves
        existingCandidates.push(candidate);
      }

      const result = await upsertActivity(scraped, confidence as "high" | "medium" | "low");
      if (result.activityId) {
        recordsUpserted++;
      }
      errors.push(...result.errors);
    } catch (err) {
      errors.push(
        `Upsert failed for "${scraped.name}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // --- 6. Update source metadata ---
  const status: "success" | "partial" | "failed" =
    errors.length === 0 ? "success"
    : recordsUpserted > 0 ? "partial"
    : "failed";

  if (status === "failed") {
    await incrementErrorCount(supabase, sourceId, source.error_count);
  } else {
    // Reset error count on success/partial
    await supabase
      .from("scrape_sources")
      .update({ last_scraped_at: new Date().toISOString(), last_success_at: new Date().toISOString(), error_count: 0 })
      .eq("id", sourceId);
  }

  await writeLog(supabase, sourceId, startedAt, status, recordsFound, errors);

  return { sourceId, recordsFound, recordsUpserted, duplicatesSkipped, status, errors };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadExistingCandidates(supabase: any): Promise<DupeCandidate[]> {
  // Load existing activities with at least one session + a geocoded location
  const { data } = await supabase
    .from("activities")
    .select(`
      name,
      sessions(starts_at, ends_at),
      activity_locations(location)
    `)
    .eq("is_active", true)
    .limit(5000);

  if (!data) return [];

  return (data as any[]).flatMap((row) => {
    const locationRow = row.activity_locations?.[0];
    if (!locationRow?.location) return [];

    let lat = 0;
    let lng = 0;
    try {
      const geo =
        typeof locationRow.location === "string"
          ? JSON.parse(locationRow.location)
          : locationRow.location;
      [lng, lat] = geo.coordinates as [number, number];
    } catch {
      return [];
    }

    return [
      {
        name: row.name as string,
        lat,
        lng,
        sessions: (row.sessions ?? []).map((s: any) => ({
          startsAt: s.starts_at,
          endsAt: s.ends_at,
        })),
      },
    ];
  });
}

async function writeLog(
  supabase: any,
  sourceId: string,
  startedAt: string,
  status: "success" | "partial" | "failed",
  recordsFound: number,
  errors: string[]
): Promise<void> {
  await supabase.from("scrape_logs").insert({
    source_id: sourceId,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    status,
    records_found: recordsFound,
    errors: errors.length > 0 ? errors : null,
  });
}

async function incrementErrorCount(
  supabase: any,
  sourceId: string,
  currentCount: number
): Promise<void> {
  const newCount = currentCount + 1;
  const updates: Record<string, unknown> = {
    error_count: newCount,
    last_scraped_at: new Date().toISOString(),
  };

  // Pause after 3 consecutive failures
  if (newCount >= 3) {
    updates.is_paused = true;
    console.warn(`[scraper] Source ${sourceId} paused after ${newCount} consecutive failures`);
  }

  await supabase.from("scrape_sources").update(updates).eq("id", sourceId);
}
```

- [ ] **Step 7.2: Verify TypeScript compiles**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npx tsc --noEmit
```

Expected: No new errors.

- [ ] **Step 7.3: Commit**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && git add src/scraper/pipeline.ts
git commit -m "feat(scraper): pipeline orchestrator — fetch, normalize, dedupe, geocode, upsert, log"
```

---

## Task 8: CLI Runner

**Files:**
- Create: `src/scraper/run.ts`

- [ ] **Step 8.1: Create `src/scraper/run.ts`**

```typescript
/**
 * CLI runner for local testing and manual scrape triggering.
 *
 * Usage:
 *   npx tsx src/scraper/run.ts --source raleigh-parks
 *   npx tsx src/scraper/run.ts --all
 *   npx tsx src/scraper/run.ts --adapter-type dedicated
 *   npx tsx src/scraper/run.ts --dry-run --source raleigh-parks
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GOOGLE_MAPS_API_KEY
 *   ANTHROPIC_API_KEY   (only for generic_llm sources)
 */

import { createClient } from "@supabase/supabase-js";
import { runSource } from "@/scraper/pipeline";
import { getAdapter, getAllAdapters } from "@/scraper/adapters/index";

// Load .env.local manually (tsx doesn't auto-load it)
import { config } from "dotenv";
config({ path: ".env.local" });

function parseArgs(argv: string[]): {
  source?: string;
  all: boolean;
  adapterType?: string;
  dryRun: boolean;
} {
  const args = argv.slice(2);
  let source: string | undefined;
  let all = false;
  let adapterType: string | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) {
      source = args[++i];
    } else if (args[i] === "--all") {
      all = true;
    } else if (args[i] === "--adapter-type" && args[i + 1]) {
      adapterType = args[++i];
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  return { source, all, adapterType, dryRun };
}

async function main() {
  const { source, all, adapterType, dryRun } = parseArgs(process.argv);

  if (!source && !all && !adapterType) {
    console.error("Usage:");
    console.error("  npx tsx src/scraper/run.ts --source <adapter-name>");
    console.error("  npx tsx src/scraper/run.ts --all");
    console.error("  npx tsx src/scraper/run.ts --adapter-type dedicated|generic_llm");
    console.error("  Add --dry-run to see adapter output without writing to DB");
    process.exit(1);
  }

  if (dryRun) {
    await runDryRun(source, all);
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey) as any;

  // Build list of source IDs to run
  let sourceIds: string[] = [];

  if (source) {
    // Find by adapter name or URL
    const adapter = getAdapter(source);
    if (!adapter) {
      console.error(`No adapter found for name: ${source}`);
      process.exit(1);
    }
    const { data: sources } = await supabase
      .from("scrape_sources")
      .select("id")
      .eq("url", adapter.sourceUrl)
      .limit(1);
    if (!sources || sources.length === 0) {
      console.warn(`No scrape_sources row found for URL ${adapter.sourceUrl}.`);
      console.warn("Create a row in scrape_sources with that URL, then retry.");
      process.exit(1);
    }
    sourceIds = sources.map((r: any) => r.id as string);
  } else if (all || adapterType) {
    let query = supabase
      .from("scrape_sources")
      .select("id, adapter_type")
      .eq("is_paused", false);
    if (adapterType) {
      query = query.eq("adapter_type", adapterType);
    }
    const { data: sources } = await query;
    sourceIds = (sources ?? []).map((r: any) => r.id as string);
  }

  if (sourceIds.length === 0) {
    console.log("No matching sources found.");
    return;
  }

  console.log(`Running ${sourceIds.length} source(s)...`);

  for (const id of sourceIds) {
    console.log(`\n→ Source ${id}`);
    try {
      const result = await runSource(id);
      console.log(`  Status:     ${result.status}`);
      console.log(`  Found:      ${result.recordsFound}`);
      console.log(`  Upserted:   ${result.recordsUpserted}`);
      console.log(`  Dupes skip: ${result.duplicatesSkipped}`);
      if (result.errors.length > 0) {
        console.log(`  Errors (${result.errors.length}):`);
        result.errors.forEach((e) => console.log(`    - ${e}`));
      }
    } catch (err) {
      console.error(`  FATAL: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log("\nDone.");
}

async function runDryRun(source: string | undefined, all: boolean) {
  const adapters = source
    ? [getAdapter(source)].filter(Boolean)
    : getAllAdapters();

  if (adapters.length === 0) {
    console.error("No adapters to run.");
    process.exit(1);
  }

  for (const adapter of adapters) {
    if (!adapter) continue;
    console.log(`\n[DRY RUN] ${adapter.name} → ${adapter.sourceUrl}`);
    try {
      const result = await adapter.fetch();
      console.log(`  Activities found: ${result.activities.length}`);
      result.activities.slice(0, 3).forEach((a, i) => {
        console.log(`  [${i + 1}] ${a.name}`);
        console.log(`      org: ${a.organizationName}`);
        console.log(`      address: ${a.address}`);
        console.log(`      sessions: ${a.sessions.length}, prices: ${a.prices.length}`);
      });
      if (result.activities.length > 3) {
        console.log(`  ... and ${result.activities.length - 3} more`);
      }
      if (result.errors.length > 0) {
        console.log(`  Errors: ${result.errors.join("; ")}`);
      }
    } catch (err) {
      console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 8.2: Add dotenv as dev dependency (needed by CLI)**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm install --save-dev dotenv
```

- [ ] **Step 8.3: Verify TypeScript compiles**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npx tsc --noEmit
```

Expected: No new errors.

- [ ] **Step 8.4: Smoke-test the CLI dry run (no DB connection needed)**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npx tsx src/scraper/run.ts --dry-run --source raleigh-parks
```

Expected: Output showing the adapter attempted a fetch of `https://raleighnc.gov/parks/camps`. It may return 0 activities if the page structure doesn't match (expected in a dev environment without live internet) — that's acceptable. What matters is no crash.

- [ ] **Step 8.5: Commit**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && git add src/scraper/run.ts
git commit -m "feat(scraper): CLI runner — dry-run, single source, all sources, by adapter-type"
```

---

## Task 9: Vercel Cron Endpoint

**Files:**
- Create: `src/app/api/cron/scrape/route.ts`
- Modify: `next.config.ts` (to document the cron config note)
- Create: `vercel.json` (cron config)

- [ ] **Step 9.1: Create `src/app/api/cron/scrape/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runSource } from "@/scraper/pipeline";

/**
 * Vercel Cron handler for the scraping pipeline.
 * Scheduled via vercel.json: daily at 03:00 UTC.
 *
 * Vercel invokes this with the CRON_SECRET in the Authorization header.
 * Fan-out: iterates all non-paused sources and runs them sequentially.
 * For large source lists, upgrade to Vercel Workflow or queue each source
 * as an independent function invocation.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // Verify the cron secret to prevent unauthorized triggers
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("[cron/scrape] Missing Supabase env vars");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey) as any;

  // Determine which sources to run today:
  // - "daily" sources always run
  // - "weekly" sources run on Sunday (day 0)
  const today = new Date();
  const isSunday = today.getUTCDay() === 0;

  let query = supabase
    .from("scrape_sources")
    .select("id, scrape_frequency")
    .eq("is_paused", false);

  if (!isSunday) {
    query = query.eq("scrape_frequency", "daily");
  }

  const { data: sources, error } = await query;

  if (error) {
    console.error("[cron/scrape] Failed to load sources:", error.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const sourceIds: string[] = (sources ?? []).map((s: any) => s.id as string);

  if (sourceIds.length === 0) {
    return NextResponse.json({ message: "No sources to run", ran: 0 });
  }

  const results: Record<string, { status: string; found: number; upserted: number; errors: string[] }> = {};

  for (const sourceId of sourceIds) {
    try {
      const result = await runSource(sourceId);
      results[sourceId] = {
        status: result.status,
        found: result.recordsFound,
        upserted: result.recordsUpserted,
        errors: result.errors,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron/scrape] Fatal error for source ${sourceId}:`, msg);
      results[sourceId] = { status: "failed", found: 0, upserted: 0, errors: [msg] };
    }
  }

  const total = sourceIds.length;
  const succeeded = Object.values(results).filter((r) => r.status !== "failed").length;

  console.log(`[cron/scrape] Ran ${total} sources, ${succeeded} succeeded`);

  return NextResponse.json({ ran: total, succeeded, results });
}
```

- [ ] **Step 9.2: Create `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/scrape",
      "schedule": "0 3 * * *"
    }
  ]
}
```

This runs the scrape cron daily at 03:00 UTC. Vercel requires a Pro plan for cron jobs. The endpoint uses the `POST` method; Vercel Cron calls endpoints via POST with the `Authorization: Bearer <CRON_SECRET>` header.

- [ ] **Step 9.3: Add CRON_SECRET to your environment variables**

In your Vercel project dashboard (or via `vercel env add`):

```
CRON_SECRET=<generate a random 32-char string, e.g. openssl rand -hex 16>
```

Also add to `.env.local` for local testing:

```
CRON_SECRET=dev-only-secret
```

- [ ] **Step 9.4: Verify the route builds**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 9.5: Commit**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && git add src/app/api/cron/scrape/route.ts vercel.json
git commit -m "feat(scraper): Vercel Cron endpoint + vercel.json schedule"
```

---

## Task 10: Final Verification

- [ ] **Step 10.1: Run the full test suite**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm test
```

Expected output (all pass):

```
✓ tests/scraper/normalize.test.ts (8)
✓ tests/scraper/dedupe.test.ts (9)
✓ tests/scraper/llm-extractor.test.ts (4)
```

- [ ] **Step 10.2: Full TypeScript check**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npx tsc --noEmit
```

Expected: No errors (pre-existing `TODO: remove cast` comments in queries.ts are acceptable).

- [ ] **Step 10.3: Build check**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm run build
```

Expected: Build succeeds. The `src/scraper/` files are Node-only (not imported from pages/components), so they won't affect the browser bundle.

- [ ] **Step 10.4: Dry run both adapters**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npx tsx src/scraper/run.ts --dry-run --source raleigh-parks
npx tsx src/scraper/run.ts --dry-run --source ymca-triangle
```

Expected: Adapter fetches run (may return 0 results if pages are unreachable locally — that's fine). No crashes, no TypeScript errors at runtime.

- [ ] **Step 10.5: Final commit**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && git add -A
git commit -m "feat(scraper): complete scraping pipeline — adapters, LLM extractor, dedupe, upsert, cron"
```

---

## Environment Variables Reference

All required env vars for the scraping pipeline:

| Variable | Where needed | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | pipeline, upsert, geocode-cache, cron | Public Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | pipeline, upsert, geocode-cache, cron | Service role key — server only, never expose to client |
| `GOOGLE_MAPS_API_KEY` | geocode-cache (via lib/geocode.ts) | Geocoding API — restrict to server IPs in GCP console |
| `ANTHROPIC_API_KEY` | llm-extractor | Required only for Tier 3 / generic_llm sources |
| `CRON_SECRET` | cron route | Prevent unauthorized scrape triggers |

---

## Adding a New Tier 1 Adapter

1. Create `src/scraper/adapters/<name>.ts` exporting a `const <Name>Adapter: Adapter`.
2. Register it in `src/scraper/adapters/index.ts` under `ADAPTER_REGISTRY`.
3. Add a row to `scrape_sources` in Supabase: `url`, `adapter_type: 'dedicated'`, `scrape_frequency: 'daily'`.
4. Run `npx tsx src/scraper/run.ts --dry-run --source <name>` to verify.
