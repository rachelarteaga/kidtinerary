# KidPlan Foundation & Data Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the KidPlan project with Next.js, Supabase, PostGIS, auth, onboarding, and seed data — so Plans 2-5 have a working foundation to build on.

**Architecture:** Next.js App Router on Vercel with Supabase (Postgres + PostGIS + Auth). Tailwind CSS for styling with the KidPlan design tokens. Supabase client configured for both server components and client components. Google OAuth + email/password auth with an onboarding flow that collects address, first child, and interests.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS 4, Supabase (JS client v2), PostGIS, Google Maps Geocoding API, Vercel

---

## File Structure

```
kidplan/
├── .env.local                          # Supabase keys, Google Maps API key
├── .env.example                        # Template for env vars (no secrets)
├── next.config.ts                      # Next.js config
├── tailwind.config.ts                  # KidPlan design tokens
├── package.json
├── tsconfig.json
├── supabase/
│   ├── config.toml                     # Supabase local dev config
│   └── migrations/
│       ├── 001_enable_extensions.sql   # PostGIS + pg_trgm
│       ├── 002_create_tables.sql       # All tables from spec
│       ├── 003_create_indexes.sql      # Geo, search, FK indexes
│       ├── 004_rls_policies.sql        # Row-level security
│       └── 005_seed_data.sql           # Test activities for dev
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout, fonts, global providers
│   │   ├── page.tsx                    # Landing/explore redirect
│   │   ├── globals.css                 # Tailwind base + KidPlan custom props
│   │   ├── auth/
│   │   │   ├── login/page.tsx          # Login page
│   │   │   ├── signup/page.tsx         # Signup page
│   │   │   └── callback/route.ts       # OAuth callback handler
│   │   └── onboarding/
│   │       └── page.tsx                # Multi-step onboarding
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── server.ts               # Server component client
│   │   │   ├── client.ts               # Browser client
│   │   │   ├── middleware.ts            # Auth middleware helper
│   │   │   └── types.ts                # Generated DB types
│   │   ├── geocode.ts                  # Google Maps geocoding (cached)
│   │   └── constants.ts                # Category enum, status enum, etc.
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx              # Pill button variants
│   │   │   ├── input.tsx               # Form input
│   │   │   ├── select.tsx              # Dropdown select
│   │   │   ├── tag.tsx                 # Color-coded tags
│   │   │   └── card.tsx                # Base card component
│   │   ├── auth/
│   │   │   ├── login-form.tsx          # Email/password + Google OAuth
│   │   │   └── signup-form.tsx         # Registration form
│   │   └── onboarding/
│   │       ├── address-step.tsx        # Set home address
│   │       ├── child-step.tsx          # Add first child
│   │       └── interests-step.tsx      # Pick child interests
│   └── middleware.ts                   # Next.js middleware for auth
├── tests/
│   ├── lib/
│   │   ├── geocode.test.ts             # Geocoding util tests
│   │   └── constants.test.ts           # Enum/constant tests
│   └── components/
│       └── ui/
│           ├── button.test.tsx         # Button variant tests
│           └── tag.test.tsx            # Tag color-coding tests
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `kidplan/package.json`, `kidplan/next.config.ts`, `kidplan/tsconfig.json`, `kidplan/.env.example`

- [ ] **Step 1: Create project directory and initialize Next.js**

```bash
cd /Users/rachelarteaga/Desktop
npx create-next-app@latest kidplan --typescript --tailwind --eslint --app --src-dir --no-import-alias
```

Select defaults when prompted. This creates the base Next.js project with App Router, TypeScript, Tailwind, and src/ directory.

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/rachelarteaga/Desktop/kidplan
npm install @supabase/supabase-js @supabase/ssr dnd-kit @dnd-kit/core @dnd-kit/sortable
npm install -D supabase @testing-library/react @testing-library/jest-dom vitest @vitejs/plugin-react jsdom
```

- [ ] **Step 3: Create .env.example**

Create `.env.example`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google Maps
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Create `tests/setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Add test script to package.json**

Add to the `"scripts"` section of `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Verify setup**

Run: `npm run build`
Expected: Build succeeds with no errors.

Run: `npm test`
Expected: Test runner starts, 0 tests found (no tests yet), exits cleanly.

- [ ] **Step 7: Initialize git and commit**

```bash
cd /Users/rachelarteaga/Desktop/kidplan
git init
echo "node_modules/\n.next/\n.env.local\n.env\n.superpowers/" > .gitignore
git add .
git commit -m "chore: scaffold Next.js project with Tailwind, Supabase deps, Vitest"
```

---

### Task 2: Design Tokens & Base UI Components

**Files:**
- Create: `src/app/globals.css`, `tailwind.config.ts`, `src/lib/constants.ts`, `src/components/ui/button.tsx`, `src/components/ui/tag.tsx`, `tests/lib/constants.test.ts`, `tests/components/ui/button.test.tsx`, `tests/components/ui/tag.test.tsx`

- [ ] **Step 1: Write constants and enum tests**

Create `tests/lib/constants.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  CATEGORIES,
  PLANNER_STATUS,
  PRICE_UNITS,
  DATA_CONFIDENCE,
  CATEGORY_COLORS,
} from "@/lib/constants";

describe("constants", () => {
  it("CATEGORIES contains all expected values", () => {
    expect(CATEGORIES).toContain("sports");
    expect(CATEGORIES).toContain("arts");
    expect(CATEGORIES).toContain("stem");
    expect(CATEGORIES).toContain("nature");
    expect(CATEGORIES).toContain("music");
    expect(CATEGORIES).toContain("theater");
    expect(CATEGORIES).toContain("academic");
    expect(CATEGORIES).toContain("special_needs");
    expect(CATEGORIES).toContain("religious");
    expect(CATEGORIES).toContain("swimming");
    expect(CATEGORIES).toContain("cooking");
    expect(CATEGORIES).toContain("language");
    expect(CATEGORIES).toHaveLength(12);
  });

  it("every category has a color mapping", () => {
    for (const cat of CATEGORIES) {
      expect(CATEGORY_COLORS[cat]).toBeDefined();
      expect(CATEGORY_COLORS[cat]).toHaveProperty("bg");
      expect(CATEGORY_COLORS[cat]).toHaveProperty("text");
    }
  });

  it("PLANNER_STATUS has penciled_in, locked_in, cancelled", () => {
    expect(PLANNER_STATUS).toEqual(["penciled_in", "locked_in", "cancelled"]);
  });

  it("PRICE_UNITS has all pricing types", () => {
    expect(PRICE_UNITS).toEqual(["per_week", "per_day", "per_session", "per_block"]);
  });

  it("DATA_CONFIDENCE has all levels", () => {
    expect(DATA_CONFIDENCE).toEqual(["high", "medium", "low"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/constants.test.ts`
