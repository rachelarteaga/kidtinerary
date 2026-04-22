export type SubmitCampRawInput = {
  orgName?: string;
  campName?: string;
  url?: string;
  shared: boolean;
  activityId?: string;
};

export type SubmitCampValidated =
  | { ok: true; value: {
      orgName?: string;
      campName?: string;
      url?: string;
      shared: boolean;
      activityId?: string;
    } }
  | { ok: false; error: string };

export function validateSubmitCampInput(raw: SubmitCampRawInput): SubmitCampValidated {
  const orgName = raw.orgName?.trim() || undefined;
  const campName = raw.campName?.trim() || undefined;
  const url = raw.url?.trim() || undefined;
  const activityId = raw.activityId?.trim() || undefined;

  if (activityId) {
    return { ok: true, value: { activityId, shared: raw.shared } };
  }

  if (url) {
    try {
      new URL(url);
    } catch {
      return { ok: false, error: "That doesn't look like a valid URL." };
    }
    return { ok: true, value: { orgName, campName, url, shared: raw.shared } };
  }

  if (orgName && campName) {
    return { ok: true, value: { orgName, campName, shared: raw.shared } };
  }

  return { ok: false, error: "Enter an organization and camp name, or paste a URL." };
}
