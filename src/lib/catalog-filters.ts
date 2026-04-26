/**
 * Catalog filter URL state + small derivation helpers shared by the
 * /catalog page chrome and the row list. Filter state is serialized into
 * URL search params so that a filtered view is shareable and survives
 * refresh.
 */

export interface FilterState {
  /** Multi-select: kid ids the user has filtered to. Empty = all kids. */
  kidIds?: string[];
  /** Single-select: 'me' (self+llm), 'friends' (friend), undefined = all. */
  source?: "me" | "friends";
  /** Multi-select: type buckets. */
  types?: Array<"camp" | "class" | "lesson" | "sport">;
  /** Multi-select: season buckets. */
  seasons?: Array<"this-summer" | "this-school-year" | "past" | "unknown">;
  /** Multi-select: category enum values from constants. */
  categories?: string[];
}

/** Serialize a FilterState into URL search params. Empty fields are omitted. */
export function serializeFilterState(state: FilterState): URLSearchParams {
  const p = new URLSearchParams();
  if (state.kidIds?.length) p.set("kids", state.kidIds.join(","));
  if (state.source) p.set("source", state.source);
  if (state.types?.length) p.set("type", state.types.join(","));
  if (state.seasons?.length) p.set("season", state.seasons.join(","));
  if (state.categories?.length) p.set("category", state.categories.join(","));
  return p;
}

/** Parse URL search params back into a FilterState. Unknown values are dropped. */
export function parseFilterState(params: URLSearchParams): FilterState {
  const out: FilterState = {};
  const kids = params.get("kids");
  if (kids) out.kidIds = kids.split(",").filter(Boolean);

  const source = params.get("source");
  if (source === "me" || source === "friends") out.source = source;

  const t = params.get("type");
  if (t) {
    const valid: FilterState["types"] = t
      .split(",")
      .filter((x): x is "camp" | "class" | "lesson" | "sport" =>
        x === "camp" || x === "class" || x === "lesson" || x === "sport",
      );
    if (valid && valid.length > 0) out.types = valid;
  }

  const s = params.get("season");
  if (s) {
    const valid: FilterState["seasons"] = s
      .split(",")
      .filter((x): x is "this-summer" | "this-school-year" | "past" | "unknown" =>
        x === "this-summer" || x === "this-school-year" || x === "past" || x === "unknown",
      );
    if (valid && valid.length > 0) out.seasons = valid;
  }

  const c = params.get("category");
  if (c) out.categories = c.split(",").filter(Boolean);

  return out;
}

/**
 * Maps the row's user_activities.source enum onto the filter's
 * binary "Added by me" / "From friends" split.
 *   * 'me'      → row.source IN ('self', 'llm')
 *   * 'friends' → row.source = 'friend'
 *   * undefined → matches anything
 */
export function matchesSourceFilter(
  rowSource: "self" | "friend" | "llm",
  filter: "me" | "friends" | undefined,
): boolean {
  if (!filter) return true;
  if (filter === "me") return rowSource === "self" || rowSource === "llm";
  return rowSource === "friend";
}

/**
 * Bucket a date into one of the season filter values. "today" is
 * injectable so the bucketing is deterministic in tests.
 *   * past   — date is before today
 *   * this-summer       — date is in this calendar year, Jun–Aug
 *   * this-school-year  — date is in the future and not in this summer
 *   * unknown — date is null
 */
export function bucketSeason(
  startDate: string | null,
  today: Date = new Date(),
): "this-summer" | "this-school-year" | "past" | "unknown" {
  if (!startDate) return "unknown";
  const d = new Date(startDate + "T00:00:00Z");
  // Compare in UTC by stripping today's hours.
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (d < todayUtc) return "past";
  const month = d.getUTCMonth(); // 0 = Jan
  if (month >= 5 && month <= 7) return "this-summer"; // Jun, Jul, Aug
  return "this-school-year";
}