Expected: FAIL — cannot find module `@/lib/constants`

- [ ] **Step 3: Implement constants**

Create `src/lib/constants.ts`:

```typescript
export const CATEGORIES = [
  "sports",
  "arts",
  "stem",
  "nature",
  "music",
  "theater",
  "academic",
  "special_needs",
  "religious",
  "swimming",
  "cooking",
  "language",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_COLORS: Record<Category, { bg: string; text: string }> = {
  sports: { bg: "bg-[#D4A574]/15", text: "text-[#b85c3c]" },
  arts: { bg: "bg-[#E07845]/10", text: "text-[#b85c3c]" },
  stem: { bg: "bg-[#6B8CBB]/12", text: "text-[#4a6d8c]" },
  nature: { bg: "bg-[#5A8F6E]/12", text: "text-[#3d7a54]" },
  music: { bg: "bg-[#D4A574]/15", text: "text-[#8a6d4b]" },
  theater: { bg: "bg-[#E07845]/10", text: "text-[#b85c3c]" },
  academic: { bg: "bg-[#6B8CBB]/12", text: "text-[#4a6d8c]" },
  special_needs: { bg: "bg-[#5A8F6E]/12", text: "text-[#3d7a54]" },
  religious: { bg: "bg-[#D4A574]/15", text: "text-[#8a6d4b]" },
  swimming: { bg: "bg-[#6B8CBB]/12", text: "text-[#4a6d8c]" },
  cooking: { bg: "bg-[#E07845]/10", text: "text-[#b85c3c]" },
  language: { bg: "bg-[#6B8CBB]/12", text: "text-[#4a6d8c]" },
};

export const PLANNER_STATUS = ["penciled_in", "locked_in", "cancelled"] as const;
export type PlannerStatus = (typeof PLANNER_STATUS)[number];

export const PRICE_UNITS = ["per_week", "per_day", "per_session", "per_block"] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];

export const DATA_CONFIDENCE = ["high", "medium", "low"] as const;
export type DataConfidence = (typeof DATA_CONFIDENCE)[number];

export const TIME_SLOTS = ["full_day", "am_half", "pm_half"] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number];

export const INDOOR_OUTDOOR = ["indoor", "outdoor", "both"] as const;
export type IndoorOutdoor = (typeof INDOOR_OUTDOOR)[number];

export const REMINDER_TYPES = ["registration_opens", "registration_closes", "custom"] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];

export const REPORT_REASONS = ["wrong_price", "cancelled", "wrong_dates", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/constants.test.ts`
Expected: PASS — all 5 tests pass

- [ ] **Step 5: Configure Tailwind with KidPlan design tokens**

Replace `tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        cream: "#ECE8DF",
        bark: "#2C261B",
        sunset: "#E07845",
        campfire: "#D4A574",
        meadow: "#5A8F6E",
        lake: "#6B8CBB",
        driftwood: "#C4BFB4",
        sand: "#F5E4C4",
        stone: "#5A5348",
      },
      fontFamily: {
        serif: ["DM Serif Display", "serif"],
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        pill: "999px",
        card: "16px",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 6: Set up globals.css with fonts and base styles**

Replace `src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-cream: #ECE8DF;
  --color-bark: #2C261B;
  --color-sunset: #E07845;
  --color-campfire: #D4A574;
  --color-meadow: #5A8F6E;
  --color-lake: #6B8CBB;
  --color-driftwood: #C4BFB4;
  --color-sand: #F5E4C4;
  --color-stone: #5A5348;

  --font-serif: "DM Serif Display", serif;
  --font-sans: "Inter", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}

