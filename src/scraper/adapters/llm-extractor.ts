import Anthropic from "@anthropic-ai/sdk";
import type { AdapterResult, ScrapedActivity } from "@/scraper/types";

// Extend ScrapedActivity to carry the LLM confidence tag
export interface LLMScrapedActivity extends ScrapedActivity {
  _confidence: "llm_extracted";
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export function buildExtractionPrompt(sourceUrl: string, content: string): string {
  return `You are a data extraction assistant for KidPlan, a children's activity discovery platform.

Extract ALL camp, class, or activity listings from the following web page content.
Source URL: ${sourceUrl}

Return ONLY a valid JSON object with this exact structure — no markdown, no code fences, no explanation:

{
  "activities": [
    {
      "name": "string — activity name",
      "description": "string or null",
      "organizationName": "string — organization running this activity",
      "organizationWebsite": "string URL or null",
      "registrationUrl": "string URL or null",
      "sourceUrl": "${sourceUrl}",
      "address": "string — full street address including city, state, zip",
      "locationName": "string or null — e.g. 'North Raleigh Campus'",
      "indoorOutdoor": "indoor | outdoor | both",
      "ageText": "string or null — raw age text, e.g. 'Ages 6-12'",
      "sessions": [
        {
          "startsAt": "YYYY-MM-DD",
          "endsAt": "YYYY-MM-DD",
          "timeSlot": "full_day | am_half | pm_half",
          "hoursStart": "HH:MM or null",
          "hoursEnd": "HH:MM or null",
          "isSoldOut": false,
          "spotsAvailable": null
        }
      ],
      "prices": [
        {
          "label": "Standard",
          "priceString": "$250",
          "priceUnit": "per_week | per_day | per_session | per_block",
          "conditions": "string or null"
        }
      ]
    }
  ]
}

Rules:
- Include every distinct camp/class/activity you find on the page.
- If a field is genuinely unknown, use null. Do not guess prices.
- For sessions: use YYYY-MM-DD format. If only a year is given, use June 1–August 31 of that year as a placeholder and set isSoldOut to false.
- For prices: preserve the raw price string exactly (e.g. "$250", "250.00"). Do not convert.
- If the page has no recognizable camp/class listings, return { "activities": [] }.

Page content:
---
${content.slice(0, 80_000)}
---`;
}

// ---------------------------------------------------------------------------
// Extractor
// ---------------------------------------------------------------------------

/**
 * Generic LLM-assisted extractor for Tier 3 sources.
 * Fetches the page, sends to Claude, parses structured output.
 */
export async function extractWithLLM(
  sourceUrl: string,
  htmlContent: string
): Promise<AdapterResult & { activities: LLMScrapedActivity[] }> {
  const scrapedAt = new Date().toISOString();
  const errors: string[] = [];
  const activities: LLMScrapedActivity[] = [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    errors.push("ANTHROPIC_API_KEY not set");
    return { activities, sourceUrl, scrapedAt, errors };
  }

  const client = new Anthropic({ apiKey });
  const prompt = buildExtractionPrompt(sourceUrl, htmlContent);

  let rawText: string;
  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      errors.push("LLM returned no text content");
      return { activities, sourceUrl, scrapedAt, errors };
    }
    rawText = textBlock.text;
  } catch (err) {
    errors.push(`Claude API error: ${err instanceof Error ? err.message : String(err)}`);
    return { activities, sourceUrl, scrapedAt, errors };
  }

  let parsed: { activities: ScrapedActivity[] };
  try {
    // Strip markdown code fences if model wrapped output anyway
    let cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    // If the LLM appended trailing text after the JSON object, truncate at the last closing brace
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace !== -1 && lastBrace < cleaned.length - 1) {
      cleaned = cleaned.slice(0, lastBrace + 1);
    }
    parsed = JSON.parse(cleaned);
  } catch (err) {
    errors.push(`Failed to parse LLM response as JSON: ${err instanceof Error ? err.message : String(err)}`);
    return { activities, sourceUrl, scrapedAt, errors };
  }

  if (!Array.isArray(parsed?.activities)) {
    errors.push("LLM response missing 'activities' array");
    return { activities, sourceUrl, scrapedAt, errors };
  }

  for (const raw of parsed.activities) {
    activities.push({ ...raw, _confidence: "llm_extracted" });
  }

  return { activities, sourceUrl, scrapedAt, errors };
}

// ---------------------------------------------------------------------------
// Adapter that fetches and then calls extractWithLLM
// ---------------------------------------------------------------------------

export function createLLMAdapter(sourceUrl: string) {
  return {
    name: `llm:${sourceUrl}`,
    sourceUrl,
    async fetch(): Promise<AdapterResult> {
      const errors: string[] = [];
      const scrapedAt = new Date().toISOString();

      let html: string;
      try {
        const res = await globalThis.fetch(sourceUrl, {
          headers: { "User-Agent": "KidPlan-Scraper/1.0 (+https://kidplan.app)" },
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) {
          errors.push(`HTTP ${res.status} fetching ${sourceUrl}`);
          return { activities: [], sourceUrl, scrapedAt, errors };
        }
        html = await res.text();
      } catch (err) {
        errors.push(`Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
        return { activities: [], sourceUrl, scrapedAt, errors };
      }

      return extractWithLLM(sourceUrl, html);
    },
  };
}
