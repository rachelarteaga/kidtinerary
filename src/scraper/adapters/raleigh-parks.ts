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
