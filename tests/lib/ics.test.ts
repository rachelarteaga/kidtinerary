import { describe, it, expect } from "vitest";
import { generateICS } from "@/lib/ics";

function fakeEntry(status: "considering" | "waitlisted" | "registered") {
  return {
    id: "e1",
    user_id: "u1",
    child_id: "c1",
    session_id: "s1",
    status,
    sort_order: 0,
    notes: null,
    created_at: "2026-04-20",
    session: {
      id: "s1",
      starts_at: "2026-06-22",
      ends_at: "2026-06-26",
      time_slot: "full_day",
      hours_start: null,
      hours_end: null,
      is_sold_out: false,
      activity: {
        id: "a1",
        name: "Camp Kanata",
        slug: "camp-kanata",
        categories: [],
        registration_url: null,
        organization: null,
        price_options: [],
        activity_locations: [],
      },
    },
  } as any;
}

describe("generateICS", () => {
  it("skips considering entries", () => {
    const ics = generateICS([fakeEntry("considering")], "Camila");
    expect(ics).not.toContain("Camp Kanata");
  });

  it("exports registered entries as CONFIRMED", () => {
    const ics = generateICS([fakeEntry("registered")], "Camila");
    expect(ics).toContain("Camp Kanata");
    expect(ics).toContain("STATUS:CONFIRMED");
  });

  it("exports waitlisted entries as TENTATIVE", () => {
    const ics = generateICS([fakeEntry("waitlisted")], "Camila");
    expect(ics).toContain("Camp Kanata");
    expect(ics).toContain("STATUS:TENTATIVE");
  });
});