body {
  background-color: var(--color-cream);
  color: var(--color-bark);
  font-family: var(--font-sans);
}
```

- [ ] **Step 7: Write Button component tests**

Create `tests/components/ui/button.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders with default variant (primary)", () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole("button", { name: "Click me" });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain("bg-sunset");
  });

  it("renders dark variant", () => {
    render(<Button variant="dark">Details</Button>);
    const btn = screen.getByRole("button", { name: "Details" });
    expect(btn.className).toContain("bg-bark");
  });

  it("renders outline variant", () => {
    render(<Button variant="outline">Compare</Button>);
    const btn = screen.getByRole("button", { name: "Compare" });
    expect(btn.className).toContain("border");
  });

  it("renders nature variant", () => {
    render(<Button variant="nature">Add</Button>);
    const btn = screen.getByRole("button", { name: "Add" });
    expect(btn.className).toContain("bg-meadow");
  });

  it("applies pill shape and mono font", () => {
    render(<Button>Test</Button>);
    const btn = screen.getByRole("button", { name: "Test" });
    expect(btn.className).toContain("rounded-full");
    expect(btn.className).toContain("font-mono");
  });

  it("passes through HTML button props", () => {
    render(<Button disabled>Disabled</Button>);
    const btn = screen.getByRole("button", { name: "Disabled" });
    expect(btn).toBeDisabled();
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npx vitest run tests/components/ui/button.test.tsx`
Expected: FAIL — cannot find module `@/components/ui/button`

- [ ] **Step 9: Implement Button component**

Create `src/components/ui/button.tsx`:

```tsx
import { type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "dark" | "outline" | "nature" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-sunset text-white hover:bg-sunset/90",
  dark: "bg-bark text-cream hover:bg-bark/90",
  outline: "bg-transparent text-bark border border-driftwood hover:border-bark",
  nature: "bg-meadow text-white hover:bg-meadow/90",
  ghost: "bg-bark/5 text-bark hover:bg-bark/10",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`rounded-full font-mono text-xs uppercase tracking-widest px-6 py-2.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npx vitest run tests/components/ui/button.test.tsx`
Expected: PASS — all 6 tests pass

- [ ] **Step 11: Write Tag component tests**

Create `tests/components/ui/tag.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tag } from "@/components/ui/tag";

describe("Tag", () => {
  it("renders with category color for age type", () => {
    render(<Tag type="age" label="Ages 5-9" />);
    const tag = screen.getByText("Ages 5-9");
    expect(tag).toBeInTheDocument();
    expect(tag.className).toContain("text-[#3d7a54]");
  });

  it("renders with category color for type type", () => {
    render(<Tag type="category" label="Arts" />);
    const tag = screen.getByText("Arts");
    expect(tag.className).toContain("text-[#b85c3c]");
  });

  it("renders with schedule color", () => {
    render(<Tag type="schedule" label="Full Day" />);
    const tag = screen.getByText("Full Day");
    expect(tag.className).toContain("text-[#4a6d8c]");
  });

  it("uses mono font and uppercase", () => {
    render(<Tag type="age" label="Test" />);
    const tag = screen.getByText("Test");
    expect(tag.className).toContain("font-mono");
    expect(tag.className).toContain("uppercase");
  });
});
```

- [ ] **Step 12: Run test to verify it fails**

Run: `npx vitest run tests/components/ui/tag.test.tsx`
Expected: FAIL — cannot find module `@/components/ui/tag`

- [ ] **Step 13: Implement Tag component**

Create `src/components/ui/tag.tsx`:

```tsx
type TagType = "age" | "category" | "schedule";

interface TagProps {
  type: TagType;
  label: string;
}

const tagStyles: Record<TagType, string> = {
  age: "bg-[#5A8F6E]/12 text-[#3d7a54]",
  category: "bg-[#E07845]/10 text-[#b85c3c]",
  schedule: "bg-[#6B8CBB]/12 text-[#4a6d8c]",
};

export function Tag({ type, label }: TagProps) {
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-wide px-2 py-1 rounded-md ${tagStyles[type]}`}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 14: Run test to verify it passes**

Run: `npx vitest run tests/components/ui/tag.test.tsx`
Expected: PASS — all 4 tests pass

- [ ] **Step 15: Run all tests and commit**

Run: `npx vitest run`
Expected: All tests pass (constants + button + tag).

```bash
git add .
git commit -m "feat: add KidPlan design tokens, constants, Button and Tag components"
```

---

### Task 3: Supabase Schema & Migrations

**Files:**
- Create: `supabase/migrations/001_enable_extensions.sql`, `supabase/migrations/002_create_tables.sql`, `supabase/migrations/003_create_indexes.sql`, `supabase/migrations/004_rls_policies.sql`

- [ ] **Step 1: Initialize Supabase locally**

```bash
cd /Users/rachelarteaga/Desktop/kidplan
npx supabase init
```

This creates `supabase/config.toml`. Accept defaults.

- [ ] **Step 2: Create extensions migration**

Create `supabase/migrations/001_enable_extensions.sql`:

```sql
-- Enable PostGIS for geographic queries (radius filtering)
create extension if not exists postgis;

-- Enable pg_trgm for fuzzy text matching (deduplication)
create extension if not exists pg_trgm;
```

- [ ] **Step 3: Create tables migration**

Create `supabase/migrations/002_create_tables.sql`:

```sql
-- Enum types
create type indoor_outdoor as enum ('indoor', 'outdoor', 'both');
create type data_confidence as enum ('high', 'medium', 'low');
create type time_slot as enum ('full_day', 'am_half', 'pm_half');
create type price_unit as enum ('per_week', 'per_day', 'per_session', 'per_block');
create type price_confidence as enum ('verified', 'scraped', 'llm_extracted');
create type planner_status as enum ('penciled_in', 'locked_in', 'cancelled');
create type reminder_type as enum ('registration_opens', 'registration_closes', 'custom');
create type report_reason as enum ('wrong_price', 'cancelled', 'wrong_dates', 'other');
create type report_status as enum ('pending', 'reviewed', 'resolved');
create type adapter_type as enum ('dedicated', 'semi_structured', 'generic_llm');
create type scrape_frequency as enum ('daily', 'weekly');
create type scrape_status as enum ('success', 'partial', 'failed');

-- Organizations
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Activities
create table activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  categories text[] not null default '{}',
  age_min int,
  age_max int,
  indoor_outdoor indoor_outdoor not null default 'both',
  registration_url text,
  source_url text,
  scraped_at timestamptz,
  last_verified_at timestamptz,
  data_confidence data_confidence not null default 'medium',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Activity locations (one activity can have multiple venues)
create table activity_locations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  address text not null,
  location geography(point, 4326) not null,
  location_name text,
  created_at timestamptz not null default now()
);

-- Sessions (specific date ranges for an activity)
create table sessions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  activity_location_id uuid not null references activity_locations(id) on delete cascade,
  starts_at date not null,
  ends_at date not null,
  time_slot time_slot not null default 'full_day',
  hours_start time,
  hours_end time,
  spots_available int,
  is_sold_out boolean not null default false,
  enrollment_group_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Price options
create table price_options (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  label text not null,
  price_cents int not null,
  price_unit price_unit not null default 'per_week',
  conditions text,
  valid_from date,
  valid_until date,
  confidence price_confidence not null default 'scraped',
  created_at timestamptz not null default now()
);

-- User profiles (extends Supabase auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  address text,
  location geography(point, 4326),
  default_radius_miles int not null default 30,
  notification_preferences jsonb not null default '{"registration_deadline": true, "availability_alert": true, "coverage_gap": true, "new_match": true, "data_change": true, "custom_reminder": true, "digest_frequency": "weekly", "quiet_start": "21:00", "quiet_end": "07:00"}'::jsonb,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Children
create table children (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  birth_date date not null,
  interests text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Favorites
create table favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, activity_id)
);

-- Planner entries
create table planner_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  status planner_status not null default 'penciled_in',
  sort_order int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reminders
create table reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  type reminder_type not null,
  remind_at timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- Activity reports (user-submitted data issues)
create table activity_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  reason report_reason not null,
  details text,
  status report_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- Shared schedules
create table shared_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  token text not null unique,
  date_from date not null,
  date_to date not null,
  created_at timestamptz not null default now()
);

-- Scrape sources
create table scrape_sources (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  adapter_type adapter_type not null default 'generic_llm',
  scrape_frequency scrape_frequency not null default 'weekly',
  last_scraped_at timestamptz,
  last_success_at timestamptz,
  error_count int not null default 0,
  is_paused boolean not null default false,
  created_at timestamptz not null default now()
);

-- Scrape logs
create table scrape_logs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references scrape_sources(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status scrape_status,
  records_found int not null default 0,
  errors jsonb,
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_organizations_updated_at before update on organizations for each row execute function update_updated_at();
create trigger update_activities_updated_at before update on activities for each row execute function update_updated_at();
create trigger update_sessions_updated_at before update on sessions for each row execute function update_updated_at();
create trigger update_profiles_updated_at before update on profiles for each row execute function update_updated_at();
create trigger update_children_updated_at before update on children for each row execute function update_updated_at();
create trigger update_planner_entries_updated_at before update on planner_entries for each row execute function update_updated_at();
```

- [ ] **Step 4: Create indexes migration**

Create `supabase/migrations/003_create_indexes.sql`:

```sql
-- Geographic indexes for radius queries
create index idx_activity_locations_geo on activity_locations using gist (location);
create index idx_profiles_geo on profiles using gist (location);

-- Activity search and filtering
create index idx_activities_categories on activities using gin (categories);
create index idx_activities_age on activities (age_min, age_max) where is_active = true;
create index idx_activities_slug on activities (slug);
create index idx_activities_org on activities (organization_id);
create index idx_activities_active on activities (is_active) where is_active = true;

-- Trigram index for fuzzy name matching (deduplication)
create index idx_activities_name_trgm on activities using gin (name gin_trgm_ops);
create index idx_organizations_name_trgm on organizations using gin (name gin_trgm_ops);

-- Session queries
create index idx_sessions_activity on sessions (activity_id);
create index idx_sessions_dates on sessions (starts_at, ends_at);
create index idx_sessions_enrollment_group on sessions (enrollment_group_id) where enrollment_group_id is not null;

-- Price lookups
create index idx_price_options_activity on price_options (activity_id);

-- User data queries
create index idx_children_user on children (user_id);
create index idx_favorites_user on favorites (user_id);
create index idx_favorites_activity on favorites (activity_id);
create index idx_planner_entries_user_child on planner_entries (user_id, child_id);
create index idx_planner_entries_session on planner_entries (session_id);

-- Reminder processing
create index idx_reminders_pending on reminders (remind_at) where sent_at is null;

-- Scrape scheduling
create index idx_scrape_sources_active on scrape_sources (scrape_frequency, last_scraped_at) where is_paused = false;

-- Shared schedule token lookup
create index idx_shared_schedules_token on shared_schedules (token);
```

- [ ] **Step 5: Create RLS policies migration**

Create `supabase/migrations/004_rls_policies.sql`:

```sql
-- Enable RLS on all tables
alter table profiles enable row level security;
alter table children enable row level security;
alter table favorites enable row level security;
alter table planner_entries enable row level security;
alter table reminders enable row level security;
alter table activity_reports enable row level security;
alter table shared_schedules enable row level security;

-- Public read access for activity data (needed for SEO, sharing)
alter table organizations enable row level security;
alter table activities enable row level security;
alter table activity_locations enable row level security;
alter table sessions enable row level security;
alter table price_options enable row level security;

create policy "Activities are publicly readable"
  on activities for select using (true);

create policy "Organizations are publicly readable"
  on organizations for select using (true);

create policy "Activity locations are publicly readable"
  on activity_locations for select using (true);

create policy "Sessions are publicly readable"
  on sessions for select using (true);

create policy "Price options are publicly readable"
  on price_options for select using (true);

-- User data: only own data
create policy "Users can read own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can read own children"
  on children for select using (auth.uid() = user_id);

create policy "Users can insert own children"
  on children for insert with check (auth.uid() = user_id);

create policy "Users can update own children"
  on children for update using (auth.uid() = user_id);

create policy "Users can delete own children"
  on children for delete using (auth.uid() = user_id);

create policy "Users can read own favorites"
  on favorites for select using (auth.uid() = user_id);

create policy "Users can insert own favorites"
  on favorites for insert with check (auth.uid() = user_id);

create policy "Users can delete own favorites"
  on favorites for delete using (auth.uid() = user_id);

create policy "Users can read own planner entries"
  on planner_entries for select using (auth.uid() = user_id);

create policy "Users can insert own planner entries"
  on planner_entries for insert with check (auth.uid() = user_id);

create policy "Users can update own planner entries"
  on planner_entries for update using (auth.uid() = user_id);

create policy "Users can delete own planner entries"
  on planner_entries for delete using (auth.uid() = user_id);

create policy "Users can read own reminders"
  on reminders for select using (auth.uid() = user_id);

create policy "Users can insert own reminders"
  on reminders for insert with check (auth.uid() = user_id);

create policy "Users can delete own reminders"
  on reminders for delete using (auth.uid() = user_id);

create policy "Users can insert activity reports"
  on activity_reports for insert with check (auth.uid() = user_id);

create policy "Users can read own activity reports"
  on activity_reports for select using (auth.uid() = user_id);

create policy "Users can read own shared schedules"
  on shared_schedules for select using (auth.uid() = user_id);

create policy "Users can insert own shared schedules"
  on shared_schedules for insert with check (auth.uid() = user_id);

create policy "Users can delete own shared schedules"
  on shared_schedules for delete using (auth.uid() = user_id);

-- Shared schedules: anyone with the token can read planner entries
-- This is handled at the API level, not via RLS
```

- [ ] **Step 6: Verify migrations apply cleanly**

```bash
cd /Users/rachelarteaga/Desktop/kidplan
npx supabase start
npx supabase db reset
```

Expected: All migrations apply without errors. Supabase local instance running.

- [ ] **Step 7: Commit**

```bash
git add supabase/
git commit -m "feat: add database schema with PostGIS, all tables, indexes, and RLS policies"
```

---

### Task 4: Supabase Client Setup & Type Generation

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/middleware.ts`, `src/lib/supabase/types.ts`, `src/middleware.ts`

- [ ] **Step 1: Generate TypeScript types from Supabase schema**

```bash
cd /Users/rachelarteaga/Desktop/kidplan
npx supabase gen types typescript --local > src/lib/supabase/types.ts
```

This generates types from the running local Supabase instance.

- [ ] **Step 2: Create server-side Supabase client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from a Server Component.
            // This can be ignored if middleware refreshes sessions.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create browser-side Supabase client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 4: Create middleware helper**

Create `src/lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users away from protected routes
  const protectedPaths = ["/onboarding", "/planner", "/favorites", "/kids"];
  const isProtected = protectedPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 5: Create Next.js middleware**

Create `src/middleware.ts`:

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/ src/middleware.ts
git commit -m "feat: add Supabase client setup (server, browser, middleware) with generated types"
```

---

### Task 5: Root Layout & Fonts

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/app/page.tsx`

- [ ] **Step 1: Update root layout with fonts and metadata**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { DM_Serif_Display, Inter, JetBrains_Mono } from "next/font/google";
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
  title: "KidPlan — Find camps & activities your kids will love",
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
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create landing page placeholder**

Replace `src/app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="font-serif text-5xl mb-4">KidPlan</h1>
        <p className="text-stone text-lg">
          Find camps & activities your kids will love
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify it renders**

Run: `npm run dev`

Open `http://localhost:3000`. Verify:
- Cream background
- "KidPlan" in serif font
- Subtitle in sans-serif
- No console errors

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx src/app/globals.css
git commit -m "feat: add root layout with KidPlan fonts, colors, and landing placeholder"
```

---

### Task 6: Auth Pages (Login & Signup)

**Files:**
- Create: `src/app/auth/login/page.tsx`, `src/app/auth/signup/page.tsx`, `src/app/auth/callback/route.ts`, `src/components/auth/login-form.tsx`, `src/components/auth/signup-form.tsx`

- [ ] **Step 1: Create OAuth callback route**

Create `src/app/auth/callback/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
```

- [ ] **Step 2: Create login form component**

Create `src/components/auth/login-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/onboarding");
    }
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-serif text-3xl mb-2">Welcome back</h1>
      <p className="text-stone mb-8">Sign in to your KidPlan account</p>

      <button
        onClick={handleGoogleLogin}
        className="w-full border border-driftwood rounded-full py-2.5 px-4 font-mono text-xs uppercase tracking-widest hover:border-bark transition-colors mb-6"
      >
        Continue with Google
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-driftwood" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-stone">
          or
        </span>
        <div className="flex-1 h-px bg-driftwood" />
      </div>

      <form onSubmit={handleEmailLogin} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block font-mono text-[10px] uppercase tracking-widest text-stone mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-white border border-driftwood rounded-lg px-4 py-2.5 text-bark focus:outline-none focus:border-sunset transition-colors"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="block font-mono text-[10px] uppercase tracking-widest text-stone mb-1"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-white border border-driftwood rounded-lg px-4 py-2.5 text-bark focus:outline-none focus:border-sunset transition-colors"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <p className="text-center text-stone text-sm mt-6">
        Don&apos;t have an account?{" "}
        <a href="/auth/signup" className="text-sunset hover:underline">
          Sign up
        </a>
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Create signup form component**

Create `src/components/auth/signup-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/onboarding");
    }
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-serif text-3xl mb-2">Plan your kid&apos;s next adventure</h1>
      <p className="text-stone mb-8">Create your KidPlan account</p>

      <button
        onClick={handleGoogleLogin}
        className="w-full border border-driftwood rounded-full py-2.5 px-4 font-mono text-xs uppercase tracking-widest hover:border-bark transition-colors mb-6"
      >
        Continue with Google
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-driftwood" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-stone">
          or
        </span>
        <div className="flex-1 h-px bg-driftwood" />
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block font-mono text-[10px] uppercase tracking-widest text-stone mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-white border border-driftwood rounded-lg px-4 py-2.5 text-bark focus:outline-none focus:border-sunset transition-colors"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="block font-mono text-[10px] uppercase tracking-widest text-stone mb-1"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full bg-white border border-driftwood rounded-lg px-4 py-2.5 text-bark focus:outline-none focus:border-sunset transition-colors"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating account..." : "Get Started"}
        </Button>
      </form>

      <p className="text-center text-stone text-sm mt-6">
        Already have an account?{" "}
        <a href="/auth/login" className="text-sunset hover:underline">
          Sign in
        </a>
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Create login page**

Create `src/app/auth/login/page.tsx`:

```tsx
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <LoginForm />
    </main>
  );
}
```

- [ ] **Step 5: Create signup page**

Create `src/app/auth/signup/page.tsx`:

```tsx
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <SignupForm />
    </main>
  );
}
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/auth/ src/components/auth/
git commit -m "feat: add login and signup pages with email/password and Google OAuth"
```

---

### Task 7: Geocoding Utility

**Files:**
- Create: `src/lib/geocode.ts`, `tests/lib/geocode.test.ts`

- [ ] **Step 1: Write geocoding tests**

Create `tests/lib/geocode.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { geocodeAddress, type GeoResult } from "@/lib/geocode";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("geocodeAddress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns lat/lng for a valid address", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            geometry: {
              location: { lat: 35.7796, lng: -78.6382 },
            },
            formatted_address: "Raleigh, NC 27601, USA",
          },
        ],
        status: "OK",
      }),
    });

    const result = await geocodeAddress("Raleigh, NC");

    expect(result).toEqual({
      lat: 35.7796,
      lng: -78.6382,
      formatted_address: "Raleigh, NC 27601, USA",
    });
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("returns null for an invalid address", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [],
        status: "ZERO_RESULTS",
      }),
    });

    const result = await geocodeAddress("asdfghjkl not a real place");
    expect(result).toBeNull();
  });

  it("returns null when API errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
    });

    const result = await geocodeAddress("Raleigh, NC");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/geocode.test.ts`
Expected: FAIL — cannot find module `@/lib/geocode`

- [ ] **Step 3: Implement geocoding utility**

Create `src/lib/geocode.ts`:

```typescript
export interface GeoResult {
  lat: number;
  lng: number;
  formatted_address: string;
}

