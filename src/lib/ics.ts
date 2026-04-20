import type { PlannerEntryRow } from "@/lib/queries";
import type { PlannerEntryStatus } from "@/lib/supabase/types";

type ExportableEntry = Omit<PlannerEntryRow, "status"> & {
  status: PlannerEntryStatus;
};

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

function nowUTC(): string {
  // DTSTAMP format: YYYYMMDDTHHMMSSZ
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/**
 * Build an iCalendar (.ics) string from planner entries for a given child.
 *
 * Entries with status `registered` are exported as `STATUS:CONFIRMED`.
 * Entries with status `waitlisted` are exported as `STATUS:TENTATIVE`.
 * Entries in any other state (e.g. `considering`) are skipped.
 */
export function generateICS(
  entries: ExportableEntry[],
  childName: string,
  origin?: string
): string {
  const exportable = entries.filter(
    (e) => e.status === "registered" || e.status === "waitlisted"
  );

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kidtinerary//Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    foldLine(`X-WR-CALNAME:${escapeIcs(`Kidtinerary — ${childName}`)}`),
  ];

  for (const entry of exportable) {
    const activity = entry.session.activity;
    const org = activity.organization?.name ?? "";
    const description = [
      org ? `Organizer: ${org}` : "",
      activity.registration_url ? `Register: ${activity.registration_url}` : "",
      entry.notes ? `Notes: ${entry.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const location =
      activity.activity_locations?.[0]?.address ??
      activity.activity_locations?.[0]?.location_name ??
      "";

    // DTEND for all-day events is exclusive, so +1 day past ends_at
    const endExclusive = new Date(entry.session.ends_at + "T00:00:00");
    endExclusive.setDate(endExclusive.getDate() + 1);
    const endStr = endExclusive.toISOString().split("T")[0];

    const uid = `kidtinerary-entry-${entry.id}@kidtinerary.app`;
    const summary = `${activity.name} — ${childName}`;
    const icsStatus = entry.status === "registered" ? "CONFIRMED" : "TENTATIVE";
    const url = origin ? `${origin}/activity/${activity.slug}` : "";

    const vevent = [
      "BEGIN:VEVENT",
      foldLine(`UID:${uid}`),
      foldLine(`SUMMARY:${escapeIcs(summary)}`),
      `STATUS:${icsStatus}`,
      description ? foldLine(`DESCRIPTION:${escapeIcs(description)}`) : "",
      location ? foldLine(`LOCATION:${escapeIcs(location)}`) : "",
      foldLine(`DTSTART;VALUE=DATE:${toIcsDate(entry.session.starts_at)}`),
      foldLine(`DTEND;VALUE=DATE:${toIcsDate(endStr)}`),
      url ? foldLine(`URL:${url}`) : "",
      `DTSTAMP:${nowUTC()}`,
      "END:VEVENT",
    ].filter(Boolean);

    lines.push(...vevent);
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
