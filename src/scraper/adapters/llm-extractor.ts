import Anthropic from "@anthropic-ai/sdk";
import type { AdapterResult, ScrapedActivity } from "@/scraper/types";

// Extend ScrapedActivity to carry the LLM confidence tag
export interface LLMScrapedActivity extends ScrapedActivity {
  _confidence: "llm_extracted";
}

// ---------------------------------------------------------------------------
// Discovery mode: extract a list of activities from aggregator pages
// ---------------------------------------------------------------------------

export function buildDiscoveryPrompt(sourceUrl: string, content: string): string {
  return `You are a data extraction assistant for KidPlan, a children's activity discovery platform.

This page is from an AGGREGATOR site that lists many different camps, classes, and activities.

Your job is to extract a list of activities/organizations found on this page.
Source URL: ${sourceUrl}

Return ONLY a valid JSON object with this exact structure — no markdown, no code fences, no explanation:

{
  "activities": [
    {
      "name": "string — camp or activity name",
      "organizationName": "string — organization or provider running this activity",
      "organizationWebsite": "string URL — the ACTUAL organization's own website (not this aggregator), or null if not listed",
      "address": "string — full street address including city, state, zip, or null if unknown",
      "categories": ["sports", "arts", "stem", "nature", "music", "theater", "academic", "swimming", "cooking", "language"],
      "description": "string — brief 1-2 sentence description, or null"
    }
  ]
}

Rules:
- Include every distinct camp/class/activity/organization you find on the page.
- The organizationWebsite field is CRITICAL — always look for the organization's own website URL (not a link back to this aggregator). This is how we'll find accurate pricing and schedules.
- Do NOT extract pricing, session dates, or detailed schedules — those come from the actual organization website.
- For categories: pick from the allowed list only. Use an empty array if none fit.
- If the page has no recognizable camp/class listings, return { "activities": [] }.

Page content:
---
${content.slice(0, 80_000)}
---`;
}

// ---------------------------------------------------------------------------
// Detail mode: extract full data from a single organization's website
// ---------------------------------------------------------------------------

export function buildDetailPrompt(sourceUrl: string, content: string): string {
  return `You are a data extraction assistant for KidPlan, a children's activity discovery platform.

This page is from the ACTUAL WEBSITE of a camp or activity provider. Extract complete, accurate details.
Source URL: ${sourceUrl}

Return ONLY a valid JSON object with this exact structure — no markdown, no code fences, no explanation:

{
  "activities": [
    {
      "name": "string — camp or program name",
      "description": "string or null — full description of this program",
      "organizationName": "string — organization running this activity",
      "organizationWebsite": "${sourceUrl}",
      "registrationUrl": "string URL — direct link to register for this specific camp, or null",
      "sourceUrl": "${sourceUrl}",
      "address": "string — full street address including city, state, zip",
      "locationName": "string or null — e.g. 'North Raleigh Campus'",
      "indoorOutdoor": "indoor | outdoor | both",
      "ageText": "string or null — raw age text, e.g. 'Ages 6-12' or 'Grades 2-5'",
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
          "label": "string — e.g. 'Full Day', 'Half Day', 'Early Bird', 'Sibling Discount'",
          "priceString": "$250",
          "priceUnit": "per_week | per_day | per_session | per_block",
          "conditions": "string or null — e.g. 'Register before May 1', 'Second child'"
        }
      ]
    }
  ]
}

Rules:
- Extract ALL camps, programs, and sessions you find on the page.
- Pricing is critical — extract ALL pricing tiers: full day, half day, early bird, sibling discounts, age-group pricing. Do not skip any price.
- For sessions: use YYYY-MM-DD format. If only a year is given, use June 1–August 31 of that year as a placeholder and set isSoldOut to false.
- For prices: preserve the raw price string exactly (e.g. "$250", "250.00"). Do not convert.
- For registrationUrl: look for a direct registration/sign-up link for each specific program.
- If a field is genuinely unknown, use null. Do not guess prices.
- If the page has no recognizable camp/class listings, return { "activities": [] }.

Page content:
---
${content.slice(0, 80_000)}
---`;
}

// ---------------------------------------------------------------------------
// Legacy prompt (kept for backward compatibility)
// ---------------------------------------------------------------------------

