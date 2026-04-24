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
            <span style="font-family:Georgia,serif;font-size:22px;color:${BRAND_COLORS.cream};letter-spacing:-0.5px;">Kidtinerary</span>
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
              You're receiving this because you have notifications turned on in Kidtinerary.
              <a href="https://kidtinerary.com/settings" style="color:${BRAND_COLORS.sunset};text-decoration:none;">Manage preferences</a>
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
        <a href="https://kidtinerary.com/activity/${m.slug}" style="font-size:16px;font-weight:600;color:${BRAND_COLORS.bark};text-decoration:none;">${m.name}</a>
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
      ${ctaButton("Open your Catalog", "https://kidtinerary.com/catalog")}
    `;
    return layout(body);
  }

  const body = `
    <h1 style="font-family:Georgia,serif;font-size:26px;color:${BRAND_COLORS.bark};margin:0 0 20px;">
      This week's update for ${p.childName}
    </h1>
    ${matchSection}
    ${gapSection}
    ${ctaButton("Open your Catalog", "https://kidtinerary.com/catalog")}
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
    ${ctaButton("Open Planner", "https://kidtinerary.com/planner")}
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
    from: "Kidtinerary <hello@kidtinerary.com>",
    to,
    subject,
    html,
  });
}