export async function geocodeAddress(
  address: string
): Promise<GeoResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_MAPS_API_KEY not set");
    return null;
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.results || data.results.length === 0) return null;

    const result = data.results[0];
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formatted_address: result.formatted_address,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/geocode.test.ts`
Expected: PASS — all 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/geocode.ts tests/lib/geocode.test.ts
git commit -m "feat: add geocoding utility with Google Maps API"
```

---

### Task 8: Onboarding Flow

**Files:**
- Create: `src/app/onboarding/page.tsx`, `src/components/onboarding/address-step.tsx`, `src/components/onboarding/child-step.tsx`, `src/components/onboarding/interests-step.tsx`

- [ ] **Step 1: Create address step component**

Create `src/components/onboarding/address-step.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface AddressStepProps {
  onComplete: (address: string) => void;
}

export function AddressStep({ onComplete }: AddressStepProps) {
  const [address, setAddress] = useState("");

  return (
    <div>
      <h2 className="font-serif text-2xl mb-2">Where do you live?</h2>
      <p className="text-stone mb-6">
        We&apos;ll use this to find activities near you.
      </p>
      <div className="mb-4">
        <label
          htmlFor="address"
          className="block font-mono text-[10px] uppercase tracking-widest text-stone mb-1"
        >
          Home Address or Zip Code
        </label>
        <input
          id="address"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="123 Main St, Raleigh, NC"
          className="w-full bg-white border border-driftwood rounded-lg px-4 py-2.5 text-bark focus:outline-none focus:border-sunset transition-colors"
        />
      </div>
      <Button
        onClick={() => onComplete(address)}
        disabled={address.trim().length === 0}
        className="w-full"
      >
        Next
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Create child step component**

Create `src/components/onboarding/child-step.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ChildStepProps {
  onComplete: (child: { name: string; birthDate: string }) => void;
}

