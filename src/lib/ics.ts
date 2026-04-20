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

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function timeRange(part: "full" | "am" | "pm" | null | undefined): [string, string] {
  if (part === "am") return ["090000", "120000"];
  if (part === "pm") return ["130000", "170000"];
  return ["090000", "170000"];
}

function formatLocalDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
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

    const summary = `${activity.name} — ${childName}`;
    const icsStatus = entry.status === "registered" ? "CONFIRMED" : "TENTATIVE";
    const url = origin ? `${origin}/activity/${activity.slug}` : "";

    // Compute the list of dates to emit based on session date range + days_of_week.
    const start = new Date(entry.session.starts_at + "T00:00:00");
    const end = new Date(entry.session.ends_at + "T00:00:00");
    const daysOfWeek = (entry.days_of_week as string[] | null | undefined) ?? [];

    const datesToEmit: Date[] = [];
    for (
      const d = new Date(start);
      d <= end;
      d.setDate(d.getDate() + 1)
    ) {
      const dayName = DAY_NAMES[d.getDay()];
      if (daysOfWeek.includes(dayName)) {
        datesToEmit.push(new Date(d));
      }
    }

    const [hStart, hEnd] = timeRange(entry.session_part);

    for (const d of datesToEmit) {
      const dateStr = formatLocalDate(d);
      const uid = `kidtinerary-entry-${entry.id}-${dateStr}@kidtinerary.app`;

      const vevent = [
        "BEGIN:VEVENT",
        foldLine(`UID:${uid}`),
        foldLine(`SUMMARY:${escapeIcs(summary)}`),
        `STATUS:${icsStatus}`,
        description ? foldLine(`DESCRIPTION:${escapeIcs(description)}`) : "",
        location ? foldLine(`LOCATION:${escapeIcs(location)}`) : "",
        `DTSTART:${dateStr}T${hStart}`,
        `DTEND:${dateStr}T${hEnd}`,
        url ? foldLine(`URL:${url}`) : "",
        `DTSTAMP:${nowUTC()}`,
        "END:VEVENT",
      ].filter(Boolean);

      lines.push(...vevent);
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
