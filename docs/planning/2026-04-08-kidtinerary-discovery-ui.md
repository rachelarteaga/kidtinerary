# Kidtinerary Core Discovery UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core discovery experience — Explore page with search/filter/sort, camp cards, activity detail page, favorites, my kids, submit a camp, and report an issue — so parents can browse and save activities from the seed data.

**Architecture:** Server Components fetch data from Supabase. Client Components handle interactivity (search, filters, favorites toggling). All pages use the existing design tokens (Cream, Bark, Sunset, Campfire, Meadow, Lake, Driftwood, Sand, Stone) and existing components (Button, Tag). Supabase types are placeholder — use `as any` casts where needed and note it with `// TODO: remove cast when types are generated`.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS 4 (with `@theme` blocks in globals.css, no tailwind.config.ts), Supabase JS client v2, Vitest

**Known Limitations:**
- Supabase generated types are placeholders — all DB queries use `as any` casts
- Map view is a stub (list view only for MVP)
- "Add to Planner" shows a "Coming soon" toast (full planner is Plan 3)
- Infinite scroll deferred — uses simple pagination
- Next.js 16 uses `proxy.ts` instead of `middleware.ts`
- Dynamic pages need `export const dynamic = "force-dynamic"`

---

## File Structure

```
kidplan/src/
├── app/
│   ├── layout.tsx                          # Updated: wrap children with nav + toast provider
│   ├── page.tsx                            # Updated: redirect to /explore or show explore
│   ├── globals.css                         # Updated: add toast animation keyframes
│   ├── explore/
│   │   └── page.tsx                        # Explore/discovery page (search + results)
│   ├── activity/
│   │   └── [slug]/
│   │       └── page.tsx                    # Activity detail page
│   ├── favorites/
│   │   └── page.tsx                        # Saved favorites grid
│   ├── kids/
│   │   └── page.tsx                        # My Kids management page
│   ├── submit/
│   │   └── page.tsx                        # Submit a Camp form
│   └── auth/                               # (existing, unchanged)
├── components/
│   ├── ui/
│   │   ├── button.tsx                      # (existing, unchanged)
│   │   ├── tag.tsx                         # (existing, unchanged)
│   │   └── toast.tsx                       # Toast notification component
│   ├── layout/
│   │   └── nav.tsx                         # Sticky header navigation
│   ├── explore/
│   │   ├── search-bar.tsx                  # Hero search: keyword, age, category, date
│   │   ├── filter-sidebar.tsx              # Sidebar filters panel
│   │   ├── sort-bar.tsx                    # Sort dropdown + result count
│   │   └── activity-list.tsx               # Results list with pagination
│   ├── activity/
│   │   ├── camp-card.tsx                   # Card component for listings
│   │   ├── detail-hero.tsx                 # Activity detail hero section
│   │   ├── session-table.tsx               # Sessions with dates/availability
│   │   ├── price-table.tsx                 # Price options table
│   │   └── report-modal.tsx               # "Report an Issue" modal
│   ├── favorites/
│   │   └── favorite-button.tsx             # Heart toggle button (client)
│   └── kids/
│       ├── child-card.tsx                  # Child profile display card
│       └── child-form.tsx                  # Add/edit child form
├── lib/
│   ├── constants.ts                        # (existing, unchanged)
│   ├── queries.ts                          # Supabase query functions
│   ├── actions.ts                          # Server actions (favorites, reports, submit)
│   ├── format.ts                           # Price formatting, date formatting helpers
│   └── supabase/                           # (existing, unchanged)
└── tests/
    ├── components/
    │   └── activity/
    │       └── camp-card.test.tsx           # Camp card rendering tests
    └── lib/
        └── format.test.ts                  # Format utility tests
```

---

### Task 1: Navigation, Layout, Toast, and Format Utilities

**Files:**
- Create: `src/components/layout/nav.tsx`, `src/components/ui/toast.tsx`, `src/lib/format.ts`
- Modify: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`
- Create: `tests/lib/format.test.ts`

This task establishes the app shell that every subsequent page depends on: the sticky nav header, a toast system for feedback, and utility functions for formatting prices and dates.

- [ ] **Step 1: Create format utilities**

Create `src/lib/format.ts`:

```typescript
import type { PriceUnit, TimeSlot } from "./constants";

export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0
    ? `$${dollars.toFixed(0)}`
    : `$${dollars.toFixed(2)}`;
}

export function formatPriceUnit(unit: PriceUnit): string {
  const labels: Record<PriceUnit, string> = {
    per_week: "/week",
    per_day: "/day",
    per_session: "/session",
    per_block: "/block",
  };
  return labels[unit];
}

export function formatTimeSlot(slot: TimeSlot): string {
  const labels: Record<TimeSlot, string> = {
    full_day: "Full Day",
    am_half: "Morning",
    pm_half: "Afternoon",
  };
  return labels[slot];
}

export function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = s.toLocaleDateString("en-US", opts);
  const endStr = e.toLocaleDateString("en-US", opts);
  return `${startStr} – ${endStr}`;
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return minutes === 0 ? `${h}${ampm}` : `${h}:${minutes.toString().padStart(2, "0")}${ampm}`;
}

export function formatAgeRange(min: number | null, max: number | null): string {
  if (min != null && max != null) return `Ages ${min}–${max}`;
  if (min != null) return `Ages ${min}+`;
  if (max != null) return `Up to age ${max}`;
  return "All ages";
}

export function formatDataFreshness(date: string | null): string {
  if (!date) return "Not yet verified";
  const d = new Date(date);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  if (days < 14) return `Updated ${days} days ago`;
  return "Data may be stale";
}

export function categoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    sports: "Sports",
    arts: "Arts & Crafts",
    stem: "STEM",
    nature: "Nature",
    music: "Music",
    theater: "Theater",
    academic: "Academic",
    special_needs: "Special Needs",
    religious: "Religious",
    swimming: "Swimming",
    cooking: "Cooking",
    language: "Language",
  };
  return labels[cat] ?? cat;
}
```

- [ ] **Step 2: Create toast component**

Create `src/components/ui/toast.tsx`:

```typescript
"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface Toast {
  id: string;
  message: string;
  type: "info" | "success" | "error";
}

interface ToastContextValue {
  toast: (message: string, type?: Toast["type"]) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-toast-in rounded-xl px-4 py-3 shadow-lg font-sans text-sm max-w-sm ${
              t.type === "success"
                ? "bg-meadow text-white"
                : t.type === "error"
                  ? "bg-red-600 text-white"
                  : "bg-bark text-cream"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext>
  );
}
```

- [ ] **Step 3: Add toast animation to globals.css**

Add the following to the end of `src/app/globals.css` (after the existing `body` block):

```css
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

- [ ] **Step 4: Create navigation component**

Create `src/components/layout/nav.tsx`:

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/favorites", label: "Favorites" },
  { href: "/kids", label: "My Kids" },
] as const;

