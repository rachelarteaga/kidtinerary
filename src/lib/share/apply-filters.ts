export interface RawPlannerData {
  kids: { id: string; name: string; avatar_url: string | null; birth_date: string; color: string }[];
  entries: { id: string; child_id: string; activity_name: string; price_weekly_cents: number | null }[];
  blocks: { id: string; child_id: string; type: string; title: string }[];
}

export interface ShareFilters {
  kidIds: string[];
  includeCost: boolean;
  includePersonalBlockDetails: boolean;
}

export function applyShareFilters(raw: RawPlannerData, f: ShareFilters): RawPlannerData {
  const allowedKids = new Set(f.kidIds);
  return {
    kids: raw.kids.filter((k) => allowedKids.has(k.id)),
    entries: raw.entries
      .filter((e) => allowedKids.has(e.child_id))
      .map((e) => ({ ...e, price_weekly_cents: f.includeCost ? e.price_weekly_cents : null })),
    blocks: raw.blocks
      .filter((b) => allowedKids.has(b.child_id))
      .map((b) => ({ ...b, title: f.includePersonalBlockDetails ? b.title : "" })),
  };
}
