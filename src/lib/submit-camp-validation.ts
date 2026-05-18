import { isValidUSPSStateCode } from "./canonical/us-states";

/** Region input — either an explicit (city, state) or the `online` flag.
 *  Always required for new submissions so the canonical fingerprint pipeline
 *  has the geographic component it needs. */
export type RegionInput =
  | { online: true }
  | { city: string; state: string };

export type SubmitCampRawInput = {
  orgName?: string;
  campName?: string;
  url?: string;
  /** Required from form. Either (city, state) OR { online: true }. */
  region?: RegionInput;
  /** When true, the activity becomes a permanent singleton: no dedup,
   *  no resolver index, no catalog. Default false. */
  private?: boolean;
  /** @deprecated `shared` is being removed. Submit paths pass it through
   *  for backward compatibility; new flows ignore it. */
  shared?: boolean;
  activityId?: string;
};

export type SubmitCampValidated =
  | {
      ok: true;
      value: {
        orgName?: string;
        campName?: string;
        url?: string;
        region: RegionInput;
        private: boolean;
        shared: boolean;
        activityId?: string;
      };
    }
  | { ok: false; error: string };

function validateRegion(region: RegionInput | undefined): { ok: true; value: RegionInput } | { ok: false; error: string } {
  if (!region) {
    return { ok: false, error: "Tell us where the activity is held (city and state, or mark it online)." };
  }
  if ("online" in region && region.online) {
    return { ok: true, value: { online: true } };
  }
  const city = (region as { city?: string }).city?.trim();
  const state = (region as { state?: string }).state?.trim();
  if (!city) {
    return { ok: false, error: "Add the city where the activity is held." };
  }
  if (!state || !isValidUSPSStateCode(state)) {
    return { ok: false, error: "Pick a state from the list." };
  }
  return { ok: true, value: { city, state: state.toUpperCase() } };
}

export function validateSubmitCampInput(raw: SubmitCampRawInput): SubmitCampValidated {
  const orgName = raw.orgName?.trim() || undefined;
  const campName = raw.campName?.trim() || undefined;
  const url = raw.url?.trim() || undefined;
  const activityId = raw.activityId?.trim() || undefined;
  const isPrivate = raw.private === true;
  // Default `shared` to false in the new flow. Action layer ignores it but
  // we keep it in the validated payload so downstream typing stays stable
  // until PR 8 drops the column entirely.
  const shared = raw.shared === true;

  // Picking an existing activity from autocomplete bypasses everything else —
  // the activity (and its org) already exist and have their own fingerprints.
  if (activityId) {
    return {
      ok: true,
      value: { activityId, region: { online: true }, private: isPrivate, shared },
    };
    // NB: the region on this branch is a placeholder — it isn't used because
    // the action takes the existing activity_id path and never inserts a new
    // org or activity row.
  }

  const regionResult = validateRegion(raw.region);
  if (!regionResult.ok) return regionResult;
  const region = regionResult.value;

  if (url) {
    try {
      new URL(url);
    } catch {
      return { ok: false, error: "That doesn't look like a valid URL." };
    }
    return {
      ok: true,
      value: { orgName, campName, url, region, private: isPrivate, shared },
    };
  }

  if (orgName && campName) {
    return {
      ok: true,
      value: { orgName, campName, region, private: isPrivate, shared },
    };
  }

  return {
    ok: false,
    error: "Enter an organization and activity name, or paste a URL.",
  };
}
