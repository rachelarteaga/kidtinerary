import { describe, it, expect } from "vitest";
import { detectSharedEntries, type EntryForSharing } from "@/lib/planner-matrix";

describe("detectSharedEntries", () => {
  it("returns empty map when no shared entries", () => {
    const entries: EntryForSharing[] = [
      { entryId: "e1", childId: "c1", activityId: "a1", weekKey: "2026-W26" },
      { entryId: "e2", childId: "c2", activityId: "a2", weekKey: "2026-W26" },
    ];
    const result = detectSharedEntries(entries, [{ id: "c1", name: "A" }, { id: "c2", name: "B" }]);
    expect(result.get("e1")).toEqual([]);
    expect(result.get("e2")).toEqual([]);
  });

  it("identifies shared camp across two kids in same week", () => {
    const entries: EntryForSharing[] = [
      { entryId: "e1", childId: "c1", activityId: "a1", weekKey: "2026-W26" },
      { entryId: "e2", childId: "c2", activityId: "a1", weekKey: "2026-W26" },
    ];
    const result = detectSharedEntries(entries, [{ id: "c1", name: "A" }, { id: "c2", name: "B" }]);
    expect(result.get("e1")).toEqual(["B"]);
    expect(result.get("e2")).toEqual(["A"]);
  });

  it("does not mark entries in different weeks as shared", () => {
    const entries: EntryForSharing[] = [
      { entryId: "e1", childId: "c1", activityId: "a1", weekKey: "2026-W26" },
      { entryId: "e2", childId: "c2", activityId: "a1", weekKey: "2026-W27" },
    ];
    const result = detectSharedEntries(entries, [{ id: "c1", name: "A" }, { id: "c2", name: "B" }]);
    expect(result.get("e1")).toEqual([]);
    expect(result.get("e2")).toEqual([]);
  });
});
