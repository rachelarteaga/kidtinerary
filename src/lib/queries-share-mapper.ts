import type { SharedByTokenResult } from "@/lib/queries";

export function mapSharedPlannerRpcPayload(data: any): SharedByTokenResult {
  if (!data) return { type: "notfound" };

  if (data.type === "camp") {
    if (!data.camp_id) return { type: "notfound" };
    return {
      type: "camp",
      token: data.token,
      campId: data.camp_id,
      recommenderNote: data.recommender_note ?? null,
    };
  }

  if (data.type !== "planner" || !data.planner) return { type: "notfound" };

  return {
    type: "planner",
    token: data.token,
    plannerId: data.planner_id,
    plannerName: data.planner.name,
    plannerStart: data.planner.start_date,
    plannerEnd: data.planner.end_date,
    ownerDisplayName: data.owner_display_name ?? null,
    kidIds: Array.isArray(data.kid_ids) ? data.kid_ids : [],
    includeCost: !!data.include_cost,
    includePersonalBlockDetails: !!data.include_personal_block_details,
    colorByActivityId: data.color_by_activity_id ?? {},
    kids: Array.isArray(data.kids) ? data.kids : [],
    entries: Array.isArray(data.entries) ? data.entries : [],
    blocks: Array.isArray(data.blocks) ? data.blocks : [],
  };
}
