import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Help me find — LLM-backed activity suggestions.
 *
 * Uses Vercel AI Gateway via the default `provider/model` string syntax.
 * Set `AI_GATEWAY_API_KEY` in env (or rely on OIDC for Vercel deployments).
 *
 * v1: structured output, no provider-executed web search. The model returns
 * results based on its training data; URLs may be stale or hallucinated. The
 * UI footer caveat ("These come from the web — double-check dates and
 * registration before signing up.") sets the right expectations. A follow-up
 * can wire OpenAI's webSearch tool or Anthropic's web search if URL accuracy
 * becomes a real problem.
 */

// Function-scoped, lazy: instantiated per-request inside POST so cold-start
// type-checks don't fail if env isn't yet present in dev.
const ResultSchema = z.object({
  name: z.string().min(1),
  url: z.string().url().nullable(),
  organizationName: z.string().nullable(),
  description: z.string().nullable(),
  categories: z.array(z.string()),
  ageMin: z.number().int().nullable(),
  ageMax: z.number().int().nullable(),
  registrationEndDate: z.string().nullable(), // YYYY-MM-DD or null
  neighborhood: z.string().nullable(),
  distanceMiles: z.number().nullable(),
});

const ResponseSchema = z.object({
  results: z.array(ResultSchema).min(0).max(8),
});

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
      experimental_output: Output.object({ schema: ResponseSchema }),
      temperature: 0.4,
    });

    return NextResponse.json(experimental_output);
  } catch (err) {
    console.error("help-me-find error:", err);
    const message = err instanceof Error ? err.message : "Could not load suggestions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildSystemPrompt(context: ContextPayload | null): string {
  const lines: string[] = [
    "You help busy parents find kids' activities (camps, classes, lessons, sports).",
    "Given a description of what they're looking for, return 3 to 5 specific real-world activities you're CONFIDENT exist and are currently active.",
    "Return ONLY structured JSON matching the requested schema — no prose.",
    "",
    "For each result:",
    "- name: the specific program/camp name (e.g. 'Summer Outdoor Art Week'), not the parent organization",
    "- url: a direct registration URL if you're confident it works; otherwise null",
    "- organizationName: the running org's name, when different from the program name",
    "- description: one or two short sentences",
    "- categories: zero or more of: sports, arts, stem, music, theater, academic, special_needs, religious, swimming, cooking, language, nature",
    "- ageMin / ageMax: integer years; null when not known",
    "- registrationEndDate: YYYY-MM-DD if known; null otherwise",
    "- neighborhood: short location label (e.g. 'Park Slope'); null when not relevant",
    "- distanceMiles: rough distance from the user's location, when computable; null otherwise",
    "",
    "BE CONSERVATIVE. If you can't confidently return 3 results, return fewer. Never fabricate URLs. Prefer well-known, established programs over speculative ones.",
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
