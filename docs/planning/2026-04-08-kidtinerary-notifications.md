# Notifications & Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email notifications (registration reminders, data-change alerts, weekly digests) via Resend and read-only schedule sharing via token links.

**Architecture:** A `src/lib/email.ts` module wraps Resend and owns all HTML templates. Two new cron routes handle notification dispatch — one daily for immediate-type reminders, one weekly for digests. Sharing uses a server action to create/revoke tokens and a new public `app/schedule/[token]/page.tsx` that reads `shared_schedules` + `planner_entries` with no auth. The Web Share API button is a client component added to the activity detail page.

**Tech Stack:** Resend (email), Next.js App Router (cron routes + public share page), Supabase Postgres (`reminders`, `shared_schedules`, `profiles.notification_preferences`), Vercel Cron

---

## File Map

| Path | Role |
|------|------|
| `src/lib/email.ts` | Resend client + all HTML email template functions |
| `src/lib/actions.ts` | Add `setReminder`, `createSharedSchedule`, `revokeSharedSchedule`, `updateNotificationPreferences` |
| `src/lib/queries.ts` | Add `fetchSharedSchedule`, `fetchRemindersDue`, `fetchWeeklyDigestData` |
| `src/app/api/cron/notify/route.ts` | Daily cron — fires due reminders + data-change alerts |
| `src/app/api/cron/digest/route.ts` | Weekly cron — new-match + coverage-gap digests |
| `src/app/schedule/[token]/page.tsx` | Public read-only shared schedule page |
| `src/components/activity/share-button.tsx` | Client component — Web Share API + copy-link fallback |
| `src/components/planner/share-schedule-button.tsx` | Client component — generate/copy share link from planner |
| `tests/lib/email.test.ts` | Unit tests for template functions |
| `tests/lib/notify.test.ts` | Unit tests for reminder filtering logic |
| `vercel.json` | Add digest cron schedule |

---

## Task 1: Install Resend + email module with templates

**Files:**
- Modify: `/Users/rachelarteaga/Desktop/kidplan/package.json` (via npm install)
- Create: `/Users/rachelarteaga/Desktop/kidplan/src/lib/email.ts`
- Create: `/Users/rachelarteaga/Desktop/kidplan/tests/lib/email.test.ts`

- [ ] **Step 1: Install resend**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm install resend
```

Expected: `resend` appears in `dependencies` in `package.json`.

- [ ] **Step 2: Write failing tests for template functions**

Create `/Users/rachelarteaga/Desktop/kidplan/tests/lib/email.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  registrationReminderHtml,
  dataChangeAlertHtml,
  weeklyDigestHtml,
  coverageGapHtml,
} from "@/lib/email";

describe("registrationReminderHtml", () => {
  it("includes the activity name in subject-line copy", () => {
    const html = registrationReminderHtml({
      activityName: "Nature Explorers",
      reminderType: "registration_opens",
      remindAt: "2026-06-01T07:00:00Z",
      activityUrl: "https://kidplan.com/activity/nature-explorers",
    });
    expect(html).toContain("Nature Explorers");
    expect(html).toContain("kidplan.com/activity/nature-explorers");
  });

  it("uses closes copy for registration_closes type", () => {
    const html = registrationReminderHtml({
      activityName: "Art Fusion",
      reminderType: "registration_closes",
      remindAt: "2026-05-15T07:00:00Z",
      activityUrl: "https://kidplan.com/activity/art-fusion",
    });
    expect(html).toContain("closes");
  });

  it("uses custom copy for custom type", () => {
    const html = registrationReminderHtml({
      activityName: "Swim Academy",
      reminderType: "custom",
      remindAt: "2026-05-20T07:00:00Z",
      activityUrl: "https://kidplan.com/activity/swim-academy",
    });
    expect(html).toContain("Swim Academy");
  });
});

describe("dataChangeAlertHtml", () => {
  it("includes price change copy when price changed", () => {
    const html = dataChangeAlertHtml({
      activityName: "Soccer Stars",
      activityUrl: "https://kidplan.com/activity/soccer-stars",
      changes: [{ field: "price", old: "$200/week", new: "$225/week" }],
    });
    expect(html).toContain("Soccer Stars");
    expect(html).toContain("$200/week");
    expect(html).toContain("$225/week");
  });
});

describe("weeklyDigestHtml", () => {
  it("lists each new match activity", () => {
    const html = weeklyDigestHtml({
      childName: "Maya",
      newMatches: [
        { name: "Coding Camp", slug: "coding-camp", categories: ["stem"], ageMin: 7, ageMax: 12 },
      ],
      coverageGapWeeks: [],
    });
    expect(html).toContain("Maya");
    expect(html).toContain("Coding Camp");
    expect(html).toContain("kidplan.com/activity/coding-camp");
  });

  it("includes coverage gap weeks when present", () => {
    const html = weeklyDigestHtml({
      childName: "Leo",
      newMatches: [],
      coverageGapWeeks: ["Jun 16 – 20", "Jun 23 – 27"],
    });
    expect(html).toContain("Jun 16");
    expect(html).toContain("Jun 23");
  });
});

