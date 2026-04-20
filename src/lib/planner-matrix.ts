export interface EntryForSharing {
  entryId: string;
  childId: string;
  activityId: string;
  weekKey: string;
}

export interface KidRef {
  id: string;
  name: string;
}

/** Map of entryId → list of other kid names sharing the same activityId in the same weekKey. */
export function detectSharedEntries(
  entries: EntryForSharing[],
  kids: KidRef[]
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const nameOf = new Map(kids.map((k) => [k.id, k.name]));

  const groups = new Map<string, EntryForSharing[]>();
  for (const e of entries) {
    const key = `${e.weekKey}::${e.activityId}`;
    const arr = groups.get(key) ?? [];
    arr.push(e);
    groups.set(key, arr);
  }

  for (const e of entries) {
    const key = `${e.weekKey}::${e.activityId}`;
    const group = groups.get(key) ?? [];
    const otherNames = group
      .filter((g) => g.childId !== e.childId)
      .map((g) => nameOf.get(g.childId) ?? "?");
    out.set(e.entryId, otherNames);
  }

  return out;
}