export function Nav() {
  const pathname = usePathname();

  // Hide nav on auth and onboarding pages
  const hideOn = ["/auth", "/onboarding"];
  if (hideOn.some((p) => pathname.startsWith(p))) return null;

  return (
    <header className="sticky top-0 z-40 bg-cream/95 backdrop-blur-sm border-b border-driftwood/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <Link href="/explore" className="flex items-center gap-2">
          <span className="font-serif text-xl text-bark">Kidtinerary</span>
        </Link>

        <nav className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2 rounded-lg font-mono text-xs uppercase tracking-widest transition-colors ${
                  isActive
                    ? "bg-bark/8 text-bark"
                    : "text-stone hover:text-bark hover:bg-bark/5"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/submit">
            <Button variant="outline" className="hidden sm:inline-flex text-[10px] px-4 py-2">
              Submit a Camp
            </Button>
          </Link>
        </div>

        {/* Mobile nav */}
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-cream border-t border-driftwood/50 flex justify-around py-2 z-40">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 font-mono text-[9px] uppercase tracking-wide ${
                  isActive ? "text-sunset" : "text-stone"
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

- [ ] **Step 5: Update root layout with nav and toast provider**

Replace the full `src/app/layout.tsx` with:

```typescript
import type { Metadata } from "next";
import { DM_Serif_Display, Inter, JetBrains_Mono } from "next/font/google";
import { Nav } from "@/components/layout/nav";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const dmSerif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dm-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
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
      className={`${dmSerif.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-cream text-bark font-sans antialiased">
        <ToastProvider>
          <Nav />
          <div className="pb-16 sm:pb-0">{children}</div>
        </ToastProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Update home page to redirect to explore**

Replace `src/app/page.tsx` with:

```typescript
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/explore");
}
```

- [ ] **Step 7: Add format utility tests**

Create `tests/lib/format.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  formatPrice,
  formatPriceUnit,
  formatTimeSlot,
  formatDateRange,
  formatTime,
  formatAgeRange,
  categoryLabel,
} from "@/lib/format";

describe("formatPrice", () => {
  it("formats whole dollar amounts without decimals", () => {
    expect(formatPrice(28500)).toBe("$285");
  });
  it("formats cents with two decimal places", () => {
    expect(formatPrice(28550)).toBe("$285.50");
  });
  it("formats zero", () => {
    expect(formatPrice(0)).toBe("$0");
  });
});

describe("formatPriceUnit", () => {
  it("returns /week for per_week", () => {
    expect(formatPriceUnit("per_week")).toBe("/week");
  });
  it("returns /block for per_block", () => {
    expect(formatPriceUnit("per_block")).toBe("/block");
  });
});

describe("formatTimeSlot", () => {
  it("returns Full Day for full_day", () => {
    expect(formatTimeSlot("full_day")).toBe("Full Day");
  });
  it("returns Morning for am_half", () => {
    expect(formatTimeSlot("am_half")).toBe("Morning");
  });
});

describe("formatDateRange", () => {
  it("formats a week range", () => {
    const result = formatDateRange("2026-06-15", "2026-06-19");
    expect(result).toContain("Jun");
    expect(result).toContain("15");
    expect(result).toContain("19");
  });
});

describe("formatTime", () => {
  it("formats morning time", () => {
    expect(formatTime("09:00")).toBe("9AM");
  });
  it("formats afternoon time with minutes", () => {
    expect(formatTime("13:30")).toBe("1:30PM");
  });
  it("formats noon", () => {
    expect(formatTime("12:00")).toBe("12PM");
  });
});

describe("formatAgeRange", () => {
  it("formats min and max", () => {
    expect(formatAgeRange(5, 9)).toBe("Ages 5–9");
  });
  it("formats min only", () => {
    expect(formatAgeRange(5, null)).toBe("Ages 5+");
  });
  it("formats max only", () => {
    expect(formatAgeRange(null, 9)).toBe("Up to age 9");
  });
  it("formats neither", () => {
    expect(formatAgeRange(null, null)).toBe("All ages");
  });
});

describe("categoryLabel", () => {
  it("returns human label for known category", () => {
    expect(categoryLabel("stem")).toBe("STEM");
    expect(categoryLabel("arts")).toBe("Arts & Crafts");
  });
  it("returns raw string for unknown category", () => {
    expect(categoryLabel("unknown")).toBe("unknown");
  });
});
```

- [ ] **Step 8: Add protected route for favorites**

Update `src/lib/supabase/middleware.ts` — in the `protectedPaths` array, ensure `/favorites` and `/kids` are listed. They already are (`/favorites` and `/kids`), but verify the middleware has:

```typescript
const protectedPaths = ["/onboarding", "/planner", "/favorites", "/kids"];
```

This is already correct in the existing middleware. No change needed.

- [ ] **Step 9: Run tests**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm test
```

Confirm all format tests pass along with existing tests.

---

### Task 2: Supabase Queries and Server Actions

**Files:**
- Create: `src/lib/queries.ts`, `src/lib/actions.ts`

This task builds the data layer — all Supabase queries and server actions that the UI pages will call. Having these in place before building pages lets each page task focus on UI.

- [ ] **Step 1: Create query functions**

Create `src/lib/queries.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";

export interface ActivityFilters {
  keyword?: string;
  categories?: string[];
  ageMin?: number;
  ageMax?: number;
  indoorOutdoor?: string;
  timeSlot?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "price_low" | "price_high" | "name";
  page?: number;
  pageSize?: number;
}

export interface ActivityRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categories: string[];
  age_min: number | null;
  age_max: number | null;
  indoor_outdoor: string;
  registration_url: string | null;
  data_confidence: string;
  is_active: boolean;
  organization: { id: string; name: string; website: string | null } | null;
  activity_locations: { id: string; address: string; location_name: string | null }[];
  sessions: {
    id: string;
    starts_at: string;
    ends_at: string;
    time_slot: string;
    hours_start: string | null;
    hours_end: string | null;
    is_sold_out: boolean;
    spots_available: number | null;
  }[];
  price_options: {
    id: string;
    label: string;
    price_cents: number;
    price_unit: string;
    conditions: string | null;
    confidence: string;
  }[];
}

const PAGE_SIZE = 12;

export async function fetchActivities(filters: ActivityFilters = {}) {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("activities")
    .select(
      `
      id, name, slug, description, categories, age_min, age_max,
      indoor_outdoor, registration_url, data_confidence, is_active,
      organization:organizations!inner(id, name, website),
      activity_locations(id, address, location_name),
      sessions(id, starts_at, ends_at, time_slot, hours_start, hours_end, is_sold_out, spots_available),
      price_options(id, label, price_cents, price_unit, conditions, confidence)
    `,
      { count: "exact" }
    )
    .eq("is_active", true);

  // Keyword search
  if (filters.keyword) {
    query = query.or(
      `name.ilike.%${filters.keyword}%,description.ilike.%${filters.keyword}%`
    );
  }

  // Category filter
  if (filters.categories && filters.categories.length > 0) {
    query = query.overlaps("categories", filters.categories);
  }

  // Age filter: activities whose range overlaps the requested range
  if (filters.ageMin != null) {
    query = query.or(`age_max.gte.${filters.ageMin},age_max.is.null`);
  }
  if (filters.ageMax != null) {
    query = query.or(`age_min.lte.${filters.ageMax},age_min.is.null`);
  }

  // Indoor/outdoor
  if (filters.indoorOutdoor && filters.indoorOutdoor !== "all") {
    query = query.or(
      `indoor_outdoor.eq.${filters.indoorOutdoor},indoor_outdoor.eq.both`
    );
  }

  // Sorting
  switch (filters.sortBy) {
    case "price_low":
      query = query.order("name", { ascending: true });
      break;
    case "price_high":
      query = query.order("name", { ascending: false });
      break;
    case "name":
    default:
      query = query.order("name", { ascending: true });
      break;
  }

  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error("fetchActivities error:", error);
    return { activities: [] as ActivityRow[], total: 0 };
  }

  let activities = (data ?? []) as ActivityRow[];

  // Client-side price sort (Supabase can't sort by nested relation)
  if (filters.sortBy === "price_low" || filters.sortBy === "price_high") {
    activities = activities.sort((a, b) => {
      const aMin = Math.min(...(a.price_options?.map((p) => p.price_cents) ?? [Infinity]));
      const bMin = Math.min(...(b.price_options?.map((p) => p.price_cents) ?? [Infinity]));
      return filters.sortBy === "price_low" ? aMin - bMin : bMin - aMin;
    });
  }

  return { activities, total: count ?? 0 };
}

export async function fetchActivityBySlug(slug: string): Promise<ActivityRow | null> {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from("activities")
    .select(
      `
      id, name, slug, description, categories, age_min, age_max,
      indoor_outdoor, registration_url, data_confidence, is_active,
      scraped_at, last_verified_at, source_url,
      organization:organizations!inner(id, name, website),
      activity_locations(id, address, location_name),
      sessions(id, starts_at, ends_at, time_slot, hours_start, hours_end, is_sold_out, spots_available),
      price_options(id, label, price_cents, price_unit, conditions, confidence)
    `
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) {
    console.error("fetchActivityBySlug error:", error);
    return null;
  }

  return data as ActivityRow;
}

export async function fetchUserFavoriteIds(userId: string): Promise<string[]> {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from("favorites")
    .select("activity_id")
    .eq("user_id", userId);

  if (error) {
    console.error("fetchUserFavoriteIds error:", error);
    return [];
  }

  return (data ?? []).map((f: any) => f.activity_id);
}

export async function fetchFavoriteActivities(userId: string) {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const { data: favs, error: favError } = await supabase
    .from("favorites")
    .select("activity_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (favError || !favs || favs.length === 0) {
    return [];
  }

  const activityIds = favs.map((f: any) => f.activity_id);

  const { data, error } = await supabase
    .from("activities")
    .select(
      `
      id, name, slug, description, categories, age_min, age_max,
      indoor_outdoor, registration_url, data_confidence, is_active,
      organization:organizations!inner(id, name, website),
      activity_locations(id, address, location_name),
      sessions(id, starts_at, ends_at, time_slot, hours_start, hours_end, is_sold_out, spots_available),
      price_options(id, label, price_cents, price_unit, conditions, confidence)
    `
    )
    .in("id", activityIds)
    .eq("is_active", true);

  if (error) {
    console.error("fetchFavoriteActivities error:", error);
    return [];
  }

  return (data ?? []) as ActivityRow[];
}

export async function fetchChildren(userId: string) {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from("children")
    .select("id, name, birth_date, interests, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("fetchChildren error:", error);
    return [];
  }

  return data ?? [];
}
```

- [ ] **Step 2: Create server actions**

Create `src/lib/actions.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleFavorite(activityId: string) {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Check if already favorited
  const { data: existing } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("activity_id", activityId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("id", existing.id);

    if (error) return { error: "Failed to remove favorite" };
    revalidatePath("/favorites");
    revalidatePath("/explore");
    return { favorited: false };
  } else {
    const { error } = await supabase
      .from("favorites")
      .insert({ user_id: user.id, activity_id: activityId });

    if (error) return { error: "Failed to add favorite" };
    revalidatePath("/favorites");
    revalidatePath("/explore");
    return { favorited: true };
  }
}

export async function submitReport(
  activityId: string,
  reason: string,
  details: string
) {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase.from("activity_reports").insert({
    user_id: user.id,
    activity_id: activityId,
    reason,
    details: details || null,
    status: "pending",
  });

  if (error) {
    console.error("submitReport error:", error);
    return { error: "Failed to submit report" };
  }

  return { success: true };
}

export async function submitCampUrl(url: string) {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Check if URL already exists
  const { data: existing } = await supabase
    .from("scrape_sources")
    .select("id")
    .eq("url", url)
    .maybeSingle();

  if (existing) {
    return { error: "This URL has already been submitted" };
  }

  const { error } = await supabase.from("scrape_sources").insert({
    url,
    adapter_type: "generic_llm",
    scrape_frequency: "weekly",
  });

  if (error) {
    console.error("submitCampUrl error:", error);
    return { error: "Failed to submit camp" };
  }

  return { success: true };
}

export async function addChild(name: string, birthDate: string, interests: string[]) {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase.from("children").insert({
    user_id: user.id,
    name,
    birth_date: birthDate,
    interests,
  });

  if (error) {
    console.error("addChild error:", error);
    return { error: "Failed to add child" };
  }

  revalidatePath("/kids");
  return { success: true };
}

export async function updateChild(
  childId: string,
  name: string,
  birthDate: string,
  interests: string[]
) {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("children")
    .update({ name, birth_date: birthDate, interests })
    .eq("id", childId)
    .eq("user_id", user.id);

  if (error) {
    console.error("updateChild error:", error);
    return { error: "Failed to update child" };
  }

  revalidatePath("/kids");
  return { success: true };
}

export async function deleteChild(childId: string) {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("children")
    .delete()
    .eq("id", childId)
    .eq("user_id", user.id);

  if (error) {
    console.error("deleteChild error:", error);
    return { error: "Failed to delete child" };
  }

  revalidatePath("/kids");
  return { success: true };
}
```

- [ ] **Step 3: Run lint check**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm run lint
```

Fix any lint errors before proceeding.

---

### Task 3: Camp Card and Favorite Button Components

**Files:**
- Create: `src/components/activity/camp-card.tsx`, `src/components/favorites/favorite-button.tsx`
- Create: `tests/components/activity/camp-card.test.tsx`

The camp card is the core UI atom — used on Explore, Favorites, and curated sections. The favorite button is a client component that calls the toggleFavorite server action.

- [ ] **Step 1: Create the favorite button**

Create `src/components/favorites/favorite-button.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { toggleFavorite } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";

interface FavoriteButtonProps {
  activityId: string;
  initialFavorited: boolean;
  className?: string;
}

export function FavoriteButton({
  activityId,
  initialFavorited,
  className = "",
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const result = await toggleFavorite(activityId);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      setFavorited(result.favorited ?? false);
      toast(
        result.favorited ? "Added to favorites" : "Removed from favorites",
        "success"
      );
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
        favorited
          ? "bg-sunset/15 text-sunset"
          : "bg-bark/5 text-driftwood hover:text-sunset hover:bg-sunset/10"
      } ${isPending ? "opacity-50" : ""} ${className}`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={favorited ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
```

- [ ] **Step 2: Create the camp card component**

Create `src/components/activity/camp-card.tsx`:

```typescript
import Link from "next/link";
import { Tag } from "@/components/ui/tag";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import { formatPrice, formatPriceUnit, formatAgeRange, formatTimeSlot, categoryLabel } from "@/lib/format";
import { CATEGORY_COLORS, type Category } from "@/lib/constants";
import type { ActivityRow } from "@/lib/queries";

interface CampCardProps {
  activity: ActivityRow;
  isFavorited: boolean;
  showFavorite?: boolean;
}

export function CampCard({ activity, isFavorited, showFavorite = true }: CampCardProps) {
  const lowestPrice = activity.price_options?.length
    ? activity.price_options.reduce((min, p) => (p.price_cents < min.price_cents ? p : min), activity.price_options[0])
    : null;

  const primaryCategory = activity.categories?.[0] as Category | undefined;
  const categoryColor = primaryCategory ? CATEGORY_COLORS[primaryCategory] : null;

  const firstSession = activity.sessions?.[0];
  const sessionCount = activity.sessions?.length ?? 0;

  const location = activity.activity_locations?.[0];

  return (
    <Link
      href={`/activity/${activity.slug}`}
      className="group block bg-white rounded-2xl border border-driftwood/30 shadow-sm hover:shadow-md transition-all overflow-hidden"
    >
      {/* Category color bar */}
      <div
        className={`h-1.5 w-full ${categoryColor?.bg ?? "bg-driftwood/20"}`}
        style={{
          backgroundColor: primaryCategory
            ? `color-mix(in srgb, ${getHex(primaryCategory)} 30%, transparent)`
            : undefined,
        }}
      />

      <div className="p-5">
        {/* Top row: category icon + favorite */}
        <div className="flex items-start justify-between mb-3">
          {/* Category icon */}
          {primaryCategory && (
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm ${categoryColor?.bg ?? ""} ${categoryColor?.text ?? ""}`}
              style={{ transform: "rotate(-3deg)" }}
            >
              {getCategoryEmoji(primaryCategory)}
            </div>
          )}
          {showFavorite && (
            <FavoriteButton activityId={activity.id} initialFavorited={isFavorited} />
          )}
        </div>

        {/* Name and org */}
        <h3 className="font-serif text-lg leading-tight mb-1 group-hover:text-sunset transition-colors">
          {activity.name}
        </h3>
        {activity.organization && (
          <p className="font-mono text-[10px] uppercase tracking-wide text-stone mb-3">
            {(activity.organization as any).name}
          </p>
        )}

        {/* Tags row */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Tag type="age" label={formatAgeRange(activity.age_min, activity.age_max)} />
          {activity.categories?.slice(0, 2).map((cat) => (
            <Tag key={cat} type="category" label={categoryLabel(cat)} />
          ))}
          {firstSession && (
            <Tag type="schedule" label={formatTimeSlot(firstSession.time_slot as any)} />
          )}
        </div>

        {/* Location */}
        {location && (
          <p className="text-xs text-stone mb-3 truncate">
            {(location as any).location_name ?? (location as any).address}
          </p>
        )}

        {/* Bottom row: price + sessions */}
        <div className="flex items-end justify-between pt-2 border-t border-driftwood/20">
          {lowestPrice ? (
            <div>
              <span className="font-mono text-base font-medium text-bark">
                {formatPrice(lowestPrice.price_cents)}
              </span>
              <span className="font-mono text-[10px] text-stone uppercase tracking-wide ml-0.5">
                {formatPriceUnit(lowestPrice.price_unit as any)}
              </span>
            </div>
          ) : (
            <span className="font-mono text-xs text-stone uppercase">Price TBD</span>
          )}
          {sessionCount > 0 && (
            <span className="font-mono text-[10px] text-stone uppercase tracking-wide">
              {sessionCount} {sessionCount === 1 ? "session" : "sessions"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function getCategoryEmoji(cat: string): string {
  const emojis: Record<string, string> = {
    sports: "⚽",
    arts: "🎨",
    stem: "🔬",
    nature: "🌿",
    music: "🎵",
    theater: "🎭",
    academic: "📚",
    special_needs: "💛",
    religious: "⛪",
    swimming: "🏊",
    cooking: "🍳",
    language: "🗣️",
  };
  return emojis[cat] ?? "📌";
}

function getHex(cat: string): string {
  const hexes: Record<string, string> = {
    sports: "#D4A574",
    arts: "#E07845",
    stem: "#6B8CBB",
    nature: "#5A8F6E",
    music: "#D4A574",
    theater: "#E07845",
    academic: "#6B8CBB",
    special_needs: "#5A8F6E",
    religious: "#D4A574",
    swimming: "#6B8CBB",
    cooking: "#E07845",
    language: "#6B8CBB",
  };
  return hexes[cat] ?? "#C4BFB4";
}
```

- [ ] **Step 3: Create camp card tests**

Create `tests/components/activity/camp-card.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CampCard } from "@/components/activity/camp-card";
import type { ActivityRow } from "@/lib/queries";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock favorite button to avoid server action import
vi.mock("@/components/favorites/favorite-button", () => ({
  FavoriteButton: ({ activityId }: { activityId: string }) => (
    <button data-testid={`fav-${activityId}`}>fav</button>
  ),
}));

const mockActivity: ActivityRow = {
  id: "test-id",
  name: "Nature Explorers Camp",
  slug: "nature-explorers-camp",
  description: "A fun nature camp",
  categories: ["nature", "arts"],
  age_min: 5,
  age_max: 9,
  indoor_outdoor: "outdoor",
  registration_url: "https://example.com",
  data_confidence: "high",
  is_active: true,
  organization: { id: "org-1", name: "Raleigh Parks", website: null },
  activity_locations: [{ id: "loc-1", address: "123 Main St", location_name: "Central Park" }],
  sessions: [
    {
      id: "s-1",
      starts_at: "2026-06-15",
      ends_at: "2026-06-19",
      time_slot: "full_day",
      hours_start: "09:00",
      hours_end: "15:00",
      is_sold_out: false,
      spots_available: null,
    },
  ],
  price_options: [
    {
      id: "p-1",
      label: "Standard",
      price_cents: 28500,
      price_unit: "per_week",
      conditions: null,
      confidence: "verified",
    },
  ],
};

describe("CampCard", () => {
  it("renders activity name", () => {
    render(<CampCard activity={mockActivity} isFavorited={false} />);
    expect(screen.getByText("Nature Explorers Camp")).toBeInTheDocument();
  });

  it("renders organization name", () => {
    render(<CampCard activity={mockActivity} isFavorited={false} />);
    expect(screen.getByText("Raleigh Parks")).toBeInTheDocument();
  });

  it("renders price", () => {
    render(<CampCard activity={mockActivity} isFavorited={false} />);
    expect(screen.getByText("$285")).toBeInTheDocument();
  });

  it("renders age range tag", () => {
    render(<CampCard activity={mockActivity} isFavorited={false} />);
    expect(screen.getByText("Ages 5–9")).toBeInTheDocument();
  });

  it("links to activity detail page", () => {
    render(<CampCard activity={mockActivity} isFavorited={false} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/activity/nature-explorers-camp");
  });

  it("renders session count", () => {
    render(<CampCard activity={mockActivity} isFavorited={false} />);
    expect(screen.getByText("1 session")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm test
```

---

### Task 4: Explore Page with Search, Filters, and Pagination

**Files:**
- Create: `src/app/explore/page.tsx`, `src/components/explore/search-bar.tsx`, `src/components/explore/filter-sidebar.tsx`, `src/components/explore/sort-bar.tsx`, `src/components/explore/activity-list.tsx`

The Explore page is the main discovery surface. It uses URL search params for filter state (shareable URLs, back-button friendly), a Server Component page that fetches data, and Client Components for the interactive search/filter UI.

- [ ] **Step 1: Create the search bar component**

Create `src/components/explore/search-bar.tsx`:

```typescript
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CATEGORIES, type Category } from "@/lib/constants";
import { categoryLabel } from "@/lib/format";

export function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [keyword, setKeyword] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [ageMin, setAgeMin] = useState(searchParams.get("age_min") ?? "");
  const [ageMax, setAgeMax] = useState(searchParams.get("age_max") ?? "");

  const handleSearch = useCallback(() => {
    const params = new URLSearchParams();
    if (keyword.trim()) params.set("q", keyword.trim());
    if (category) params.set("category", category);
    if (ageMin) params.set("age_min", ageMin);
    if (ageMax) params.set("age_max", ageMax);
    router.push(`/explore?${params.toString()}`);
  }, [keyword, category, ageMin, ageMax, router]);

  return (
    <div className="bg-white rounded-2xl border border-driftwood/30 shadow-sm p-4 sm:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Keyword */}
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wide text-stone mb-1.5">
            Search
          </label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Soccer, art, STEM..."
            className="w-full px-3 py-2 rounded-lg border border-driftwood/50 bg-cream/50 text-bark placeholder:text-driftwood text-sm focus:outline-none focus:border-sunset focus:ring-1 focus:ring-sunset/30"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wide text-stone mb-1.5">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-driftwood/50 bg-cream/50 text-bark text-sm focus:outline-none focus:border-sunset focus:ring-1 focus:ring-sunset/30"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {categoryLabel(cat)}
              </option>
            ))}
          </select>
        </div>

        {/* Age Range */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block font-mono text-[10px] uppercase tracking-wide text-stone mb-1.5">
              Age Min
            </label>
            <input
              type="number"
              min={3}
              max={12}
              value={ageMin}
              onChange={(e) => setAgeMin(e.target.value)}
              placeholder="3"
              className="w-full px-3 py-2 rounded-lg border border-driftwood/50 bg-cream/50 text-bark text-sm focus:outline-none focus:border-sunset focus:ring-1 focus:ring-sunset/30"
            />
          </div>
          <div className="flex-1">
            <label className="block font-mono text-[10px] uppercase tracking-wide text-stone mb-1.5">
              Age Max
            </label>
            <input
              type="number"
              min={3}
              max={12}
              value={ageMax}
              onChange={(e) => setAgeMax(e.target.value)}
              placeholder="12"
              className="w-full px-3 py-2 rounded-lg border border-driftwood/50 bg-cream/50 text-bark text-sm focus:outline-none focus:border-sunset focus:ring-1 focus:ring-sunset/30"
            />
          </div>
        </div>

        {/* Search button */}
        <div className="flex items-end">
          <Button onClick={handleSearch} className="w-full">
            Search
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the filter sidebar component**

Create `src/components/explore/filter-sidebar.tsx`:

```typescript
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CATEGORIES, INDOOR_OUTDOOR, TIME_SLOTS } from "@/lib/constants";
import { categoryLabel, formatTimeSlot } from "@/lib/format";

export function FilterSidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page"); // Reset to page 1 on filter change
    router.push(`/explore?${params.toString()}`);
  }

  function toggleCategory(cat: string) {
    const current = searchParams.get("categories")?.split(",").filter(Boolean) ?? [];
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    updateParam("categories", next.join(","));
  }

  const activeCategories = searchParams.get("categories")?.split(",").filter(Boolean) ?? [];
  const activeIndoorOutdoor = searchParams.get("indoor_outdoor") ?? "";
  const activeTimeSlot = searchParams.get("time_slot") ?? "";

  const hasFilters = activeCategories.length > 0 || activeIndoorOutdoor || activeTimeSlot;

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("categories");
    params.delete("indoor_outdoor");
    params.delete("time_slot");
    params.delete("page");
    router.push(`/explore?${params.toString()}`);
  }

  return (
    <aside className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-xs uppercase tracking-widest text-stone">Filters</h3>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="font-mono text-[10px] uppercase tracking-wide text-sunset hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Categories */}
      <div>
        <h4 className="font-mono text-[10px] uppercase tracking-wide text-stone mb-2">
          Category
        </h4>
        <div className="space-y-1">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategories.includes(cat);
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`block w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-sunset/10 text-sunset font-medium"
                    : "text-bark hover:bg-bark/5"
                }`}
              >
                {categoryLabel(cat)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Indoor/Outdoor */}
      <div>
        <h4 className="font-mono text-[10px] uppercase tracking-wide text-stone mb-2">
          Setting
        </h4>
        <div className="space-y-1">
          <button
            onClick={() => updateParam("indoor_outdoor", "")}
            className={`block w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
              !activeIndoorOutdoor ? "bg-bark/8 text-bark font-medium" : "text-bark hover:bg-bark/5"
            }`}
          >
            All
          </button>
          {INDOOR_OUTDOOR.map((io) => (
            <button
              key={io}
              onClick={() => updateParam("indoor_outdoor", io)}
              className={`block w-full text-left px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                activeIndoorOutdoor === io
                  ? "bg-sunset/10 text-sunset font-medium"
                  : "text-bark hover:bg-bark/5"
              }`}
            >
              {io}
            </button>
          ))}
        </div>
      </div>

      {/* Time Slot */}
      <div>
        <h4 className="font-mono text-[10px] uppercase tracking-wide text-stone mb-2">
          Schedule
        </h4>
        <div className="space-y-1">
          <button
            onClick={() => updateParam("time_slot", "")}
            className={`block w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
              !activeTimeSlot ? "bg-bark/8 text-bark font-medium" : "text-bark hover:bg-bark/5"
            }`}
          >
            Any
          </button>
          {TIME_SLOTS.map((slot) => (
            <button
              key={slot}
              onClick={() => updateParam("time_slot", slot)}
              className={`block w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                activeTimeSlot === slot
                  ? "bg-sunset/10 text-sunset font-medium"
                  : "text-bark hover:bg-bark/5"
              }`}
            >
              {formatTimeSlot(slot)}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Create the sort bar component**

Create `src/components/explore/sort-bar.tsx`:

```typescript
"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface SortBarProps {
  total: number;
}

export function SortBar({ total }: SortBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort") ?? "name";

  function handleSort(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    params.delete("page");
    router.push(`/explore?${params.toString()}`);
  }

  return (
    <div className="flex items-center justify-between mb-4">
      <p className="font-mono text-xs text-stone uppercase tracking-wide">
        {total} {total === 1 ? "activity" : "activities"} found
      </p>
      <div className="flex items-center gap-2">
        <label className="font-mono text-[10px] text-stone uppercase tracking-wide">
          Sort by
        </label>
        <select
          value={currentSort}
          onChange={(e) => handleSort(e.target.value)}
          className="px-2 py-1 rounded-lg border border-driftwood/50 bg-cream/50 text-bark text-xs focus:outline-none focus:border-sunset"
        >
          <option value="name">Name</option>
          <option value="price_low">Price: Low to High</option>
          <option value="price_high">Price: High to Low</option>
        </select>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the activity list with pagination**

Create `src/components/explore/activity-list.tsx`:

```typescript
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CampCard } from "@/components/activity/camp-card";
import { Button } from "@/components/ui/button";
import type { ActivityRow } from "@/lib/queries";

interface ActivityListProps {
  activities: ActivityRow[];
  favoriteIds: string[];
  total: number;
  page: number;
  pageSize: number;
}

export function ActivityList({
  activities,
  favoriteIds,
  total,
  page,
  pageSize,
}: ActivityListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.ceil(total / pageSize);

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", p.toString());
    router.push(`/explore?${params.toString()}`);
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-16">
        <h3 className="font-serif text-2xl mb-2">No activities found</h3>
        <p className="text-stone">
          Try adjusting your filters or search for something else.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {activities.map((activity) => (
          <CampCard
            key={activity.id}
            activity={activity}
            isFavorited={favoriteIds.includes(activity.id)}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="ghost"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="font-mono text-xs text-stone uppercase tracking-wide px-3">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="ghost"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create the Explore page**

Create `src/app/explore/page.tsx`:

```typescript
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { fetchActivities, fetchUserFavoriteIds, type ActivityFilters } from "@/lib/queries";
import { SearchBar } from "@/components/explore/search-bar";
import { FilterSidebar } from "@/components/explore/filter-sidebar";
import { SortBar } from "@/components/explore/sort-bar";
import { ActivityList } from "@/components/explore/activity-list";

export const dynamic = "force-dynamic";

interface ExplorePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = await searchParams;

  // Build filters from URL search params
  const filters: ActivityFilters = {};
  if (typeof params.q === "string") filters.keyword = params.q;
  if (typeof params.category === "string") filters.categories = [params.category];
  if (typeof params.categories === "string" && params.categories) {
    filters.categories = params.categories.split(",").filter(Boolean);
  }
  if (typeof params.age_min === "string") filters.ageMin = parseInt(params.age_min, 10) || undefined;
  if (typeof params.age_max === "string") filters.ageMax = parseInt(params.age_max, 10) || undefined;
  if (typeof params.indoor_outdoor === "string") filters.indoorOutdoor = params.indoor_outdoor;
  if (typeof params.sort === "string") filters.sortBy = params.sort as ActivityFilters["sortBy"];

  const page = typeof params.page === "string" ? parseInt(params.page, 10) || 1 : 1;
  filters.page = page;

  const { activities, total } = await fetchActivities(filters);

  // Get user favorites (if logged in)
  let favoriteIds: string[] = [];
  try {
    // TODO: remove cast when types are generated
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      favoriteIds = await fetchUserFavoriteIds(user.id);
    }
  } catch {
    // Not logged in — that's fine
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero / Search */}
      <div className="mb-8">
        <h1 className="font-serif text-4xl sm:text-5xl mb-2">
          Find something they&apos;ll love
        </h1>
        <p className="text-stone text-lg mb-6">
          Camps, classes, and activities for kids in the Raleigh area.
        </p>
        <Suspense fallback={<div className="h-24 bg-white rounded-2xl animate-pulse" />}>
          <SearchBar />
        </Suspense>
      </div>

      {/* Main content: sidebar + results */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Filters sidebar (desktop) */}
        <div className="hidden lg:block w-56 flex-shrink-0">
          <Suspense fallback={null}>
            <FilterSidebar />
          </Suspense>
        </div>

        {/* Results */}
        <div className="flex-1 min-w-0">
          <Suspense fallback={null}>
            <SortBar total={total} />
          </Suspense>
          <Suspense
            fallback={
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl border border-driftwood/30 h-72 animate-pulse"
                  />
                ))}
              </div>
            }
          >
            <ActivityList
              activities={activities}
              favoriteIds={favoriteIds}
              total={total}
              page={page}
              pageSize={12}
            />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Run build check**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm run build 2>&1 | head -50
```

Fix any TypeScript or build errors. Common issues: import paths, missing `"use client"` directives. Run `npm test` to confirm all tests still pass.

---

### Task 5: Activity Detail Page with Sessions, Prices, and Report Modal

**Files:**
- Create: `src/app/activity/[slug]/page.tsx`, `src/components/activity/detail-hero.tsx`, `src/components/activity/session-table.tsx`, `src/components/activity/price-table.tsx`, `src/components/activity/report-modal.tsx`

The Activity Detail page shows all structured data for one activity, with a prominent "Visit Camp Website" CTA, session availability, pricing, and a report-an-issue modal.

- [ ] **Step 1: Create the detail hero component**

Create `src/components/activity/detail-hero.tsx`:

```typescript
import { Tag } from "@/components/ui/tag";
import { formatAgeRange, categoryLabel } from "@/lib/format";
import { CATEGORY_COLORS, type Category } from "@/lib/constants";
import type { ActivityRow } from "@/lib/queries";

interface DetailHeroProps {
  activity: ActivityRow;
}

export function DetailHero({ activity }: DetailHeroProps) {
  const primaryCategory = activity.categories?.[0] as Category | undefined;
  const categoryColor = primaryCategory ? CATEGORY_COLORS[primaryCategory] : null;

  const gradients: Record<string, string> = {
    sports: "from-[#D4A574]/20 to-[#D4A574]/5",
    arts: "from-[#E07845]/20 to-[#E07845]/5",
    stem: "from-[#6B8CBB]/20 to-[#6B8CBB]/5",
    nature: "from-[#5A8F6E]/20 to-[#5A8F6E]/5",
    music: "from-[#D4A574]/20 to-[#D4A574]/5",
    theater: "from-[#E07845]/20 to-[#E07845]/5",
    academic: "from-[#6B8CBB]/20 to-[#6B8CBB]/5",
    special_needs: "from-[#5A8F6E]/20 to-[#5A8F6E]/5",
    religious: "from-[#D4A574]/20 to-[#D4A574]/5",
    swimming: "from-[#6B8CBB]/20 to-[#6B8CBB]/5",
    cooking: "from-[#E07845]/20 to-[#E07845]/5",
    language: "from-[#6B8CBB]/20 to-[#6B8CBB]/5",
  };

  const gradient = primaryCategory
    ? gradients[primaryCategory] ?? "from-driftwood/20 to-driftwood/5"
    : "from-driftwood/20 to-driftwood/5";

  return (
    <div className={`bg-gradient-to-b ${gradient} rounded-2xl p-6 sm:p-10 mb-8`}>
      {/* Breadcrumb */}
      <p className="font-mono text-[10px] uppercase tracking-wide text-stone mb-4">
        <a href="/explore" className="hover:text-bark">Explore</a>
        <span className="mx-2">/</span>
        <span className="text-bark">{activity.name}</span>
      </p>

      {/* Category icon */}
      {primaryCategory && (
        <div
          className={`inline-flex w-12 h-12 rounded-xl items-center justify-center text-xl mb-4 ${categoryColor?.bg ?? ""} ${categoryColor?.text ?? ""}`}
          style={{ transform: "rotate(-3deg)" }}
        >
          {getCategoryEmoji(primaryCategory)}
        </div>
      )}

      <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl mb-2">
        {activity.name}
      </h1>

      {activity.organization && (
        <p className="text-stone text-lg mb-4">
          by{" "}
          {(activity.organization as any).website ? (
            <a
              href={(activity.organization as any).website}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-bark"
            >
              {(activity.organization as any).name}
            </a>
          ) : (
            <span>{(activity.organization as any).name}</span>
          )}
        </p>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        <Tag type="age" label={formatAgeRange(activity.age_min, activity.age_max)} />
        {activity.categories?.map((cat) => (
          <Tag key={cat} type="category" label={categoryLabel(cat)} />
        ))}
        <Tag
          type="schedule"
          label={activity.indoor_outdoor === "both" ? "Indoor/Outdoor" : activity.indoor_outdoor}
        />
      </div>
    </div>
  );
}

function getCategoryEmoji(cat: string): string {
  const emojis: Record<string, string> = {
    sports: "⚽",
    arts: "🎨",
    stem: "🔬",
    nature: "🌿",
    music: "🎵",
    theater: "🎭",
    academic: "📚",
    special_needs: "💛",
    religious: "⛪",
    swimming: "🏊",
    cooking: "🍳",
    language: "🗣️",
  };
  return emojis[cat] ?? "📌";
}
```

- [ ] **Step 2: Create the session table component**

Create `src/components/activity/session-table.tsx`:

```typescript
import { Tag } from "@/components/ui/tag";
import { formatDateRange, formatTime, formatTimeSlot } from "@/lib/format";

interface Session {
  id: string;
  starts_at: string;
  ends_at: string;
  time_slot: string;
  hours_start: string | null;
  hours_end: string | null;
  is_sold_out: boolean;
  spots_available: number | null;
}

interface SessionTableProps {
  sessions: Session[];
}

export function SessionTable({ sessions }: SessionTableProps) {
  if (!sessions || sessions.length === 0) {
    return (
      <div className="text-center py-6 text-stone">
        <p>No sessions listed yet. Check the camp website for details.</p>
      </div>
    );
  }

  // Sort by start date
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-driftwood/30">
            <th className="text-left font-mono text-[10px] uppercase tracking-wide text-stone pb-2 pr-4">
              Dates
            </th>
            <th className="text-left font-mono text-[10px] uppercase tracking-wide text-stone pb-2 pr-4">
              Schedule
            </th>
            <th className="text-left font-mono text-[10px] uppercase tracking-wide text-stone pb-2 pr-4">
              Hours
            </th>
            <th className="text-right font-mono text-[10px] uppercase tracking-wide text-stone pb-2">
              Availability
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-driftwood/15">
          {sorted.map((session) => (
            <tr key={session.id} className={session.is_sold_out ? "opacity-50" : ""}>
              <td className="py-3 pr-4">
                <span className="font-medium">
                  {formatDateRange(session.starts_at, session.ends_at)}
                </span>
              </td>
              <td className="py-3 pr-4">
                <Tag type="schedule" label={formatTimeSlot(session.time_slot as any)} />
              </td>
              <td className="py-3 pr-4 font-mono text-xs text-stone">
                {session.hours_start && session.hours_end
                  ? `${formatTime(session.hours_start)} – ${formatTime(session.hours_end)}`
                  : "TBD"}
              </td>
              <td className="py-3 text-right">
                {session.is_sold_out ? (
                  <span className="font-mono text-[10px] uppercase tracking-wide text-red-500 bg-red-50 px-2 py-1 rounded-md">
                    Sold Out
                  </span>
                ) : session.spots_available != null ? (
                  <span className="font-mono text-[10px] uppercase tracking-wide text-meadow">
                    {session.spots_available} spots left
                  </span>
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-wide text-stone">
                    Available
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Create the price table component**

Create `src/components/activity/price-table.tsx`:

```typescript
import { formatPrice, formatPriceUnit } from "@/lib/format";

interface PriceOption {
  id: string;
  label: string;
  price_cents: number;
  price_unit: string;
  conditions: string | null;
  confidence: string;
}

interface PriceTableProps {
  priceOptions: PriceOption[];
}

export function PriceTable({ priceOptions }: PriceTableProps) {
  if (!priceOptions || priceOptions.length === 0) {
    return (
      <div className="text-center py-6 text-stone">
        <p>Pricing not yet available. Check the camp website for details.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-driftwood/30">
            <th className="text-left font-mono text-[10px] uppercase tracking-wide text-stone pb-2 pr-4">
              Option
            </th>
            <th className="text-right font-mono text-[10px] uppercase tracking-wide text-stone pb-2 pr-4">
              Price
            </th>
            <th className="text-left font-mono text-[10px] uppercase tracking-wide text-stone pb-2">
              Notes
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-driftwood/15">
          {priceOptions.map((option) => (
            <tr key={option.id}>
              <td className="py-3 pr-4 font-medium">{option.label}</td>
              <td className="py-3 pr-4 text-right">
                <span className="font-mono font-medium">
                  {formatPrice(option.price_cents)}
                </span>
                <span className="font-mono text-[10px] text-stone uppercase tracking-wide ml-0.5">
                  {formatPriceUnit(option.price_unit as any)}
                </span>
              </td>
              <td className="py-3 text-stone text-xs">
                {option.conditions ?? "—"}
                {option.confidence === "llm_extracted" && (
                  <span className="ml-2 font-mono text-[9px] uppercase tracking-wide text-campfire bg-sand/50 px-1.5 py-0.5 rounded">
                    Verify on website
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Create the report modal component**

Create `src/components/activity/report-modal.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { submitReport } from "@/lib/actions";
import { REPORT_REASONS, type ReportReason } from "@/lib/constants";

interface ReportModalProps {
  activityId: string;
}

const REASON_LABELS: Record<ReportReason, string> = {
  wrong_price: "Price is wrong",
  cancelled: "Camp is cancelled",
  wrong_dates: "Wrong dates",
  other: "Other",
};

export function ReportModal({ activityId }: ReportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleSubmit() {
    if (!reason) {
      toast("Please select a reason", "error");
      return;
    }

    startTransition(async () => {
      const result = await submitReport(activityId, reason, details);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast("Thanks for the report! We'll look into it.", "success");
      setIsOpen(false);
      setReason("");
      setDetails("");
    });
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="font-mono text-[10px] uppercase tracking-wide text-stone hover:text-bark underline underline-offset-2"
      >
        Report an issue
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-bark/40 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="relative bg-cream rounded-2xl border border-driftwood/30 shadow-xl p-6 w-full max-w-md">
        <h3 className="font-serif text-xl mb-4">Report an issue</h3>

        <div className="space-y-3 mb-4">
          {REPORT_REASONS.map((r) => (
            <label
              key={r}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                reason === r
                  ? "border-sunset bg-sunset/5"
                  : "border-driftwood/30 hover:border-stone"
              }`}
            >
              <input
                type="radio"
                name="reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="accent-sunset"
              />
              <span className="text-sm">{REASON_LABELS[r]}</span>
            </label>
          ))}
        </div>

        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Any additional details? (optional)"
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-driftwood/50 bg-white text-bark placeholder:text-driftwood text-sm focus:outline-none focus:border-sunset focus:ring-1 focus:ring-sunset/30 mb-4 resize-none"
        />

        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={() => setIsOpen(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !reason}
            className="flex-1"
          >
            {isPending ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create the Activity Detail page**

Create `src/app/activity/[slug]/page.tsx`:

```typescript
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchActivityBySlug, fetchUserFavoriteIds } from "@/lib/queries";
import { formatDataFreshness } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import { DetailHero } from "@/components/activity/detail-hero";
import { SessionTable } from "@/components/activity/session-table";
import { PriceTable } from "@/components/activity/price-table";
import { ReportModal } from "@/components/activity/report-modal";
import { PlannerStub } from "./planner-stub";

export const dynamic = "force-dynamic";

interface ActivityDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ActivityDetailPage({ params }: ActivityDetailPageProps) {
  const { slug } = await params;
  const activity = await fetchActivityBySlug(slug);

  if (!activity) {
    notFound();
  }

  // Get user favorites
  let isFavorited = false;
  try {
    // TODO: remove cast when types are generated
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const favIds = await fetchUserFavoriteIds(user.id);
      isFavorited = favIds.includes(activity.id);
    }
  } catch {
    // Not logged in
  }

  const location = activity.activity_locations?.[0];
  const freshness = formatDataFreshness((activity as any).last_verified_at ?? (activity as any).scraped_at);

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <DetailHero activity={activity} />

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        {activity.registration_url && (
          <a href={activity.registration_url} target="_blank" rel="noopener noreferrer">
            <Button>Visit Camp Website</Button>
          </a>
        )}
        <FavoriteButton activityId={activity.id} initialFavorited={isFavorited} />
        <PlannerStub />
      </div>

      {/* Description */}
      {activity.description && (
        <section className="mb-8">
          <h2 className="font-serif text-xl mb-3">About this activity</h2>
          <p className="text-bark/80 leading-relaxed">{activity.description}</p>
        </section>
      )}

      {/* Location */}
      {location && (
        <section className="mb-8">
          <h2 className="font-serif text-xl mb-3">Location</h2>
          <div className="bg-white rounded-xl border border-driftwood/30 p-4">
            {(location as any).location_name && (
              <p className="font-medium mb-1">{(location as any).location_name}</p>
            )}
            <p className="text-stone text-sm">{(location as any).address}</p>
            {/* Map placeholder */}
            <div className="mt-3 h-40 bg-driftwood/10 rounded-lg flex items-center justify-center">
              <span className="font-mono text-[10px] uppercase tracking-wide text-stone">
                Map view coming soon
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Sessions */}
      <section className="mb-8">
        <h2 className="font-serif text-xl mb-3">Sessions</h2>
        <div className="bg-white rounded-xl border border-driftwood/30 p-4">
          <SessionTable sessions={activity.sessions ?? []} />
        </div>
      </section>

      {/* Pricing */}
      <section className="mb-8">
        <h2 className="font-serif text-xl mb-3">Pricing</h2>
        <div className="bg-white rounded-xl border border-driftwood/30 p-4">
          <PriceTable priceOptions={activity.price_options ?? []} />
        </div>
      </section>

      {/* Data freshness + report */}
      <section className="flex items-center justify-between pt-6 border-t border-driftwood/30">
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${
            freshness.includes("stale") ? "bg-campfire" : "bg-meadow"
          }`} />
          <span className="font-mono text-[10px] uppercase tracking-wide text-stone">
            {freshness}
          </span>
          {activity.registration_url && (
            <a
              href={activity.registration_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] uppercase tracking-wide text-sunset hover:underline"
            >
              Verify on camp website
            </a>
          )}
        </div>
        <ReportModal activityId={activity.id} />
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Create the planner stub component**

Create `src/app/activity/[slug]/planner-stub.tsx`:

```typescript
"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function PlannerStub() {
  const { toast } = useToast();

  return (
    <Button
      variant="outline"
      onClick={() => toast("Planner is coming soon! Stay tuned.", "info")}
    >
      Add to Planner
    </Button>
  );
}
```

- [ ] **Step 7: Run build and tests**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm run build 2>&1 | head -50 && npm test
```

Fix any build errors before proceeding.

---

### Task 6: Favorites Page and My Kids Page

**Files:**
- Create: `src/app/favorites/page.tsx`, `src/app/kids/page.tsx`, `src/components/kids/child-card.tsx`, `src/components/kids/child-form.tsx`

Both pages are authenticated-only (handled by proxy middleware). Favorites shows a grid of saved camp cards. My Kids lets parents add/edit/delete child profiles.

- [ ] **Step 1: Create the Favorites page**

Create `src/app/favorites/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchFavoriteActivities } from "@/lib/queries";
import { CampCard } from "@/components/activity/camp-card";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const activities = await fetchFavoriteActivities(user.id);
  const favoriteIds = activities.map((a: any) => a.id);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-serif text-4xl mb-2">Your Favorites</h1>
      <p className="text-stone text-lg mb-8">
        {activities.length > 0
          ? "Activities you've saved for later."
          : "You haven't saved any favorites yet. Explore and tap the heart to save activities here."}
      </p>

      {activities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activities.map((activity: any) => (
            <CampCard
              key={activity.id}
              activity={activity}
              isFavorited={favoriteIds.includes(activity.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="font-serif text-2xl mb-2">Nothing saved yet</p>
          <p className="text-stone mb-6">
            Head over to Explore and find something your kids will love.
          </p>
          <a href="/explore">
            <button className="rounded-full font-mono text-xs uppercase tracking-widest px-6 py-2.5 bg-sunset text-white hover:bg-sunset/90 transition-colors">
              Start Exploring
            </button>
          </a>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Create the child card component**

Create `src/components/kids/child-card.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { deleteChild } from "@/lib/actions";
import { categoryLabel } from "@/lib/format";

interface ChildCardProps {
  child: {
    id: string;
    name: string;
    birth_date: string;
    interests: string[];
  };
  onEdit: (child: { id: string; name: string; birth_date: string; interests: string[] }) => void;
}

export function ChildCard({ child, onEdit }: ChildCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const { toast } = useToast();

  const age = Math.floor(
    (new Date().getTime() - new Date(child.birth_date + "T00:00:00").getTime()) /
      (365.25 * 24 * 60 * 60 * 1000)
  );

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteChild(child.id);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(`${child.name}'s profile has been removed`, "success");
      setShowConfirm(false);
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-driftwood/30 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-serif text-xl">{child.name}</h3>
          <p className="font-mono text-[10px] uppercase tracking-wide text-stone">
            Age {age}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(child)}
            className="font-mono text-[10px] uppercase tracking-wide text-stone hover:text-bark underline underline-offset-2"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Interests */}
      {child.interests?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {child.interests.map((interest) => (
            <Tag key={interest} type="category" label={categoryLabel(interest)} />
          ))}
        </div>
      )}

      {/* Planner summary stub */}
      <div className="bg-cream/50 rounded-lg p-3">
        <p className="font-mono text-[10px] uppercase tracking-wide text-stone">
          Planner coming soon
        </p>
      </div>

      {/* Delete */}
      {showConfirm ? (
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-driftwood/20">
          <p className="text-sm text-stone flex-1">Remove {child.name}&apos;s profile?</p>
          <Button variant="ghost" onClick={() => setShowConfirm(false)} disabled={isPending}>
            Cancel
          </Button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-full font-mono text-xs uppercase tracking-widest px-4 py-2 bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isPending ? "Removing..." : "Remove"}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowConfirm(true)}
          className="mt-4 font-mono text-[10px] uppercase tracking-wide text-driftwood hover:text-red-600"
        >
          Remove profile
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the child form component**

Create `src/components/kids/child-form.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { addChild, updateChild } from "@/lib/actions";
import { CATEGORIES, type Category } from "@/lib/constants";
import { categoryLabel } from "@/lib/format";

interface ChildFormProps {
  editingChild?: {
    id: string;
    name: string;
    birth_date: string;
    interests: string[];
  } | null;
  onDone: () => void;
}

export function ChildForm({ editingChild, onDone }: ChildFormProps) {
  const [name, setName] = useState(editingChild?.name ?? "");
  const [birthDate, setBirthDate] = useState(editingChild?.birth_date ?? "");
  const [interests, setInterests] = useState<Category[]>(
    (editingChild?.interests as Category[]) ?? []
  );
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function toggleInterest(cat: Category) {
    setInterests((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function handleSubmit() {
    if (!name.trim()) {
      toast("Please enter a name", "error");
      return;
    }
    if (!birthDate) {
      toast("Please enter a birth date", "error");
      return;
    }

    startTransition(async () => {
      const result = editingChild
        ? await updateChild(editingChild.id, name.trim(), birthDate, interests)
        : await addChild(name.trim(), birthDate, interests);

      if (result.error) {
        toast(result.error, "error");
        return;
      }

      toast(
        editingChild
          ? `${name}'s profile has been updated`
          : `${name} has been added!`,
        "success"
      );
      onDone();
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-driftwood/30 p-5">
      <h3 className="font-serif text-xl mb-4">
        {editingChild ? `Edit ${editingChild.name}` : "Add a child"}
      </h3>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wide text-stone mb-1.5">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First name"
            className="w-full px-3 py-2 rounded-lg border border-driftwood/50 bg-cream/50 text-bark placeholder:text-driftwood text-sm focus:outline-none focus:border-sunset focus:ring-1 focus:ring-sunset/30"
          />
        </div>

        {/* Birth date */}
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wide text-stone mb-1.5">
            Birth Date
          </label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-driftwood/50 bg-cream/50 text-bark text-sm focus:outline-none focus:border-sunset focus:ring-1 focus:ring-sunset/30"
          />
        </div>

        {/* Interests */}
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wide text-stone mb-1.5">
            Interests
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => {
              const isSelected = interests.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleInterest(cat)}
                  className={`px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wide transition-colors ${
                    isSelected
                      ? "bg-sunset/15 text-sunset border border-sunset/30"
                      : "bg-bark/5 text-stone border border-transparent hover:border-driftwood"
                  }`}
                >
                  {categoryLabel(cat)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <Button variant="ghost" onClick={onDone} className="flex-1">
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isPending} className="flex-1">
          {isPending ? "Saving..." : editingChild ? "Save Changes" : "Add Child"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the My Kids page**

Create `src/app/kids/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchChildren } from "@/lib/queries";
import { KidsPageClient } from "./client";

export const dynamic = "force-dynamic";

export default async function KidsPage() {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const children = await fetchChildren(user.id);

  return <KidsPageClient initialChildren={children} />;
}
```

Create `src/app/kids/client.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChildCard } from "@/components/kids/child-card";
import { ChildForm } from "@/components/kids/child-form";
import { useRouter } from "next/navigation";

interface Child {
  id: string;
  name: string;
  birth_date: string;
  interests: string[];
}

interface KidsPageClientProps {
  initialChildren: Child[];
}

export function KidsPageClient({ initialChildren }: KidsPageClientProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const router = useRouter();

  function handleDone() {
    setShowForm(false);
    setEditingChild(null);
    router.refresh();
  }

  function handleEdit(child: Child) {
    setEditingChild(child);
    setShowForm(true);
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-4xl mb-2">My Kids</h1>
          <p className="text-stone text-lg">
            Manage your children&apos;s profiles and interests.
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>Add Child</Button>
        )}
      </div>

      {showForm && (
        <div className="mb-6">
          <ChildForm editingChild={editingChild} onDone={handleDone} />
        </div>
      )}

      {initialChildren.length > 0 ? (
        <div className="space-y-4">
          {initialChildren.map((child: any) => (
            <ChildCard key={child.id} child={child} onEdit={handleEdit} />
          ))}
        </div>
      ) : (
        !showForm && (
          <div className="text-center py-16">
            <p className="font-serif text-2xl mb-2">No kids added yet</p>
            <p className="text-stone mb-6">
              Add your children to get personalized activity recommendations.
            </p>
            <Button onClick={() => setShowForm(true)}>Add Your First Child</Button>
          </div>
        )
      )}
    </main>
  );
}
```

- [ ] **Step 5: Run build and tests**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm run build 2>&1 | head -50 && npm test
```

---

### Task 7: Submit a Camp Page and Final Integration

**Files:**
- Create: `src/app/submit/page.tsx`
- Verify: all pages linked in nav work end-to-end

This task adds the "Submit a Camp" form and does a final integration pass to verify all pages build, link correctly, and tests pass.

- [ ] **Step 1: Create the Submit a Camp page**

Create `src/app/submit/page.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { submitCampUrl } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default function SubmitCampPage() {
  const [url, setUrl] = useState("");
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleSubmit() {
    const trimmed = url.trim();
    if (!trimmed) {
      toast("Please enter a URL", "error");
      return;
    }

    // Basic URL validation
    try {
      new URL(trimmed);
    } catch {
      toast("Please enter a valid URL (e.g., https://example.com)", "error");
      return;
    }

    startTransition(async () => {
      const result = await submitCampUrl(trimmed);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(
        "Thanks! We'll review this camp and add it to Kidtinerary.",
        "success"
      );
      setUrl("");
    });
  }

  return (
    <main className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-serif text-4xl mb-2">Submit a Camp</h1>
      <p className="text-stone text-lg mb-8">
        Know about a camp or activity that&apos;s not in Kidtinerary yet? Paste the
        link below and we&apos;ll work on adding it.
      </p>

      <div className="bg-white rounded-2xl border border-driftwood/30 p-6">
        <label className="block font-mono text-[10px] uppercase tracking-wide text-stone mb-1.5">
          Camp or Activity URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="https://example.com/summer-camp"
          className="w-full px-3 py-2 rounded-lg border border-driftwood/50 bg-cream/50 text-bark placeholder:text-driftwood text-sm focus:outline-none focus:border-sunset focus:ring-1 focus:ring-sunset/30 mb-4"
        />
        <Button onClick={handleSubmit} disabled={isPending} className="w-full">
          {isPending ? "Submitting..." : "Submit Camp"}
        </Button>

        <p className="text-xs text-stone mt-4">
          We&apos;ll review the link and extract camp details. You&apos;ll see it on
          Kidtinerary once it&apos;s been processed. This usually takes a few days.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Final build verification**

Run the full build and test suite:

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm run build && npm test
```

If build fails, the most likely causes are:
1. Missing `"use client"` on client components
2. Import path typos
3. Dynamic `searchParams` or `params` needing to be awaited (Next.js 16 requires `await params` and `await searchParams`)

Fix any errors until both commands succeed.

- [ ] **Step 3: Verify navigation links**

Manually confirm each route exists and matches the nav links:
- `/explore` — Explore page (search + camp cards)
- `/activity/[slug]` — Activity detail (e.g., `/activity/nature-explorers-camp`)
- `/favorites` — Favorites (protected)
- `/kids` — My Kids (protected)
- `/submit` — Submit a Camp

- [ ] **Step 4: Run final lint**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm run lint
```

Fix any lint warnings. Common issues: unused imports, missing `key` props, accessibility attributes.