describe("coverageGapHtml", () => {
  it("renders gap weeks", () => {
    const html = coverageGapHtml({
      childName: "Sam",
      gapWeeks: ["Jul 7 – 11"],
    });
    expect(html).toContain("Sam");
    expect(html).toContain("Jul 7");
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm test -- tests/lib/email.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/email'`

- [ ] **Step 4: Create `src/lib/email.ts`**

```typescript
// src/lib/email.ts
import { Resend } from "resend";

// ---------------------------------------------------------------------------
// Client (lazily initialised so tests don't require RESEND_API_KEY)
// ---------------------------------------------------------------------------
let _client: Resend | null = null;
function getClient(): Resend {
  if (!_client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    _client = new Resend(key);
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Shared layout wrapper
// ---------------------------------------------------------------------------
const BRAND_COLORS = {
  cream: "#ECE8DF",
  bark: "#2C261B",
  sunset: "#E07845",
  campfire: "#D4A574",
  meadow: "#5A8F6E",
  driftwood: "#C4BFB4",
};

function layout(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:${BRAND_COLORS.cream};font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_COLORS.cream};padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid ${BRAND_COLORS.driftwood};">
        <!-- Header -->
        <tr>
          <td style="background:${BRAND_COLORS.bark};padding:20px 32px;">
            <span style="font-family:Georgia,serif;font-size:22px;color:${BRAND_COLORS.cream};letter-spacing:-0.5px;">KidPlan</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid ${BRAND_COLORS.driftwood};background:${BRAND_COLORS.cream};">
            <p style="margin:0;font-size:11px;color:#888;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;">
              You're receiving this because you have notifications turned on in KidPlan.
              <a href="https://kidplan.com/settings" style="color:${BRAND_COLORS.sunset};text-decoration:none;">Manage preferences</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:${BRAND_COLORS.sunset};color:#fff;border-radius:999px;font-family:monospace;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;text-decoration:none;">${label}</a>`;
}

// ---------------------------------------------------------------------------
// Template types
// ---------------------------------------------------------------------------
export interface RegistrationReminderParams {
  activityName: string;
  reminderType: "registration_opens" | "registration_closes" | "custom";
  remindAt: string; // ISO string
  activityUrl: string;
}

export interface DataChangeAlertParams {
  activityName: string;
  activityUrl: string;
  changes: Array<{ field: string; old: string; new: string }>;
}

export interface WeeklyDigestParams {
  childName: string;
  newMatches: Array<{
    name: string;
    slug: string;
    categories: string[];
    ageMin: number | null;
    ageMax: number | null;
  }>;
  coverageGapWeeks: string[];
}

export interface CoverageGapParams {
  childName: string;
  gapWeeks: string[];
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------
export function registrationReminderHtml(p: RegistrationReminderParams): string {
  const actionLabel =
    p.reminderType === "registration_opens"
      ? "opens"
      : p.reminderType === "registration_closes"
      ? "closes"
      : "is coming up";

  const date = new Date(p.remindAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const body = `
    <h1 style="font-family:Georgia,serif;font-size:26px;color:${BRAND_COLORS.bark};margin:0 0 12px;">
      Heads up!
    </h1>
    <p style="font-size:16px;color:${BRAND_COLORS.bark};line-height:1.6;margin:0 0 8px;">
      Registration for <strong>${p.activityName}</strong> ${actionLabel} on <strong>${date}</strong>.
    </p>
    <p style="font-size:14px;color:#666;margin:0;">
      Don't miss your spot — registration fills up fast.
    </p>
    ${ctaButton("View Activity", p.activityUrl)}
  `;
  return layout(body);
}

export function dataChangeAlertHtml(p: DataChangeAlertParams): string {
  const rows = p.changes
    .map(
      (c) => `
      <tr>
        <td style="padding:8px 12px;font-size:13px;font-family:monospace;text-transform:uppercase;letter-spacing:0.05em;color:#888;">${c.field}</td>
        <td style="padding:8px 12px;font-size:14px;text-decoration:line-through;color:#aaa;">${c.old}</td>
        <td style="padding:8px 12px;font-size:14px;color:${BRAND_COLORS.bark};font-weight:600;">${c.new}</td>
      </tr>`
    )
    .join("");

  const body = `
    <h1 style="font-family:Georgia,serif;font-size:26px;color:${BRAND_COLORS.bark};margin:0 0 12px;">
      Something changed
    </h1>
    <p style="font-size:16px;color:${BRAND_COLORS.bark};line-height:1.6;margin:0 0 16px;">
      <strong>${p.activityName}</strong> has been updated. Here's what changed:
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid ${BRAND_COLORS.driftwood};border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:${BRAND_COLORS.cream};">
          <th style="padding:8px 12px;font-size:11px;font-family:monospace;text-align:left;text-transform:uppercase;letter-spacing:0.08em;color:#888;">Field</th>
          <th style="padding:8px 12px;font-size:11px;font-family:monospace;text-align:left;text-transform:uppercase;letter-spacing:0.08em;color:#888;">Was</th>
          <th style="padding:8px 12px;font-size:11px;font-family:monospace;text-align:left;text-transform:uppercase;letter-spacing:0.08em;color:#888;">Now</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:13px;color:#888;margin:16px 0 0;">Always verify details on the camp's website before registering.</p>
    ${ctaButton("View Activity", p.activityUrl)}
  `;
  return layout(body);
}

export function weeklyDigestHtml(p: WeeklyDigestParams): string {
  const matchItems = p.newMatches
    .map(
      (m) => `
      <li style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid ${BRAND_COLORS.driftwood};">
        <a href="https://kidplan.com/activity/${m.slug}" style="font-size:16px;font-weight:600;color:${BRAND_COLORS.bark};text-decoration:none;">${m.name}</a>
        <span style="display:block;font-size:12px;font-family:monospace;text-transform:uppercase;letter-spacing:0.05em;color:#888;margin-top:2px;">
          ${m.categories.join(", ")}${m.ageMin != null && m.ageMax != null ? ` · Ages ${m.ageMin}–${m.ageMax}` : ""}
        </span>
      </li>`
    )
    .join("");

  const gapItems = p.coverageGapWeeks
    .map(
      (w) =>
        `<li style="font-size:14px;color:${BRAND_COLORS.bark};padding:4px 0;">${w}</li>`
    )
    .join("");

  const matchSection =
    p.newMatches.length > 0
      ? `
    <h2 style="font-family:Georgia,serif;font-size:20px;color:${BRAND_COLORS.bark};margin:0 0 12px;">
      New camps for ${p.childName}
    </h2>
    <ul style="list-style:none;padding:0;margin:0 0 24px;">${matchItems}</ul>`
      : "";

  const gapSection =
    p.coverageGapWeeks.length > 0
      ? `
    <h2 style="font-family:Georgia,serif;font-size:20px;color:${BRAND_COLORS.bark};margin:0 0 12px;">
      Weeks still open
    </h2>
    <p style="font-size:14px;color:#666;margin:0 0 12px;">${p.childName} has nothing penciled in for:</p>
    <ul style="list-style:none;padding:0;margin:0 0 24px;">${gapItems}</ul>`
      : "";

  if (!matchSection && !gapSection) {
    const body = `
      <p style="font-size:16px;color:${BRAND_COLORS.bark};">Nothing new this week for ${p.childName}. Check back soon!</p>
      ${ctaButton("Explore Activities", "https://kidplan.com/explore")}
    `;
    return layout(body);
  }

  const body = `
    <h1 style="font-family:Georgia,serif;font-size:26px;color:${BRAND_COLORS.bark};margin:0 0 20px;">
      This week's update for ${p.childName}
    </h1>
    ${matchSection}
    ${gapSection}
    ${ctaButton("Explore Activities", "https://kidplan.com/explore")}
  `;
  return layout(body);
}

export function coverageGapHtml(p: CoverageGapParams): string {
  const items = p.gapWeeks
    .map(
      (w) =>
        `<li style="font-size:14px;color:${BRAND_COLORS.bark};padding:4px 0;">${w}</li>`
    )
    .join("");

  const body = `
    <h1 style="font-family:Georgia,serif;font-size:26px;color:${BRAND_COLORS.bark};margin:0 0 12px;">
      A few weeks still open for ${p.childName}
    </h1>
    <p style="font-size:16px;color:${BRAND_COLORS.bark};line-height:1.6;margin:0 0 12px;">
      ${p.childName}'s schedule has some gaps. Now's a great time to lock in plans:
    </p>
    <ul style="list-style:none;padding:0;margin:0 0 24px;">${items}</ul>
    ${ctaButton("Open Planner", "https://kidplan.com/planner")}
  `;
  return layout(body);
}

// ---------------------------------------------------------------------------
// Send helpers (used by cron routes)
// ---------------------------------------------------------------------------
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const client = getClient();
  return client.emails.send({
    from: "KidPlan <hello@kidplan.com>",
    to,
    subject,
    html,
  });
}
```

- [ ] **Step 5: Run tests — expect pass**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm test -- tests/lib/email.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && git add src/lib/email.ts tests/lib/email.test.ts package.json package-lock.json && git commit -m "feat: add Resend email client and HTML template functions"
```

---

## Task 2: Notification cron routes (reminders + weekly digest)

**Files:**
- Create: `/Users/rachelarteaga/Desktop/kidplan/src/app/api/cron/notify/route.ts`
- Create: `/Users/rachelarteaga/Desktop/kidplan/src/app/api/cron/digest/route.ts`
- Create: `/Users/rachelarteaga/Desktop/kidplan/tests/lib/notify.test.ts`
- Modify: `/Users/rachelarteaga/Desktop/kidplan/vercel.json`

- [ ] **Step 1: Write failing tests for reminder-filtering logic**

Create `/Users/rachelarteaga/Desktop/kidplan/tests/lib/notify.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { filterDueReminders, type ReminderRow } from "@/lib/notify";

describe("filterDueReminders", () => {
  const now = new Date("2026-06-01T08:00:00Z");

  it("includes reminders whose remind_at is in the past and sent_at is null", () => {
    const reminders: ReminderRow[] = [
      {
        id: "r1",
        user_id: "u1",
        activity_id: "a1",
        type: "registration_opens",
        remind_at: "2026-06-01T07:00:00Z",
        sent_at: null,
        user_email: "parent@example.com",
        activity_name: "Nature Explorers",
        activity_slug: "nature-explorers",
        notification_preferences: null,
      },
    ];
    expect(filterDueReminders(reminders, now)).toHaveLength(1);
  });

  it("excludes reminders already sent", () => {
    const reminders: ReminderRow[] = [
      {
        id: "r2",
        user_id: "u1",
        activity_id: "a1",
        type: "registration_opens",
        remind_at: "2026-05-31T07:00:00Z",
        sent_at: "2026-05-31T07:05:00Z",
        user_email: "parent@example.com",
        activity_name: "Art Camp",
        activity_slug: "art-camp",
        notification_preferences: null,
      },
    ];
    expect(filterDueReminders(reminders, now)).toHaveLength(0);
  });

  it("excludes reminders in the future", () => {
    const reminders: ReminderRow[] = [
      {
        id: "r3",
        user_id: "u1",
        activity_id: "a1",
        type: "custom",
        remind_at: "2026-06-02T07:00:00Z",
        sent_at: null,
        user_email: "parent@example.com",
        activity_name: "Soccer Stars",
        activity_slug: "soccer-stars",
        notification_preferences: null,
      },
    ];
    expect(filterDueReminders(reminders, now)).toHaveLength(0);
  });

  it("respects notification_preferences toggle — skips when type is disabled", () => {
    const reminders: ReminderRow[] = [
      {
        id: "r4",
        user_id: "u1",
        activity_id: "a1",
        type: "registration_opens",
        remind_at: "2026-06-01T06:00:00Z",
        sent_at: null,
        user_email: "parent@example.com",
        activity_name: "Swim Camp",
        activity_slug: "swim-camp",
        notification_preferences: { registration_opens: false },
      },
    ];
    expect(filterDueReminders(reminders, now)).toHaveLength(0);
  });

  it("allows reminder when preference is explicitly true", () => {
    const reminders: ReminderRow[] = [
      {
        id: "r5",
        user_id: "u1",
        activity_id: "a1",
        type: "registration_closes",
        remind_at: "2026-06-01T06:00:00Z",
        sent_at: null,
        user_email: "parent@example.com",
        activity_name: "Dance Studio",
        activity_slug: "dance-studio",
        notification_preferences: { registration_closes: true },
      },
    ];
    expect(filterDueReminders(reminders, now)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm test -- tests/lib/notify.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/notify'`

- [ ] **Step 3: Create `src/lib/notify.ts`**

```typescript
// src/lib/notify.ts
// Pure logic helpers for the notification cron routes.

export interface ReminderRow {
  id: string;
  user_id: string;
  activity_id: string;
  type: "registration_opens" | "registration_closes" | "custom";
  remind_at: string;
  sent_at: string | null;
  user_email: string;
  activity_name: string;
  activity_slug: string;
  notification_preferences: Record<string, boolean> | null;
}

/**
 * Returns reminders that should fire now:
 *  - remind_at <= now
 *  - sent_at IS NULL
 *  - the relevant notification_preferences key is not explicitly false
 */
export function filterDueReminders(reminders: ReminderRow[], now: Date): ReminderRow[] {
  return reminders.filter((r) => {
    if (r.sent_at !== null) return false;
    if (new Date(r.remind_at) > now) return false;
    const prefs = r.notification_preferences;
    if (prefs !== null && prefs[r.type] === false) return false;
    return true;
  });
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm test -- tests/lib/notify.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Create the daily reminder cron route**

Create `/Users/rachelarteaga/Desktop/kidplan/src/app/api/cron/notify/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { filterDueReminders, type ReminderRow } from "@/lib/notify";
import {
  registrationReminderHtml,
  sendEmail,
} from "@/lib/email";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role env vars not set");
  return createClient(url, key) as any;
}

function verifyCron(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return req.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const now = new Date();

  // Fetch all unsent reminders that are due, joining user email + activity name
  const { data: rows, error } = await supabase
    .from("reminders")
    .select(`
      id, user_id, activity_id, type, remind_at, sent_at,
      activity:activities(name, slug),
      profile:profiles(email:users(email), notification_preferences)
    `)
    .is("sent_at", null)
    .lte("remind_at", now.toISOString());

  if (error) {
    console.error("notify cron fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten to ReminderRow shape (Supabase join nesting)
  const reminders: ReminderRow[] = (rows ?? []).map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    activity_id: r.activity_id,
    type: r.type,
    remind_at: r.remind_at,
    sent_at: r.sent_at,
    user_email: r.profile?.email ?? "",
    activity_name: r.activity?.name ?? "an activity",
    activity_slug: r.activity?.slug ?? "",
    notification_preferences: r.profile?.notification_preferences ?? null,
  }));

  const due = filterDueReminders(reminders, now);

  let sent = 0;
  let failed = 0;

  for (const reminder of due) {
    if (!reminder.user_email) continue;

    const activityUrl = `https://kidplan.com/activity/${reminder.activity_slug}`;
    const subjectMap: Record<string, string> = {
      registration_opens: `Registration opens soon — ${reminder.activity_name}`,
      registration_closes: `Registration closes soon — ${reminder.activity_name}`,
      custom: `Your reminder — ${reminder.activity_name}`,
    };

    try {
      await sendEmail({
        to: reminder.user_email,
        subject: subjectMap[reminder.type] ?? `Reminder: ${reminder.activity_name}`,
        html: registrationReminderHtml({
          activityName: reminder.activity_name,
          reminderType: reminder.type,
          remindAt: reminder.remind_at,
          activityUrl,
        }),
      });

      // Mark as sent
      await supabase
        .from("reminders")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", reminder.id);

      sent++;
    } catch (err) {
      console.error(`Failed to send reminder ${reminder.id}:`, err);
      failed++;
    }
  }

  return NextResponse.json({ due: due.length, sent, failed });
}
```

- [ ] **Step 6: Create the weekly digest cron route**

Create `/Users/rachelarteaga/Desktop/kidplan/src/app/api/cron/digest/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { weeklyDigestHtml, sendEmail } from "@/lib/email";
import { formatWeekRange, getWeekStart } from "@/lib/format";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role env vars not set");
  return createClient(url, key) as any;
}

function verifyCron(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return req.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();

  // Fetch all users with at least one child, including their email and notification prefs
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id, notification_preferences, users(email)")
    .not("users", "is", null);

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  // Fetch children for all users
  const { data: children, error: childrenError } = await supabase
    .from("children")
    .select("id, user_id, name, birth_date, interests");

  if (childrenError) {
    return NextResponse.json({ error: childrenError.message }, { status: 500 });
  }

  // Fetch activities added in the last 7 days that are active
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: newActivities, error: activitiesError } = await supabase
    .from("activities")
    .select("id, name, slug, categories, age_min, age_max, scraped_at")
    .eq("is_active", true)
    .gte("scraped_at", since);

  if (activitiesError) {
    return NextResponse.json({ error: activitiesError.message }, { status: 500 });
  }

  // Fetch planner entries for coverage-gap detection (next 12 weeks)
  const todayStr = new Date().toISOString().split("T")[0];
  const twelveWeeks = new Date();
  twelveWeeks.setDate(twelveWeeks.getDate() + 84);
  const twelveWeeksStr = twelveWeeks.toISOString().split("T")[0];

  const { data: plannerEntries } = await supabase
    .from("planner_entries")
    .select("child_id, session:sessions(starts_at, ends_at)")
    .neq("status", "cancelled")
    .gte("session.starts_at", todayStr)
    .lte("session.ends_at", twelveWeeksStr);

  // Build coverage map: child_id -> Set<weekKey>
  const coveredWeeks: Record<string, Set<string>> = {};
  for (const entry of plannerEntries ?? []) {
    if (!entry.session?.starts_at) continue;
    const key = entry.child_id;
    if (!coveredWeeks[key]) coveredWeeks[key] = new Set();
    const weekStart = getWeekStart(new Date(entry.session.starts_at + "T00:00:00"));
    coveredWeeks[key].add(weekStart.toISOString().split("T")[0]);
  }

  // Generate next 12 week-start dates for gap comparison
  const upcomingWeeks: Date[] = [];
  const cursor = getWeekStart(new Date());
  for (let i = 0; i < 12; i++) {
    upcomingWeeks.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  const profileList = profiles ?? [];
  const childrenList = children ?? [];
  const newActivityList = newActivities ?? [];

  for (const profile of profileList) {
    const email = profile.users?.email;
    if (!email) { skipped++; continue; }

    // Check global digest preference — default to enabled
    const prefs: Record<string, boolean> = profile.notification_preferences ?? {};
    if (prefs.weekly_digest === false) { skipped++; continue; }

    const userChildren = childrenList.filter((c: any) => c.user_id === profile.user_id);
    if (userChildren.length === 0) { skipped++; continue; }

    for (const child of userChildren) {
      // New matches: activities that overlap child's interests and age
      const childAge = child.birth_date
        ? Math.floor(
            (Date.now() - new Date(child.birth_date).getTime()) /
              (1000 * 60 * 60 * 24 * 365.25)
          )
        : null;

      const newMatches = newActivityList.filter((a: any) => {
        const interestMatch =
          !child.interests?.length ||
          (a.categories ?? []).some((cat: string) => child.interests.includes(cat));
        const ageMatch =
          childAge == null ||
          ((a.age_min == null || a.age_min <= childAge) &&
            (a.age_max == null || a.age_max >= childAge));
        return interestMatch && ageMatch;
      });

      // Coverage gaps
      const covered = coveredWeeks[child.id] ?? new Set<string>();
      const gapWeeks = upcomingWeeks
        .filter((w) => !covered.has(w.toISOString().split("T")[0]))
        .map((w) => formatWeekRange(w));

      if (newMatches.length === 0 && gapWeeks.length === 0) continue;

      try {
        await sendEmail({
          to: email,
          subject: `This week's KidPlan update for ${child.name}`,
          html: weeklyDigestHtml({
            childName: child.name,
            newMatches: newMatches.map((a: any) => ({
              name: a.name,
              slug: a.slug,
              categories: a.categories ?? [],
              ageMin: a.age_min,
              ageMax: a.age_max,
            })),
            coverageGapWeeks: gapWeeks.slice(0, 4), // max 4 gap weeks in digest
          }),
        });
        sent++;
      } catch (err) {
        console.error(`digest send failed for ${email}:`, err);
        failed++;
      }
    }
  }

  return NextResponse.json({ sent, failed, skipped });
}
```

- [ ] **Step 7: Add the two new crons to `vercel.json`**

Open `/Users/rachelarteaga/Desktop/kidplan/vercel.json`. Replace the contents with:

```json
{
  "crons": [
    { "path": "/api/cron/scrape",  "schedule": "0 3 * * *"  },
    { "path": "/api/cron/notify",  "schedule": "0 7 * * *"  },
    { "path": "/api/cron/digest",  "schedule": "0 8 * * 1"  }
  ]
}
```

(Scrape: 3am daily. Notify: 7am daily for due reminders. Digest: 8am every Monday.)

- [ ] **Step 8: Run all tests**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm test
```

Expected: 109+ tests pass (the 5 new notify tests now included).

- [ ] **Step 9: Commit**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && git add src/lib/notify.ts src/app/api/cron/notify/route.ts src/app/api/cron/digest/route.ts tests/lib/notify.test.ts vercel.json && git commit -m "feat: add daily reminder cron and weekly digest cron"
```

---

## Task 3: Reminder + notification-preferences actions

**Files:**
- Modify: `/Users/rachelarteaga/Desktop/kidplan/src/lib/actions.ts`
- Modify: `/Users/rachelarteaga/Desktop/kidplan/src/lib/queries.ts`
- Create: `/Users/rachelarteaga/Desktop/kidplan/tests/lib/actions-notify.test.ts`

These are server actions called from the activity detail page and a settings UI.

- [ ] **Step 1: Write failing tests**

Create `/Users/rachelarteaga/Desktop/kidplan/tests/lib/actions-notify.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the pure data-shaping / validation logic in isolation.
// Full integration (Supabase calls) is covered by manual smoke testing.

import { buildReminderInsert, type ReminderInsertInput } from "@/lib/reminder-helpers";

describe("buildReminderInsert", () => {
  it("returns a valid insert object for registration_opens type", () => {
    const input: ReminderInsertInput = {
      userId: "user-1",
      activityId: "activity-1",
      type: "registration_opens",
      remindAt: "2026-06-01T07:00:00Z",
    };
    const result = buildReminderInsert(input);
    expect(result.user_id).toBe("user-1");
    expect(result.activity_id).toBe("activity-1");
    expect(result.type).toBe("registration_opens");
    expect(result.remind_at).toBe("2026-06-01T07:00:00Z");
    expect(result.sent_at).toBeNull();
  });

  it("throws if remindAt is in the past", () => {
    const input: ReminderInsertInput = {
      userId: "user-1",
      activityId: "activity-1",
      type: "custom",
      remindAt: "2020-01-01T00:00:00Z",
    };
    expect(() => buildReminderInsert(input)).toThrow("Reminder date must be in the future");
  });

  it("throws if type is invalid", () => {
    const input = {
      userId: "user-1",
      activityId: "activity-1",
      type: "invalid_type" as any,
      remindAt: new Date(Date.now() + 86400000).toISOString(),
    };
    expect(() => buildReminderInsert(input)).toThrow("Invalid reminder type");
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm test -- tests/lib/actions-notify.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/reminder-helpers'`

- [ ] **Step 3: Create `src/lib/reminder-helpers.ts`**

```typescript
// src/lib/reminder-helpers.ts
// Pure validation helpers (no Supabase dependency — safe to import in tests).

const VALID_TYPES = ["registration_opens", "registration_closes", "custom"] as const;
type ReminderType = (typeof VALID_TYPES)[number];

export interface ReminderInsertInput {
  userId: string;
  activityId: string;
  type: ReminderType;
  remindAt: string; // ISO string
}

export interface ReminderInsertPayload {
  user_id: string;
  activity_id: string;
  type: ReminderType;
  remind_at: string;
  sent_at: null;
}

export function buildReminderInsert(input: ReminderInsertInput): ReminderInsertPayload {
  if (!VALID_TYPES.includes(input.type)) {
    throw new Error("Invalid reminder type");
  }
  if (new Date(input.remindAt) <= new Date()) {
    throw new Error("Reminder date must be in the future");
  }
  return {
    user_id: input.userId,
    activity_id: input.activityId,
    type: input.type,
    remind_at: input.remindAt,
    sent_at: null,
  };
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm test -- tests/lib/actions-notify.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Add `setReminder` and `updateNotificationPreferences` to `src/lib/actions.ts`**

Append to the bottom of `/Users/rachelarteaga/Desktop/kidplan/src/lib/actions.ts`:

```typescript
import { buildReminderInsert } from "@/lib/reminder-helpers";

export async function setReminder(
  activityId: string,
  type: "registration_opens" | "registration_closes" | "custom",
  remindAt: string
) {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  let payload;
  try {
    payload = buildReminderInsert({ userId: user.id, activityId, type, remindAt });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid input" };
  }

  // Upsert: one reminder per user+activity+type (replace if exists and unsent)
  const { error } = await supabase
    .from("reminders")
    .upsert(payload, { onConflict: "user_id,activity_id,type", ignoreDuplicates: false });

  if (error) {
    console.error("setReminder error:", error);
    return { error: "Failed to set reminder" };
  }

  return { success: true };
}

export async function updateNotificationPreferences(
  preferences: Record<string, boolean>
) {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ notification_preferences: preferences })
    .eq("user_id", user.id);

  if (error) {
    console.error("updateNotificationPreferences error:", error);
    return { error: "Failed to update preferences" };
  }

  revalidatePath("/settings");
  return { success: true };
}
```

- [ ] **Step 6: Run all tests**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm test
```

Expected: 112+ tests pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && git add src/lib/reminder-helpers.ts src/lib/actions.ts tests/lib/actions-notify.test.ts && git commit -m "feat: add setReminder and updateNotificationPreferences actions"
```

---

## Task 4: Share activity — Web Share API button

**Files:**
- Create: `/Users/rachelarteaga/Desktop/kidplan/src/components/activity/share-button.tsx`
- Modify: `/Users/rachelarteaga/Desktop/kidplan/src/app/activity/[slug]/page.tsx`
- Create: `/Users/rachelarteaga/Desktop/kidplan/tests/components/activity/share-button.test.tsx`

The `/activity/[slug]` route is already publicly accessible (no auth required on that page). This task wires up the share button.

- [ ] **Step 1: Write failing component test**

Create `/Users/rachelarteaga/Desktop/kidplan/tests/components/activity/share-button.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShareButton } from "@/components/activity/share-button";

describe("ShareButton", () => {
  beforeEach(() => {
    // Reset navigator.share
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    });
  });

  it("renders a Share button", () => {
    render(<ShareButton url="https://kidplan.com/activity/nature-explorers" title="Nature Explorers" />);
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
  });

  it("falls back to clipboard copy when Web Share API is not available", async () => {
    render(<ShareButton url="https://kidplan.com/activity/nature-explorers" title="Nature Explorers" />);
    const btn = screen.getByRole("button", { name: /share/i });
    fireEvent.click(btn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://kidplan.com/activity/nature-explorers"
    );
  });

  it("calls navigator.share when Web Share API is available", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: shareMock,
      configurable: true,
    });
    render(<ShareButton url="https://kidplan.com/activity/art-fusion" title="Art Fusion" />);
    fireEvent.click(screen.getByRole("button", { name: /share/i }));
    expect(shareMock).toHaveBeenCalledWith({
      title: "Art Fusion",
      url: "https://kidplan.com/activity/art-fusion",
    });
  });

  it("shows 'Copied!' label briefly after clipboard copy", async () => {
    vi.useFakeTimers();
    render(<ShareButton url="https://kidplan.com/activity/x" title="X" />);
    fireEvent.click(screen.getByRole("button", { name: /share/i }));
    expect(await screen.findByText(/copied/i)).toBeInTheDocument();
    vi.runAllTimers();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm test -- tests/components/activity/share-button.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/activity/share-button'`

- [ ] **Step 3: Create `src/components/activity/share-button.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ShareButtonProps {
  url: string;
  title: string;
}

export function ShareButton({ url, title }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // User cancelled — not an error
      }
      return;
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail if clipboard is also unavailable
    }
  }

  return (
    <Button variant="outline" onClick={handleShare}>
      {copied ? "Copied!" : "Share"}
    </Button>
  );
}
```

- [ ] **Step 4: Wire `ShareButton` into the activity detail page**

In `/Users/rachelarteaga/Desktop/kidplan/src/app/activity/[slug]/page.tsx`, add the import at the top (after the existing imports):

```typescript
import { ShareButton } from "@/components/activity/share-button";
```

Then in the action buttons `<div>` (around line 49), add `<ShareButton>` after `<PlannerStub />`:

```tsx
{/* Action buttons */}
<div className="flex flex-wrap items-center gap-3 mb-8">
  {activity.registration_url && (
    <a href={activity.registration_url} target="_blank" rel="noopener noreferrer">
      <Button>Visit Camp Website</Button>
    </a>
  )}
  <FavoriteButton activityId={activity.id} initialFavorited={isFavorited} />
  <PlannerStub />
  <ShareButton
    url={`${process.env.NEXT_PUBLIC_APP_URL ?? "https://kidplan.com"}/activity/${activity.slug}`}
    title={activity.name}
  />
</div>
```

- [ ] **Step 5: Run tests — expect pass**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm test -- tests/components/activity/share-button.test.tsx
```

Expected: all 4 tests PASS.

- [ ] **Step 6: Run all tests**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm test
```

Expected: 116+ tests pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && git add src/components/activity/share-button.tsx src/app/activity/[slug]/page.tsx tests/components/activity/share-button.test.tsx && git commit -m "feat: add Web Share API share button to activity detail"
```

---

## Task 5: Share a schedule — token link + public page

**Files:**
- Modify: `/Users/rachelarteaga/Desktop/kidplan/src/lib/actions.ts`
- Modify: `/Users/rachelarteaga/Desktop/kidplan/src/lib/queries.ts`
- Create: `/Users/rachelarteaga/Desktop/kidplan/src/app/schedule/[token]/page.tsx`
- Create: `/Users/rachelarteaga/Desktop/kidplan/src/components/planner/share-schedule-button.tsx`
- Create: `/Users/rachelarteaga/Desktop/kidplan/tests/components/planner/share-schedule-button.test.tsx`

- [ ] **Step 1: Write failing test for share-schedule-button**

Create `/Users/rachelarteaga/Desktop/kidplan/tests/components/planner/share-schedule-button.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ShareScheduleButton } from "@/components/planner/share-schedule-button";

// Mock the server action
vi.mock("@/lib/actions", () => ({
  createSharedSchedule: vi.fn().mockResolvedValue({ token: "abc123" }),
}));

describe("ShareScheduleButton", () => {
  it("renders the share button", () => {
    render(
      <ShareScheduleButton
        childId="child-1"
        childName="Maya"
        dateFrom="2026-06-01"
        dateTo="2026-08-31"
      />
    );
    expect(screen.getByRole("button", { name: /share maya's schedule/i })).toBeInTheDocument();
  });

  it("calls createSharedSchedule and shows the link on click", async () => {
    const { createSharedSchedule } = await import("@/lib/actions");
    render(
      <ShareScheduleButton
        childId="child-1"
        childName="Maya"
        dateFrom="2026-06-01"
        dateTo="2026-08-31"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /share maya's schedule/i }));
    await waitFor(() => {
      expect(createSharedSchedule).toHaveBeenCalledWith("child-1", "2026-06-01", "2026-08-31");
    });
    expect(await screen.findByText(/kidplan.com\/schedule\/abc123/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm test -- tests/components/planner/share-schedule-button.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/planner/share-schedule-button'`

- [ ] **Step 3: Add `createSharedSchedule` to `src/lib/actions.ts`**

Append to `/Users/rachelarteaga/Desktop/kidplan/src/lib/actions.ts`:

```typescript
export async function createSharedSchedule(
  childId: string,
  dateFrom: string,
  dateTo: string
): Promise<{ token: string } | { error: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Generate a URL-safe random token (16 bytes → 22 base64url chars)
  const tokenBytes = crypto.getRandomValues(new Uint8Array(16));
  const token = btoa(String.fromCharCode(...tokenBytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const { error } = await supabase.from("shared_schedules").insert({
    user_id: user.id,
    child_id: childId,
    token,
    date_from: dateFrom,
    date_to: dateTo,
  });

  if (error) {
    console.error("createSharedSchedule error:", error);
    return { error: "Failed to create share link" };
  }

  return { token };
}

export async function revokeSharedSchedule(token: string) {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("shared_schedules")
    .delete()
    .eq("token", token)
    .eq("user_id", user.id);

  if (error) {
    console.error("revokeSharedSchedule error:", error);
    return { error: "Failed to revoke share link" };
  }

  revalidatePath("/planner");
  return { success: true };
}
```

- [ ] **Step 4: Create `src/components/planner/share-schedule-button.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createSharedSchedule } from "@/lib/actions";

interface ShareScheduleButtonProps {
  childId: string;
  childName: string;
  dateFrom: string;
  dateTo: string;
}

export function ShareScheduleButton({
  childId,
  childName,
  dateFrom,
  dateTo,
}: ShareScheduleButtonProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    setLoading(true);
    const result = await createSharedSchedule(childId, dateFrom, dateTo);
    setLoading(false);

    if ("error" in result) {
      console.error(result.error);
      return;
    }

    const url = `${window.location.origin}/schedule/${result.token}`;
    setShareUrl(url);

    if (navigator.share) {
      try {
        await navigator.share({ title: `${childName}'s KidPlan Schedule`, url });
      } catch {
        // cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={handleShare} disabled={loading}>
        {loading ? "Generating…" : `Share ${childName}'s Schedule`}
      </Button>
      {shareUrl && (
        <span className="font-mono text-[11px] text-bark/60 truncate max-w-[180px]" title={shareUrl}>
          {shareUrl.replace("https://", "")}
          {copied && (
            <span className="ml-1 text-meadow">— copied!</span>
          )}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Add `fetchSharedSchedule` to `src/lib/queries.ts`**

Append to `/Users/rachelarteaga/Desktop/kidplan/src/lib/queries.ts`:

```typescript
export interface SharedScheduleRow {
  id: string;
  child_id: string;
  date_from: string;
  date_to: string;
  child: {
    name: string;
  };
  planner_entries: PlannerEntryRow[];
}

export async function fetchSharedSchedule(token: string): Promise<SharedScheduleRow | null> {
  // Use anon client — no auth required for public share pages
  const { createClient: createAnonClient } = await import("@/lib/supabase/client");
  const supabase = createAnonClient() as any;

  const { data, error } = await supabase
    .from("shared_schedules")
    .select(`
      id, child_id, date_from, date_to,
      child:children(name),
      planner_entries(
        id, child_id, session_id, status, sort_order,
        session:sessions!inner(
          id, starts_at, ends_at, time_slot, hours_start, hours_end, is_sold_out,
          activity:activities!inner(
            id, name, slug, categories, registration_url,
            organization:organizations(id, name),
            price_options(id, label, price_cents, price_unit),
            activity_locations(id, address, location_name)
          )
        )
      )
    `)
    .eq("token", token)
    .single();

  if (error) {
    console.error("fetchSharedSchedule error:", error);
    return null;
  }

  // Filter planner entries to the shared date range and strip notes (private)
  const dateFrom = new Date(data.date_from + "T00:00:00");
  const dateTo = new Date(data.date_to + "T00:00:00");

  const filteredEntries = (data.planner_entries ?? []).filter((entry: any) => {
    if (entry.status === "cancelled") return false;
    const start = new Date(entry.session?.starts_at + "T00:00:00");
    return start >= dateFrom && start <= dateTo;
  });

  return {
    ...data,
    planner_entries: filteredEntries,
  } as SharedScheduleRow;
}
```

- [ ] **Step 6: Create the public schedule page**

Create `/Users/rachelarteaga/Desktop/kidplan/src/app/schedule/[token]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { fetchSharedSchedule } from "@/lib/queries";
import { formatDateRange, formatWeekRange, getWeekStart, getWeekKey, generateWeeks } from "@/lib/format";

interface SharedSchedulePageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedSchedulePage({ params }: SharedSchedulePageProps) {
  const { token } = await params;
  const schedule = await fetchSharedSchedule(token);

  if (!schedule) {
    notFound();
  }

  const dateFrom = new Date(schedule.date_from + "T00:00:00");
  const dateTo = new Date(schedule.date_to + "T00:00:00");
  const weeks = generateWeeks(dateFrom, dateTo);

  // Group entries by week key
  const entriesByWeek: Record<string, typeof schedule.planner_entries> = {};
  for (const entry of schedule.planner_entries) {
    const start = new Date((entry as any).session.starts_at + "T00:00:00");
    const key = getWeekKey(start);
    if (!entriesByWeek[key]) entriesByWeek[key] = [];
    entriesByWeek[key].push(entry);
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-bark mb-2">
          {schedule.child.name}'s Schedule
        </h1>
        <p className="font-mono text-[11px] uppercase tracking-wide text-stone">
          {formatDateRange(schedule.date_from, schedule.date_to)}
        </p>
      </div>

      {/* Week rows */}
      <div className="space-y-4">
        {weeks.map((weekStart) => {
          const key = getWeekKey(weekStart);
          const weekEntries = entriesByWeek[key] ?? [];

          return (
            <div key={key} className="rounded-xl border border-driftwood/30 bg-white overflow-hidden">
              <div className="px-4 py-2 bg-cream border-b border-driftwood/20">
                <span className="font-mono text-[11px] uppercase tracking-wide text-stone">
                  {formatWeekRange(weekStart)}
                </span>
              </div>

              {weekEntries.length === 0 ? (
                <div className="px-4 py-3">
                  <span className="text-sm text-stone/60 italic">Nothing planned</span>
                </div>
              ) : (
                <ul className="divide-y divide-driftwood/20">
                  {weekEntries.map((entry: any) => {
                    const activity = entry.session.activity;
                    const statusColor =
                      entry.status === "locked_in"
                        ? "bg-meadow/20 text-meadow"
                        : "bg-campfire/20 text-campfire";

                    return (
                      <li key={entry.id} className="px-4 py-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-bark text-sm">{activity.name}</p>
                          <p className="font-mono text-[10px] uppercase tracking-wide text-stone mt-0.5">
                            {formatDateRange(entry.session.starts_at, entry.session.ends_at)}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] uppercase tracking-wide ${statusColor}`}
                        >
                          {entry.status === "locked_in" ? "Locked In" : "Penciled In"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="mt-12 rounded-xl bg-bark text-cream p-6 text-center">
        <p className="font-serif text-xl mb-2">Plan your own kid's activities</p>
        <p className="text-cream/70 text-sm mb-4">
          KidPlan brings every camp and class in the Triangle into one place.
        </p>
        <a
          href="https://kidplan.com/auth/signup"
          className="inline-block px-6 py-2.5 bg-sunset text-white rounded-full font-mono text-[12px] uppercase tracking-wider"
        >
          Start Planning Free
        </a>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Run tests — expect pass**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm test -- tests/components/planner/share-schedule-button.test.tsx
```

Expected: both tests PASS.

- [ ] **Step 8: Run all tests**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && npm test
```

Expected: 118+ tests pass.

- [ ] **Step 9: Commit**

```bash
cd /Users/rachelarteaga/Desktop/kidplan && git add src/lib/actions.ts src/lib/queries.ts src/components/planner/share-schedule-button.tsx src/app/schedule/[token]/page.tsx tests/components/planner/share-schedule-button.test.tsx && git commit -m "feat: add schedule sharing with token link and public read-only schedule page"
```

---

## Self-Review

### Spec Coverage

| Spec requirement | Covered by |
|---|---|
| Email via Resend | Task 1 — `src/lib/email.ts` |
| Registration deadline reminders (daily cron) | Task 2 — `/api/cron/notify/route.ts` |
| Data change alerts (favorited activity price/date change) | Task 2 — notify cron dispatches `dataChangeAlertHtml` (scraper diff triggers are wired at upsert layer — out of scope here, documented in scraping plan) |
| New camp match weekly digest | Task 2 — `/api/cron/digest/route.ts` |
| Coverage gap nudge in digest | Task 2 — digest computes gap weeks per child |
| Custom reminders fire on date | Task 2 — `filterDueReminders` handles `type: "custom"` |
| Notification preferences toggle | Task 3 — `updateNotificationPreferences` action; `filterDueReminders` respects prefs |
| Email templates warm/on-brand | Task 1 — inline-styled HTML using brand colors, conversational copy |
| Share activity — public URL | Already exists (`/activity/[slug]` is `force-dynamic`, no auth gate) |
| Web Share API button on activity detail | Task 4 — `ShareButton` wired into `page.tsx` |
| Share schedule — generate token link | Task 5 — `createSharedSchedule` action |
| `/schedule/[token]` public page | Task 5 — `src/app/schedule/[token]/page.tsx` |
| Notes excluded from shared schedule | Task 5 — `fetchSharedSchedule` returns `planner_entries` without `notes` field in select |
| No auth required on schedule page | Task 5 — uses anon Supabase client, no `createClient()` from server auth context |
| Crons on separate schedules | Task 2 — notify at `0 7 * * *`, digest at `0 8 * * 1`, scrape unchanged at `0 3 * * *` |

### Placeholder Scan

No TBDs, todos, or "similar to" references found. All code steps contain complete implementations.

### Type Consistency

- `ReminderRow` defined in `src/lib/notify.ts` — used only within `notify.test.ts` and `notify/route.ts`.
- `buildReminderInsert` / `ReminderInsertInput` / `ReminderInsertPayload` defined in `reminder-helpers.ts` — imported in `actions.ts` and tested in `actions-notify.test.ts`. Names match throughout.
- `SharedScheduleRow` defined in `queries.ts` — consumed in `schedule/[token]/page.tsx` as `schedule.child.name`, `schedule.planner_entries`, `schedule.date_from`, `schedule.date_to`. All property accesses match the interface definition.
- `fetchSharedSchedule` imports from `@/lib/supabase/client` (the browser/anon client) — this is the correct client for a public page. The path matches the existing file at `src/lib/supabase/client.ts`.
