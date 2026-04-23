import { describe, it, expect } from "vitest";
import { applyShareFilters, type RawPlannerData } from "@/lib/share/apply-filters";

const raw: RawPlannerData = {
  kids: [
    { id: "k1", name: "Maya", avatar_url: null, birth_date: "2018-01-01", color: "#fff" },
    { id: "k2", name: "Jonah", avatar_url: null, birth_date: "2020-01-01", color: "#fff" },
  ],
  entries: [
    { id: "e1", child_id: "k1", activity_name: "Art", price_weekly_cents: 4500 },
    { id: "e2", child_id: "k2", activity_name: "Lego", price_weekly_cents: 3500 },
  ],
  blocks: [
    { id: "b1", child_id: "k1", type: "custom", title: "Family trip" },
  ],
};

describe("applyShareFilters", () => {
  it("filters kids by kid_ids", () => {
    const out = applyShareFilters(raw, {
      kidIds: ["k1"], includeCost: false, includePersonalBlockDetails: false,
    });
    expect(out.kids.map((k) => k.id)).toEqual(["k1"]);
    expect(out.entries.map((e) => e.id)).toEqual(["e1"]);
    expect(out.blocks.map((b) => b.id)).toEqual(["b1"]);
  });

  it("strips prices when includeCost=false", () => {
    const out = applyShareFilters(raw, {
      kidIds: ["k1", "k2"], includeCost: false, includePersonalBlockDetails: false,
    });
    expect(out.entries.every((e) => e.price_weekly_cents === null)).toBe(true);
  });

  it("keeps prices when includeCost=true", () => {
    const out = applyShareFilters(raw, {
      kidIds: ["k1", "k2"], includeCost: true, includePersonalBlockDetails: false,
    });
    expect(out.entries.find((e) => e.id === "e1")?.price_weekly_cents).toBe(4500);
  });

  it("masks personal block titles when includePersonalBlockDetails=false", () => {
    const out = applyShareFilters(raw, {
      kidIds: ["k1"], includeCost: false, includePersonalBlockDetails: false,
    });
    expect(out.blocks[0].title).toBe("");
  });

  it("preserves personal block titles when includePersonalBlockDetails=true", () => {
    const out = applyShareFilters(raw, {
      kidIds: ["k1"], includeCost: false, includePersonalBlockDetails: true,
    });
    expect(out.blocks[0].title).toBe("Family trip");
  });

  it("drops entries whose child is not in kidIds", () => {
    const out = applyShareFilters(raw, {
      kidIds: ["k1"], includeCost: true, includePersonalBlockDetails: true,
    });
    expect(out.entries.map((e) => e.id)).toEqual(["e1"]);
    expect(out.blocks.map((b) => b.id)).toEqual(["b1"]);
  });
});
