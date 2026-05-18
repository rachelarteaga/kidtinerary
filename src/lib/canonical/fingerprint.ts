/**
 * Fingerprint computation — the join keys that group activities and
 * organizations referring to the same real-world thing.
 *
 * Two-level by design:
 *   1. Org fingerprint = hash(normalized name + region). Different YMCAs
 *      in different cities stay separate; same org across two parents'
 *      submissions in the same city collapses.
 *   2. Activity fingerprint = hash(org fingerprint + normalized program
 *      name). Multi-location programs under one canonical org collapse
 *      cleanly regardless of which branch each parent picked.
 *
 * Hash output is SHA-256 hex (64 chars). Compact, indexable, fast.
 * Inputs are stored on the row separately for debugging/admin tooling.
 */

import { createHash } from "node:crypto";
import {
  normalizeOrgName,
  normalizeProgramName,
  normalizeRegion,
} from "./normalize";

// Internal separator between fingerprint inputs. basicClean() in normalize.ts
// strips pipes (replaced with spaces), so they can never appear inside a
// normalized component. Safe delimiter — no risk of (name="ab", region="c")
// and (name="a", region="bc") collapsing to the same hash.
const SEP = "|";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export interface OrgFingerprintInput {
  name: string;
  region: { online: true } | { city: string; state: string };
}

export interface ActivityFingerprintInput {
  orgFingerprint: string;
  programName: string;
}

/**
 * Compute the canonical fingerprint for an organization.
 * Returns empty string if inputs are insufficient (caller should treat
 * as "no fingerprint" and leave the column null).
 */
export function computeOrgFingerprint(input: OrgFingerprintInput): string {
  const normalizedName = normalizeOrgName(input.name);
  const region = normalizeRegion(input.region);
  if (!normalizedName || !region) return "";
  return sha256Hex(`org${SEP}${normalizedName}${SEP}${region}`);
}

/**
 * Compute the canonical fingerprint for an activity. The org fingerprint
 * carries the region + provider identity; we just layer the normalized
 * program name on top.
 */
export function computeActivityFingerprint(
  input: ActivityFingerprintInput,
): string {
  if (!input.orgFingerprint) return "";
  const normalizedProgram = normalizeProgramName(input.programName);
  if (!normalizedProgram) return "";
  return sha256Hex(
    `activity${SEP}${input.orgFingerprint}${SEP}${normalizedProgram}`,
  );
}

/**
 * Build the human-readable canonical_label for an org. Stored alongside
 * the hash so admin tools can read what the fingerprint actually represents
 * without having to recompute from raw inputs. Not user-facing.
 */
export function buildOrgCanonicalLabel(input: OrgFingerprintInput): string {
  const normalizedName = normalizeOrgName(input.name);
  const region = normalizeRegion(input.region);
  if (!normalizedName || !region) return "";
  return `${normalizedName} (${region})`;
}