export function ChildStep({ onComplete }: ChildStepProps) {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");

  return (
    <div>
      <h2 className="font-serif text-2xl mb-2">Tell us about your kid</h2>
      <p className="text-stone mb-6">
        We&apos;ll find age-appropriate activities just for them.
      </p>
      <div className="space-y-4 mb-6">
        <div>
          <label
            htmlFor="childName"
            className="block font-mono text-[10px] uppercase tracking-widest text-stone mb-1"
          >
            First Name
          </label>
          <input
            id="childName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Emma"
            className="w-full bg-white border border-driftwood rounded-lg px-4 py-2.5 text-bark focus:outline-none focus:border-sunset transition-colors"
          />
        </div>
        <div>
          <label
            htmlFor="birthDate"
            className="block font-mono text-[10px] uppercase tracking-widest text-stone mb-1"
          >
            Birthday
          </label>
          <input
            id="birthDate"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full bg-white border border-driftwood rounded-lg px-4 py-2.5 text-bark focus:outline-none focus:border-sunset transition-colors"
          />
        </div>
      </div>
      <Button
        onClick={() => onComplete({ name, birthDate })}
        disabled={name.trim().length === 0 || birthDate.length === 0}
        className="w-full"
      >
        Next
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Create interests step component**

Create `src/components/onboarding/interests-step.tsx`:

```tsx
"use client";

import { useState } from "react";
import { CATEGORIES, type Category } from "@/lib/constants";
import { Button } from "@/components/ui/button";

interface InterestsStepProps {
  childName: string;
  onComplete: (interests: Category[]) => void;
}

const CATEGORY_LABELS: Record<Category, { label: string; emoji: string }> = {
  sports: { label: "Sports", emoji: "⚽" },
  arts: { label: "Arts & Crafts", emoji: "🎨" },
  stem: { label: "STEM", emoji: "🔬" },
  nature: { label: "Nature", emoji: "🌿" },
  music: { label: "Music", emoji: "🎵" },
  theater: { label: "Theater", emoji: "🎭" },
  academic: { label: "Academic", emoji: "📚" },
  special_needs: { label: "Special Needs", emoji: "💛" },
  religious: { label: "Religious", emoji: "⛪" },
  swimming: { label: "Swimming", emoji: "🏊" },
  cooking: { label: "Cooking", emoji: "🍳" },
  language: { label: "Language", emoji: "🗣️" },
};

export function InterestsStep({ childName, onComplete }: InterestsStepProps) {
  const [selected, setSelected] = useState<Category[]>([]);

  function toggle(cat: Category) {
    setSelected((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  return (
    <div>
      <h2 className="font-serif text-2xl mb-2">
        What does {childName} love?
      </h2>
      <p className="text-stone mb-6">
        Pick as many as you&apos;d like. We&apos;ll use these to personalize recommendations.
      </p>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {CATEGORIES.map((cat) => {
          const { label, emoji } = CATEGORY_LABELS[cat];
          const isSelected = selected.includes(cat);
          return (
            <button
              key={cat}
              onClick={() => toggle(cat)}
              className={`flex flex-col items-center gap-1 p-4 rounded-card border transition-all ${
                isSelected
                  ? "border-sunset bg-sunset/5"
                  : "border-driftwood bg-white hover:border-stone"
              }`}
            >
              <span
                className="text-2xl"
                style={{ transform: "rotate(-3deg)", display: "inline-block" }}
              >
                {emoji}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-stone">
                {label}
              </span>
            </button>
          );
        })}
      </div>
      <Button
        onClick={() => onComplete(selected)}
        disabled={selected.length === 0}
        className="w-full"
      >
        Start Exploring
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Create onboarding page (orchestrates all steps)**

Create `src/app/onboarding/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { geocodeAddress } from "@/lib/geocode";
import { AddressStep } from "@/components/onboarding/address-step";
import { ChildStep } from "@/components/onboarding/child-step";
import { InterestsStep } from "@/components/onboarding/interests-step";
import type { Category } from "@/lib/constants";

type Step = "address" | "child" | "interests";

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("address");
  const [address, setAddress] = useState("");
  const [child, setChild] = useState({ name: "", birthDate: "" });
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleAddressComplete(addr: string) {
    setAddress(addr);
    setStep("child");
  }

  async function handleChildComplete(c: { name: string; birthDate: string }) {
    setChild(c);
    setStep("interests");
  }

  async function handleInterestsComplete(interests: Category[]) {
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/auth/login");
      return;
    }

    // Geocode address
    const geo = await geocodeAddress(address);

    // Update profile with address and location
    const profileUpdate: Record<string, unknown> = {
      address,
      onboarding_completed: true,
    };
    if (geo) {
      // Store as PostGIS point using raw SQL via RPC or just store lat/lng
      // For now, update address and mark complete — geo will be set via server action
      profileUpdate.address = geo.formatted_address;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", user.id);

    if (profileError) {
      setError("Failed to save profile. Please try again.");
      return;
    }

    // Create child
    const { error: childError } = await supabase.from("children").insert({
      user_id: user.id,
      name: child.name,
      birth_date: child.birthDate,
      interests,
    });

    if (childError) {
      setError("Failed to save child profile. Please try again.");
      return;
    }

    router.push("/");
  }

  const stepNumber = step === "address" ? 1 : step === "child" ? 2 : 3;

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Progress indicator */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full transition-colors ${
                n <= stepNumber ? "bg-sunset" : "bg-driftwood"
              }`}
            />
          ))}
        </div>

        {step === "address" && (
          <AddressStep onComplete={handleAddressComplete} />
        )}
        {step === "child" && <ChildStep onComplete={handleChildComplete} />}
        {step === "interests" && (
          <InterestsStep
            childName={child.name}
            onComplete={handleInterestsComplete}
          />
        )}

        {error && (
          <p className="text-sm text-red-600 mt-4">{error}</p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/onboarding/ src/components/onboarding/
git commit -m "feat: add onboarding flow (address, child profile, interests picker)"
```

---

### Task 9: Seed Data

**Files:**
- Create: `supabase/migrations/005_seed_data.sql`

- [ ] **Step 1: Create seed data migration**

Create `supabase/migrations/005_seed_data.sql`:

```sql
-- Seed organizations
insert into organizations (id, name, website, description) values
  ('a0000000-0000-0000-0000-000000000001', 'Raleigh Parks & Recreation', 'https://raleighnc.gov/parks', 'City of Raleigh parks and recreation programs'),
  ('a0000000-0000-0000-0000-000000000002', 'YMCA of the Triangle', 'https://www.ymcatriangle.org', 'YMCA camps and programs across the Triangle'),
  ('a0000000-0000-0000-0000-000000000003', 'Marbles Kids Museum', 'https://www.marbleskidsmuseum.org', 'Interactive children''s museum and camp programs'),
  ('a0000000-0000-0000-0000-000000000004', 'Town of Cary Parks', 'https://www.townofcary.org/recreation-enjoyment', 'Town of Cary recreational programs'),
  ('a0000000-0000-0000-0000-000000000005', 'Triangle Aquatic Center', 'https://www.triangleaquatics.org', 'Competitive and recreational swimming programs');

-- Seed activities
insert into activities (id, organization_id, name, slug, description, categories, age_min, age_max, indoor_outdoor, registration_url, data_confidence, is_active) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Nature Explorers Camp', 'nature-explorers-camp', 'Kids explore Raleigh''s greenways, learn about local wildlife, and create nature art projects.', '{nature,arts}', 5, 9, 'outdoor', 'https://raleighnc.gov/parks/camps', 'high', true),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'YMCA Soccer Stars', 'ymca-soccer-stars', 'Introduction to soccer fundamentals in a fun, non-competitive environment.', '{sports}', 4, 7, 'outdoor', 'https://www.ymcatriangle.org/camps', 'high', true),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'Marbles STEM Inventors', 'marbles-stem-inventors', 'Hands-on STEM projects: robotics, coding, and engineering challenges.', '{stem}', 6, 10, 'indoor', 'https://www.marbleskidsmuseum.org/camps', 'high', true),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Little Artists Studio', 'little-artists-studio', 'Painting, sculpture, and mixed media for young artists.', '{arts}', 3, 6, 'indoor', 'https://raleighnc.gov/parks/camps', 'high', true),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000004', 'Cary Tennis Academy', 'cary-tennis-academy', 'Learn tennis basics at Cary Tennis Park with certified instructors.', '{sports}', 6, 12, 'outdoor', 'https://www.townofcary.org/recreation-enjoyment', 'high', true),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000005', 'Swim Camp: Beginner', 'swim-camp-beginner', 'Learn-to-swim program for beginners. Small group instruction.', '{swimming}', 4, 8, 'indoor', 'https://www.triangleaquatics.org/camps', 'high', true),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', 'YMCA Drama Workshop', 'ymca-drama-workshop', 'Kids write, rehearse, and perform a short play in one week.', '{theater}', 7, 12, 'indoor', 'https://www.ymcatriangle.org/camps', 'high', true),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000003', 'Marbles Cooking Adventures', 'marbles-cooking-adventures', 'Kid-friendly recipes, kitchen safety, and food science.', '{cooking}', 6, 10, 'indoor', 'https://www.marbleskidsmuseum.org/camps', 'high', true);

-- Seed activity locations (Raleigh area coordinates)
insert into activity_locations (id, activity_id, address, location, location_name) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '2012 Lake Wheeler Rd, Raleigh, NC 27603', ST_SetSRID(ST_MakePoint(-78.6569, 35.7488), 4326), 'Walnut Creek Wetland Center'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', '1601 Hillsborough St, Raleigh, NC 27605', ST_SetSRID(ST_MakePoint(-78.6614, 35.7872), 4326), 'A.E. Finley YMCA'),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', '201 E Hargett St, Raleigh, NC 27601', ST_SetSRID(ST_MakePoint(-78.6362, 35.7796), 4326), 'Marbles Kids Museum'),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004', '820 Clay St, Raleigh, NC 27605', ST_SetSRID(ST_MakePoint(-78.6553, 35.7917), 4326), 'Sertoma Arts Center'),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000005', '2727 Louis Stephens Dr, Cary, NC 27519', ST_SetSRID(ST_MakePoint(-78.7406, 35.7515), 4326), 'Cary Tennis Park'),
  ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000006', '275 Convention Dr, Cary, NC 27511', ST_SetSRID(ST_MakePoint(-78.7811, 35.7849), 4326), 'Triangle Aquatic Center'),
  ('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000007', '1601 Hillsborough St, Raleigh, NC 27605', ST_SetSRID(ST_MakePoint(-78.6614, 35.7872), 4326), 'A.E. Finley YMCA'),
  ('c0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000008', '201 E Hargett St, Raleigh, NC 27601', ST_SetSRID(ST_MakePoint(-78.6362, 35.7796), 4326), 'Marbles Kids Museum');

-- Seed sessions (summer 2026 weeks)
insert into sessions (id, activity_id, activity_location_id, starts_at, ends_at, time_slot, hours_start, hours_end) values
  -- Nature Explorers: 3 weeks
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '2026-06-15', '2026-06-19', 'full_day', '09:00', '15:00'),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '2026-06-22', '2026-06-26', 'full_day', '09:00', '15:00'),
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '2026-07-06', '2026-07-10', 'full_day', '09:00', '15:00'),
  -- Soccer Stars: 2 weeks, AM half-day
  ('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', '2026-06-15', '2026-06-19', 'am_half', '09:00', '12:00'),
  ('d0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', '2026-07-13', '2026-07-17', 'am_half', '09:00', '12:00'),
  -- STEM Inventors: 2 weeks
  ('d0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', '2026-06-22', '2026-06-26', 'full_day', '09:00', '16:00'),
  ('d0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', '2026-07-20', '2026-07-24', 'full_day', '09:00', '16:00'),
  -- Little Artists: 3 weeks, AM half-day
  ('d0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', '2026-06-15', '2026-06-19', 'am_half', '09:30', '12:00'),
  ('d0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', '2026-07-06', '2026-07-10', 'am_half', '09:30', '12:00'),
  ('d0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', '2026-07-27', '2026-07-31', 'am_half', '09:30', '12:00'),
  -- Tennis: 2 weeks
  ('d0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000005', '2026-06-29', '2026-07-03', 'am_half', '08:30', '11:30'),
  ('d0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000005', '2026-07-27', '2026-07-31', 'am_half', '08:30', '11:30'),
  -- Swim: 4 weeks, PM half-day
  ('d0000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000006', '2026-06-15', '2026-06-19', 'pm_half', '13:00', '15:30'),
  ('d0000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000006', '2026-06-22', '2026-06-26', 'pm_half', '13:00', '15:30'),
  ('d0000000-0000-0000-0000-000000000015', 'b0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000006', '2026-07-06', '2026-07-10', 'pm_half', '13:00', '15:30'),
  ('d0000000-0000-0000-0000-000000000016', 'b0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000006', '2026-07-13', '2026-07-17', 'pm_half', '13:00', '15:30'),
  -- Drama: 1 week
  ('d0000000-0000-0000-0000-000000000017', 'b0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000007', '2026-07-13', '2026-07-17', 'full_day', '09:00', '15:00'),
  -- Cooking: 2 weeks
  ('d0000000-0000-0000-0000-000000000018', 'b0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000008', '2026-06-29', '2026-07-03', 'am_half', '09:30', '12:30'),
  ('d0000000-0000-0000-0000-000000000019', 'b0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000008', '2026-07-20', '2026-07-24', 'am_half', '09:30', '12:30');

-- Seed price options
insert into price_options (activity_id, label, price_cents, price_unit, conditions, confidence) values
  ('b0000000-0000-0000-0000-000000000001', 'Standard', 28500, 'per_week', null, 'verified'),
  ('b0000000-0000-0000-0000-000000000001', 'Early Bird', 24500, 'per_week', 'Register before May 1', 'verified'),
  ('b0000000-0000-0000-0000-000000000002', 'Standard', 16500, 'per_week', null, 'verified'),
  ('b0000000-0000-0000-0000-000000000002', 'Sibling', 14500, 'per_week', '2nd child 10% off', 'verified'),
  ('b0000000-0000-0000-0000-000000000003', 'Standard', 35000, 'per_week', null, 'verified'),
  ('b0000000-0000-0000-0000-000000000004', 'Standard', 12000, 'per_week', null, 'verified'),
  ('b0000000-0000-0000-0000-000000000005', 'Standard', 22000, 'per_week', null, 'verified'),
  ('b0000000-0000-0000-0000-000000000006', 'Standard', 18500, 'per_week', null, 'verified'),
  ('b0000000-0000-0000-0000-000000000006', '4-Week Bundle', 64000, 'per_block', 'All 4 weeks', 'verified'),
  ('b0000000-0000-0000-0000-000000000007', 'Standard', 27500, 'per_week', null, 'verified'),
  ('b0000000-0000-0000-0000-000000000008', 'Standard', 25000, 'per_week', null, 'verified');
```

- [ ] **Step 2: Apply seed data**

```bash
cd /Users/rachelarteaga/Desktop/kidplan
npx supabase db reset
```

Expected: All migrations including seed data apply without errors.

- [ ] **Step 3: Verify seed data**

```bash
npx supabase db query "select count(*) from activities;"
npx supabase db query "select count(*) from sessions;"
npx supabase db query "select count(*) from price_options;"
npx supabase db query "select a.name, ST_AsText(al.location) from activities a join activity_locations al on al.activity_id = a.id limit 3;"
```

Expected: 8 activities, 19 sessions, 11 price options. Location points display as `POINT(lng lat)`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/005_seed_data.sql
git commit -m "feat: add seed data with 8 Raleigh-area activities, sessions, and pricing"
```

---

### Task 10: Run Full Test Suite & Final Verification

- [ ] **Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: All tests pass (constants, button, tag, geocode).

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors, no type errors.

- [ ] **Step 3: Start dev server and verify**

Run: `npm run dev`

Verify at `http://localhost:3000`:
- Landing page renders with KidPlan branding
- `/auth/login` shows login form with Google OAuth button
- `/auth/signup` shows signup form
- `/onboarding` redirects to login (middleware protecting it)

- [ ] **Step 4: Final commit with any fixes**

If any issues were found and fixed:

```bash
git add .
git commit -m "fix: resolve issues found during final verification"
```

- [ ] **Step 5: Verify git log**

```bash
git log --oneline
```

Expected: Clean commit history with ~8-9 commits covering scaffold, design tokens, schema, Supabase clients, layout, auth, geocoding, onboarding, and seed data.
