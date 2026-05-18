/**
 * Normalization pipeline that feeds the canonical fingerprint. Two parents
 * submitting the same real-world activity with slightly different wording
 * should produce the same normalized string here, so their rows end up in
 * the same canonical group.
 *
 * Aggressive on purpose: better to over-strip and risk a false positive
 * (which the per-viewer unmatch escape hatch handles) than to under-strip
 * and miss legitimate matches. The org + region prefix in the fingerprint
 * already provides specificity, so stripping generic tokens like "camp"
 * or "summer" rarely produces collisions across different real activities.
 */

// US-only abbreviation expansion. Applied as whole-word replacements after
// lowercasing. Keys MUST be all-lowercase, single tokens (no punctuation).
const ABBREVIATIONS: Record<string, string> = {
  rec: "recreation",
  ctr: "center",
  cntr: "center",
  comm: "community",
  assoc: "association",
  assn: "association",
  intl: "international",
  natl: "national",
  amer: "american",
  ave: "avenue",
  blvd: "boulevard",
  pkwy: "parkway",
  rd: "road",
  // NB: "st" intentionally NOT mapped — "Saint" vs "Street" is ambiguous.
};

// Tokens that carry no identity signal and only add noise to the fingerprint.
// Stripped from BOTH org and program names. The set is deliberately broad —
// the region + org prefix carry the specificity. Anything in here would
// dilute the match rather than improve it.
const GENERIC_TOKENS = new Set<string>([
  // Common nouns that show up in 80% of submissions
  "camp",
  "camps",
  "program",
  "programs",
  "activity",
  "activities",
  "class",
  "classes",
  "course",
  "courses",
  "session",
  "sessions",
  "lesson",
  "lessons",
  "day",
  "daycamp",
  "summer",
  "fall",
  "winter",
  "spring",
  "week",
  "weekly",
  "evening",
  "morning",
  "afternoon",
  // Stopwords
  "and",
  "the",
  "of",
  "at",
  "for",
  "in",
  "on",
  "with",
  "a",
  "an",
  // Connectors
  "to",
]);

// Strip 4-digit years (1900-2099) anywhere in the string.
const YEAR_REGEX = /\b(?:19|20)\d{2}\b/g;

// Strip patterns like "session 1", "week 2", "ages 5-7", "5-7", standalone digits.
const NUMERIC_PATTERN_REGEX = /\b(?:ages?\s*)?\d+(?:[-–]\d+)?\b/g;

/**
 * Strip apostrophes (so "kid's" becomes "kids") then replace remaining
 * punctuation with spaces, lowercase, collapse whitespace. Applied before
 * tokenization.
 */
function basicClean(input: string): string {
  return input
    .toLowerCase()
    .replace(/['‘’]/g, "") // straight + curly apostrophes
    .replace(/[^a-z0-9\s]/g, " ") // everything else → space
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tokenize, expand abbreviations, drop generic tokens, sort. Returns a
 * deterministic string regardless of input token order.
 */
function tokenizeAndCanonicalize(cleaned: string): string {
  const tokens = cleaned
    .split(" ")
    .map((t) => ABBREVIATIONS[t] ?? t)
    .filter((t) => t.length > 0 && !GENERIC_TOKENS.has(t));

  // Sort so input order doesn't affect the result — "YMCA Westport" and
  // "Westport YMCA" produce the same canonical key.
  tokens.sort();

  return tokens.join(" ");
}

/**
 * Normalize an organization name. Same pipeline as program names but kept
 * separate so we can tune them independently if the corpus shows different
 * miss patterns.
 */
export function normalizeOrgName(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  const cleaned = basicClean(raw);
  return tokenizeAndCanonicalize(cleaned);
}

/**
 * Normalize a program/activity name. Strips years and numeric patterns
 * (session numbers, age ranges) before tokenizing, because those vary
 * across sessions of the same program and shouldn't fragment the identity.
 */
export function normalizeProgramName(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  const stripped = raw
    .toLowerCase()
    .replace(YEAR_REGEX, " ")
    .replace(NUMERIC_PATTERN_REGEX, " ");
  const cleaned = basicClean(stripped);
  return tokenizeAndCanonicalize(cleaned);
}

/**
 * Normalize a region to the lowercased "{city}, {state}" form used in
 * org-level fingerprints. Pass `{ online: true }` to get the special
 * "online" sentinel that bypasses geographic matching.
 */
export function normalizeRegion(input:
  | { online: true }
  | { city: string; state: string }
): string {
  if ("online" in input && input.online) return "online";
  const city = (input as { city: string }).city?.trim().toLowerCase() ?? "";
  const state = (input as { state: string }).state?.trim().toUpperCase() ?? "";
  if (!city || !state) return "";
  // State is already validated upstream to be a 2-char USPS code; keep
  // uppercased on output for readability while the city stays lowercased.
  return `${city}, ${state}`;
}
