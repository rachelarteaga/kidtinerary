import { NextResponse } from "next/server";
import { generateText, Output, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Help me find — LLM-backed activity suggestions, grounded by real-time
 * web search.
 *
 * Uses Vercel AI Gateway routing (`anthropic/claude-sonnet-4.6` provider
 * string) plus Anthropic's provider-executed web_search_20250305 tool so
 * the model can verify URLs and program details against the live web
 * before returning structured results. Web search billing is metered
 * separately by the gateway ($10 / 1000 searches at time of writing);
 * with maxUses=3 per call and the 50/day per-user cap, the worst-case
 * search cost per user is ~$1.50/day on top of LLM tokens.
 *
 * Required env: AI_GATEWAY_API_KEY (or rely on OIDC for Vercel deployments).
 * Web search must also be enabled for the underlying Anthropic console.
 */

// Anthropic's structured-output mode does NOT accept array length
// constraints (minItems / maxItems) or string format constraints (url,
// minLength, etc.) on the schema it serializes for the model. Stripping
// those down to plain shape — we instead enforce conservative bounds
// in the system prompt ("3 to 5 results") and trim the array post-call
// in case the model returns more.
const ResultSchema = z.object({
  name: z.string(),
  url: z.string().nullable(),
  organizationName: z.string().nullable(),
  description: z.string().nullable(),
  categories: z.array(z.string()),
  ageMin: z.number().nullable(),
  ageMax: z.number().nullable(),
  registrationEndDate: z.string().nullable(), // YYYY-MM-DD or null
  address: z.string().nullable(),
  distanceMiles: z.number().nullable(),
});

const ResponseSchema = z.object({
  results: z.array(ResultSchema),
});

const HARD_RESULT_CAP = 8;

interface ContextPayload {
  kids: Array<{
    name: string;
    ageYears: number | null;
    interests: string[] | null;
  }> | null;
  address: string | null;
}

interface RequestBody {
  prompt: string;
  context: ContextPayload | null;
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  // Auth — only signed-in users can hit this. Cheapest hard gate.
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const prompt = (body.prompt ?? "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "Prompt required" }, { status: 400 });
  }

  // Daily cap (default 50/day). Increment-then-check is atomic via the RPC's
  // SELECT FOR UPDATE; -1 returned means the user is already at or over the
  // cap and the increment was NOT applied.
  const DAILY_CAP = 50;
  const { data: countAfter, error: rpcErr } = await supabase.rpc(
    "increment_help_me_find_usage",
    { p_user_id: user.id, p_cap: DAILY_CAP },
  );
  if (rpcErr) {
    console.error("help-me-find rate-limit RPC error:", rpcErr);
    return NextResponse.json({ error: "Could not check usage" }, { status: 500 });
  }
  if (countAfter === -1) {
    return NextResponse.json(
      {
        error: `You've hit today's limit of ${DAILY_CAP} searches. Try again tomorrow.`,
        rateLimited: true,
      },
      { status: 429 },
    );
  }

  const systemPrompt = buildSystemPrompt(body.context);

  try {
    const { experimental_output } = await generateText({
      model: "anthropic/claude-sonnet-4.6",
      system: systemPrompt,
      prompt,
      tools: {
        web_search: anthropic.tools.webSearch_20250305({
          maxUses: 3,
        }),
      },
      // Web search adds steps (search call → search result → final synthesis).
      // Cap total steps so a misbehaving model can't loop indefinitely.
      stopWhen: stepCountIs(8),
      experimental_output: Output.object({ schema: ResponseSchema }),
      temperature: 0.4,
    });

    // Defensive trim — the schema can't enforce a max so a misbehaving
    // model could in theory return more. The system prompt asks for 3–5;
    // an 8-item hard cap covers the long tail without surprising the user.
    const trimmed = {
      ...experimental_output,
      results: (experimental_output?.results ?? []).slice(0, HARD_RESULT_CAP),
    };
    return NextResponse.json(trimmed);
  } catch (err) {
    console.error("help-me-find error:", err);
    const message = err instanceof Error ? err.message : "Could not load suggestions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildSystemPrompt(context: ContextPayload | null): string {
  const lines: string[] = [
    "You help busy parents find kids' activities (camps, classes, lessons, sports).",
    "",
    "Given a description of what they're looking for, USE THE web_search TOOL to find 4 to 6 specific real-world activities currently being offered. Verify URLs and program details against the live web before returning them — do NOT rely on training data alone.",
    "",
    "Search strategy:",
    "- Start with one targeted query that combines the parent's description with their location (e.g., 'art camps Park Slope Brooklyn summer 2026').",
    "- If the first search isn't enough, do up to 2 more focused searches (different keywords or specific neighborhoods).",
    "- For each candidate program, use a fresh search if you need to verify the registration page or current dates.",
    "",
    "Return ONLY structured JSON matching the requested schema — no prose.",
    "",
    "For each result:",
    "- name: the specific program/camp name (e.g. 'Summer Outdoor Art Week'), not the parent organization",
    "- url: a direct registration URL you have VERIFIED via search results; null if you couldn't find a current one",
    "- organizationName: the running org's name, when different from the program name",
    "- description: one or two short sentences",
    "- categories: zero or more of: sports, arts, stem, music, theater, academic, special_needs, religious, swimming, cooking, language, nature",
    "- ageMin / ageMax: integer years; null when not known",
    "- registrationEndDate: YYYY-MM-DD if a search result confirms it; null otherwise",
    "- address: location of the program — prefer a verified street address (e.g. '123 5th Ave, Brooklyn NY 11215'); when only a neighborhood or area is verifiable, return that label (e.g. 'Park Slope, Brooklyn'); null when unknown — never guess a street address",
    "- distanceMiles: rough distance from the user's location, when computable; null otherwise",
    "",
    "BE CONSERVATIVE. If your searches don't surface 4 confident matches, return fewer. Never fabricate URLs or addresses — return null instead.",
  ];

  if (context?.address) {
    lines.push("", `The user's location: ${context.address}.`);
  }
  if (context?.kids?.length) {
    lines.push("", "The user's kids:");
    for (const kid of context.kids) {
      const age = kid.ageYears != null ? `, age ${kid.ageYears}` : "";
      const interests = kid.interests?.length ? `, interests: ${kid.interests.join(", ")}` : "";
      lines.push(`- ${kid.name}${age}${interests}`);
    }
  }

  return lines.join("\n");
}
