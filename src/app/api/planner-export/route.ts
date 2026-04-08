import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchPlannerEntries } from "@/lib/queries";

function escapeIcs(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Fold long lines per RFC 5545 (max 75 octets). */
function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const chunks: string[] = [];
  let start = 0;
  let first = true;
  while (start < bytes.length) {
    const max = first ? 75 : 74; // continuation lines start with a space (1 byte)
    const slice = bytes.slice(start, start + max);
    chunks.push(new TextDecoder().decode(slice));
    start += max;
    first = false;
  }
  return chunks.join("\r\n ");
}

function toIcsDate(dateStr: string): string {
  // dateStr is "YYYY-MM-DD" — emit as DATE value (all-day)
  return dateStr.replace(/-/g, "");
}

function buildIcs(events: { uid: string; summary: string; description: string; dtstart: string; dtend: string; url: string }[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kidtinerary//Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Kidtinerary Plan",
  ];

  for (const ev of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(foldLine(`UID:${ev.uid}`));
    lines.push(foldLine(`SUMMARY:${escapeIcs(ev.summary)}`));
    lines.push(foldLine(`DESCRIPTION:${escapeIcs(ev.description)}`));
    lines.push(foldLine(`DTSTART;VALUE=DATE:${toIcsDate(ev.dtstart)}`));
    // DTEND for all-day events is exclusive, so +1 day past ends_at
    const endExclusive = new Date(ev.dtend + "T00:00:00");
    endExclusive.setDate(endExclusive.getDate() + 1);
    const endStr = endExclusive.toISOString().split("T")[0];
    lines.push(foldLine(`DTEND;VALUE=DATE:${toIcsDate(endStr)}`));
    lines.push(foldLine(`URL:${ev.url}`));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export async function GET(request: NextRequest) {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const childId = request.nextUrl.searchParams.get("childId");
  if (!childId) {
    return NextResponse.json({ error: "childId required" }, { status: 400 });
  }

  const entries = await fetchPlannerEntries(user.id, childId);
  const lockedIn = entries.filter((e) => e.status === "locked_in");

  const origin = request.nextUrl.origin;

  const events = lockedIn.map((entry) => {
    const activity = entry.session.activity;
    const org = activity.organization?.name ?? "";
    const description = [
      org ? `Organizer: ${org}` : "",
      activity.registration_url ? `Register: ${activity.registration_url}` : "",
      entry.notes ? `Notes: ${entry.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      uid: `kidtinerary-entry-${entry.id}@kidtinerary.app`,
      summary: activity.name,
      description,
      dtstart: entry.session.starts_at,
      dtend: entry.session.ends_at,
      url: `${origin}/activity/${activity.slug}`,
    };
  });

  const icsContent = buildIcs(events);

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="kidtinerary-plan.ics"',
      "Cache-Control": "no-store",
    },
  });
}
