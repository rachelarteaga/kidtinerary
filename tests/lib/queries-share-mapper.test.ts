import { describe, it, expect } from "vitest";
import { mapSharedPlannerRpcPayload } from "@/lib/queries-share-mapper";

describe("mapSharedPlannerRpcPayload", () => {
  it("returns notfound when payload is null (token not in DB)", () => {
    expect(mapSharedPlannerRpcPayload(null)).toEqual({ type: "notfound" });
  });

  it("returns notfound when payload is undefined", () => {
    expect(mapSharedPlannerRpcPayload(undefined)).toEqual({ type: "notfound" });
  });

  it("returns notfound when type is unrecognized", () => {
    expect(mapSharedPlannerRpcPayload({ type: "garbage" })).toEqual({
      type: "notfound",
    });
  });

  it("maps camp scope to camp result", () => {
    const result = mapSharedPlannerRpcPayload({
      type: "camp",
      token: "tok123",
      camp_id: "camp-uuid",
      recommender_note: "love this one",
    });
    expect(result).toEqual({
      type: "camp",
      token: "tok123",
      campId: "camp-uuid",
      recommenderNote: "love this one",
    });
  });

  it("camp scope with null recommender_note returns null", () => {
    const result = mapSharedPlannerRpcPayload({
      type: "camp",
      token: "tok123",
      camp_id: "camp-uuid",
      recommender_note: null,
    });
    expect(result).toMatchObject({ type: "camp", recommenderNote: null });
  });

  it("camp scope without camp_id returns notfound (orphaned share)", () => {
    const result = mapSharedPlannerRpcPayload({
      type: "camp",
      token: "tok123",
      camp_id: null,
      recommender_note: null,
    });
    expect(result).toEqual({ type: "notfound" });
  });

  it("planner scope without planner block returns notfound (defensive)", () => {
    const result = mapSharedPlannerRpcPayload({
      type: "planner",
      token: "tok123",
      planner_id: null,
      planner: null,
    });
    expect(result).toEqual({ type: "notfound" });
  });

  it("maps a full planner payload", () => {
    const payload = {
      type: "planner",
      token: "tok-abc",
      planner_id: "planner-uuid",
      kid_ids: ["kid-1", "kid-2"],
      include_cost: true,
      include_personal_block_details: false,
      planner: {
        id: "planner-uuid",
        name: "Summer 2026",
        start_date: "2026-06-01",
        end_date: "2026-08-31",
      },
      owner_display_name: "Rachel",
      kids: [
        {
          id: "kid-1",
          name: "Lou",
          birth_date: "2018-04-01",
          avatar_url: null,
          color: "#aabbcc",
        },
      ],
      entries: [
        {
          id: "entry-1",
          child_id: "kid-1",
          status: "registered",
          sort_order: 0,
          notes: null,
          price_cents: 30000,
          price_unit: "per_week",
          session_part: "full",
          days_of_week: ["mon", "tue", "wed", "thu", "fri"],
          session: {
            id: "sess-1",
            starts_at: "2026-06-15",
            ends_at: "2026-06-19",
            time_slot: "full_day",
            hours_start: null,
            hours_end: null,
            is_sold_out: false,
            activity: {
              id: "act-1",
              name: "Soccer Camp",
              slug: "soccer-camp",
              categories: ["sports"],
              registration_url: null,
              description: null,
              organization: { id: "org-1", name: "YMCA" },
              activity_locations: [
                { id: "loc-1", address: "123 Main", location_name: "Field 2" },
              ],
            },
          },
        },
      ],
      blocks: [
        {
          id: "block-1",
          type: "school",
          title: "School",
          start_date: "2026-08-15",
          end_date: "2026-08-31",
          kid_ids: ["kid-1"],
        },
      ],
      color_by_activity_id: { "act-1": "#aabbcc" },
    };

    const result = mapSharedPlannerRpcPayload(payload);
    expect(result.type).toBe("planner");
    if (result.type !== "planner") return;
    expect(result.token).toBe("tok-abc");
    expect(result.plannerId).toBe("planner-uuid");
    expect(result.plannerName).toBe("Summer 2026");
    expect(result.plannerStart).toBe("2026-06-01");
    expect(result.plannerEnd).toBe("2026-08-31");
    expect(result.ownerDisplayName).toBe("Rachel");
    expect(result.kidIds).toEqual(["kid-1", "kid-2"]);
    expect(result.includeCost).toBe(true);
    expect(result.includePersonalBlockDetails).toBe(false);
    expect(result.colorByActivityId).toEqual({ "act-1": "#aabbcc" });
    expect(result.kids).toHaveLength(1);
    expect(result.kids[0].name).toBe("Lou");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].session.activity.organization?.name).toBe("YMCA");
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].kid_ids).toEqual(["kid-1"]);
  });

  it("planner scope with missing optional collections defaults to empty", () => {
    const result = mapSharedPlannerRpcPayload({
      type: "planner",
      token: "tok-abc",
      planner_id: "planner-uuid",
      kid_ids: null,
      include_cost: null,
      include_personal_block_details: null,
      planner: {
        id: "planner-uuid",
        name: "Summer",
        start_date: "2026-06-01",
        end_date: "2026-08-31",
      },
      owner_display_name: null,
      kids: null,
      entries: null,
      blocks: null,
      color_by_activity_id: null,
    });
    expect(result.type).toBe("planner");
    if (result.type !== "planner") return;
    expect(result.ownerDisplayName).toBeNull();
    expect(result.kidIds).toEqual([]);
    expect(result.includeCost).toBe(false);
    expect(result.includePersonalBlockDetails).toBe(false);
    expect(result.kids).toEqual([]);
    expect(result.entries).toEqual([]);
    expect(result.blocks).toEqual([]);
    expect(result.colorByActivityId).toEqual({});
  });
});
