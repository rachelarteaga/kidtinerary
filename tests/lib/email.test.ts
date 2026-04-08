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
