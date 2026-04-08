/**
 * Fuzzy deduplication utilities.
 * Spec requirement: trigram name similarity + geo proximity (within 0.5 mi) + date overlap.
 * Potential duplicates are FLAGGED — not auto-merged.
 */

// ---------------------------------------------------------------------------
// Trigram similarity
// ---------------------------------------------------------------------------

function buildTrigrams(str: string): Set<string> {
  const s = str.toLowerCase().replace(/\s+/g, " ").trim();
  const trigrams = new Set<string>();
  const padded = `  ${s}  `;
  for (let i = 0; i < padded.length - 2; i++) {
    trigrams.add(padded.slice(i, i + 3));
  }
  return trigrams;
}

export function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const ta = buildTrigrams(a);
  const tb = buildTrigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  ta.forEach((t) => { if (tb.has(t)) intersection++; });
  return (2 * intersection) / (ta.size + tb.size);
}

// ---------------------------------------------------------------------------
// Geographic proximity (Haversine)
// ---------------------------------------------------------------------------

const EARTH_RADIUS_MILES = 3_958.8;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function distanceMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const chord =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(chord));
}

export function isGeographicallyClose(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  thresholdMiles = 0.5
): boolean {
  return distanceMiles(a, b) <= thresholdMiles;
}

// ---------------------------------------------------------------------------
// Date overlap
// ---------------------------------------------------------------------------

export function hasDateOverlap(
  a: { startsAt: string; endsAt: string },
  b: { startsAt: string; endsAt: string }
): boolean {
  const aStart = new Date(a.startsAt).getTime();
  const aEnd   = new Date(a.endsAt).getTime();
  const bStart = new Date(b.startsAt).getTime();
  const bEnd   = new Date(b.endsAt).getTime();
  // Overlap when one starts before the other ends
  return aStart <= bEnd && bStart <= aEnd;
}

// ---------------------------------------------------------------------------
// Composite duplicate check
// ---------------------------------------------------------------------------

export interface DupeCandidate {
  name: string;
  lat: number;
  lng: number;
  sessions: { startsAt: string; endsAt: string }[];
}

/**
 * Returns true if `candidate` is likely a duplicate of `existing`.
 * Criteria: name similarity ≥ 0.7 AND geo ≤ 0.5 miles AND at least one session overlaps.
 */
export function isDuplicateOf(
  candidate: DupeCandidate,
  existing: DupeCandidate,
  options = { nameSimilarityThreshold: 0.7, geoThresholdMiles: 0.5 }
): boolean {
  const nameSim = trigramSimilarity(candidate.name, existing.name);
  if (nameSim < options.nameSimilarityThreshold) return false;

  const close = isGeographicallyClose(
    { lat: candidate.lat, lng: candidate.lng },
    { lat: existing.lat, lng: existing.lng },
    options.geoThresholdMiles
  );
  if (!close) return false;

  // At least one session from each must overlap
  const sessionOverlap = candidate.sessions.some((cs) =>
    existing.sessions.some((es) => hasDateOverlap(cs, es))
  );
  return sessionOverlap;
}