export function buildExtractionPrompt(sourceUrl: string, content: string): string {
  return buildDetailPrompt(sourceUrl, content);
}

// ---------------------------------------------------------------------------
// Discovered activity (from aggregator discovery pass)
// ---------------------------------------------------------------------------

export interface DiscoveredActivity {
  name: string;
  organizationName: string;
  organizationWebsite: string | null;
  address: string | null;
  categories: string[];
  description: string | null;
}

export interface DiscoveryResult {
  activities: DiscoveredActivity[];
  sourceUrl: string;
  scrapedAt: string;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Core extraction function
// ---------------------------------------------------------------------------

async function callLLM(prompt: string): Promise<{ text: string; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { text: "", error: "ANTHROPIC_API_KEY not set" };
  }

  const client = new Anthropic({ apiKey });
  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { text: "", error: "LLM returned no text content" };
    }
    return { text: textBlock.text };
  } catch (err) {
    return { text: "", error: `Claude API error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

function parseJsonResponse<T>(rawText: string): { data: T | null; error?: string } {
  try {
    let cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace !== -1 && lastBrace < cleaned.length - 1) {
      cleaned = cleaned.slice(0, lastBrace + 1);
    }
    return { data: JSON.parse(cleaned) as T };
  } catch (err) {
    return { data: null, error: `Failed to parse LLM response as JSON: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ---------------------------------------------------------------------------
// Discovery pass: aggregator → list of activities with website URLs
// ---------------------------------------------------------------------------

export async function discoverActivities(
  sourceUrl: string,
  htmlContent: string
): Promise<DiscoveryResult> {
  const scrapedAt = new Date().toISOString();
  const errors: string[] = [];
  const activities: DiscoveredActivity[] = [];

  const prompt = buildDiscoveryPrompt(sourceUrl, htmlContent);
  const { text, error } = await callLLM(prompt);
  if (error) {
    errors.push(error);
    return { activities, sourceUrl, scrapedAt, errors };
  }

  const { data: parsed, error: parseError } = parseJsonResponse<{ activities: DiscoveredActivity[] }>(text);
  if (parseError || !parsed) {
    errors.push(parseError ?? "Empty parse result");
    return { activities, sourceUrl, scrapedAt, errors };
  }

  if (!Array.isArray(parsed?.activities)) {
    errors.push("LLM response missing 'activities' array");
    return { activities, sourceUrl, scrapedAt, errors };
  }

  for (const raw of parsed.activities) {
    activities.push({
      name: raw.name ?? "",
      organizationName: raw.organizationName ?? "",
      organizationWebsite: raw.organizationWebsite ?? null,
      address: raw.address ?? null,
      categories: Array.isArray(raw.categories) ? raw.categories : [],
      description: raw.description ?? null,
    });
  }

  return { activities, sourceUrl, scrapedAt, errors };
}

// ---------------------------------------------------------------------------
// Detail pass: single org website → full structured activity data
// ---------------------------------------------------------------------------

export async function extractWithLLM(
  sourceUrl: string,
  htmlContent: string
): Promise<AdapterResult & { activities: LLMScrapedActivity[] }> {
  const scrapedAt = new Date().toISOString();
  const errors: string[] = [];
  const activities: LLMScrapedActivity[] = [];

  const prompt = buildDetailPrompt(sourceUrl, htmlContent);
  const { text, error } = await callLLM(prompt);
  if (error) {
    errors.push(error);
    return { activities, sourceUrl, scrapedAt, errors };
  }

  const { data: parsed, error: parseError } = parseJsonResponse<{ activities: ScrapedActivity[] }>(text);
  if (parseError || !parsed) {
    errors.push(parseError ?? "Empty parse result");
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
// Adapter that fetches and then calls extractWithLLM (detail mode)
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

// ---------------------------------------------------------------------------
// Adapter that fetches and then calls discoverActivities (discovery mode)
// ---------------------------------------------------------------------------

export function createDiscoveryAdapter(sourceUrl: string) {
  return {
    name: `discovery:${sourceUrl}`,
    sourceUrl,
    async fetch(): Promise<DiscoveryResult> {
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

      return discoverActivities(sourceUrl, html);
    },
  };
}
