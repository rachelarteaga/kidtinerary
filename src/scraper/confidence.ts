import type { ScrapeConfidence } from "@/lib/supabase/types";

export interface Candidate {
  name: string;
  score: number; // 0..1
  fields: Partial<{
    name: boolean;
    dates: boolean;
    price: boolean;
    location: boolean;
    ages: boolean;
  }>;
}

export interface ConfidenceInput {
  candidates: Candidate[];
}

const KEY_FIELDS: Array<keyof Candidate["fields"]> = ["name", "dates", "price", "location", "ages"];
const CONFIDENT_SCORE = 0.6;
const AMBIGUOUS_SCORE_GAP = 0.1;

export function scoreConfidence(input: ConfidenceInput): ScrapeConfidence {
  const strong = input.candidates.filter((c) => c.score >= CONFIDENT_SCORE);

  if (strong.length === 0) return "none";

  if (strong.length > 1) {
    const top = strong[0].score;
    const second = strong[1].score;
    if (top - second < AMBIGUOUS_SCORE_GAP) return "ambiguous";
  }

  const top = strong[0];
  const missingCount = KEY_FIELDS.filter((f) => !top.fields[f]).length;
  if (missingCount >= 2) return "partial";

  return "high";
}
