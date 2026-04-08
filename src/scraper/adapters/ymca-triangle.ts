import * as cheerio from "cheerio";
import type { Adapter, AdapterResult, ScrapedActivity, ScrapedSession } from "@/scraper/types";

const SOURCE_URL = "https://ymcatriangle.org/camps";

export const YMCATriangleAdapter: Adapter = {
  name: "ymca-triangle",
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

    // YMCA Triangle uses Bootstrap cards — try multiple selectors for resilience
    const cardSel = ".card, .camp-card, .program-card, article[class*='camp'], .views-row";
    $(cardSel).each((_, el) => {
      try {
        const name =
          $(el).find(".card-title, h2, h3, h4").first().text().trim();
        if (!name) return;

        const description =
          $(el).find(".card-text, .description, p").first().text().trim() || undefined;

        const registrationUrl =
          $(el).find("a[href*='register'], a[href*='join'], .btn-primary").attr("href") ||
          $(el).find("a").attr("href") ||
          undefined;

        const detailUrl = $(el).find("a[href*='/camp'], a.card-link").attr("href");
        const fullDetailUrl = detailUrl
          ? new URL(detailUrl, SOURCE_URL).href
          : undefined;

        const ageText =
          $(el).find("[class*='age'], .ages, .grade").text().trim() || undefined;

        const dateText =
          $(el).find("[class*='date'], .dates, .session-dates").text().trim() || "";

        const priceText =
          $(el).find("[class*='price'], .cost, .fee").text().trim() || "";

        const locationText =
          $(el).find("[class*='location'], .branch, .facility").text().trim() ||
          "Triangle Area, NC";

        const session = parseDateText(dateText);

        const activity: ScrapedActivity = {
          name,
          description,
          organizationName: "YMCA of the Triangle",
          organizationWebsite: "https://ymcatriangle.org",
          registrationUrl: registrationUrl
            ? new URL(registrationUrl, SOURCE_URL).href
            : fullDetailUrl ?? SOURCE_URL,
          sourceUrl: fullDetailUrl ?? SOURCE_URL,
          address: locationText.includes(",")
            ? locationText
            : `${locationText}, Raleigh, NC`,
          indoorOutdoor: guessIndoorOutdoor(name, description ?? ""),
          ageText: ageText || undefined,
          sessions: session ? [session] : [],
          prices: priceText
            ? [
                { label: "Member", priceString: priceText, priceUnit: "per_week" },
              ]
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

function parseDateText(text: string): ScrapedSession | null {
  if (!text) return null;
  // Try "Month D - Month D, YYYY" or "Month D-D, YYYY"
  const withYear = text.match(/(\w+ \d+)\s*[-–]\s*(\w+ \d+),?\s*(\d{4})/);
  if (withYear) {
    const starts = safeDate(`${withYear[1]} ${withYear[3]}`);
    const ends   = safeDate(`${withYear[2]} ${withYear[3]}`);
    if (starts && ends) {
      return { startsAt: starts, endsAt: ends, timeSlot: "full_day", isSoldOut: false };
    }
  }
  const sameMonth = text.match(/(\w+)\s+(\d+)\s*[-–]\s*(\d+),?\s*(\d{4})/);
  if (sameMonth) {
    const [, month, d1, d2, year] = sameMonth;
    const starts = safeDate(`${month} ${d1} ${year}`);
    const ends   = safeDate(`${month} ${d2} ${year}`);
    if (starts && ends) {
      return { startsAt: starts, endsAt: ends, timeSlot: "full_day", isSoldOut: false };
    }
  }
  return null;
}

function safeDate(text: string): string | null {
  const d = new Date(text);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function guessIndoorOutdoor(name: string, desc: string): "indoor" | "outdoor" | "both" {
  const text = `${name} ${desc}`.toLowerCase();
  const outdoorKeywords = ["outdoor", "nature", "hiking", "field", "park", "garden", "forest", "swim", "pool"];
  const indoorKeywords  = ["indoor", "studio", "classroom", "gym", "aquatic"];
  const isOutdoor = outdoorKeywords.some((kw) => text.includes(kw));
  const isIndoor  = indoorKeywords.some((kw) => text.includes(kw));
  if (isOutdoor && isIndoor) return "both";
  if (isOutdoor) return "outdoor";
  if (isIndoor)  return "indoor";
  return "both";
}
