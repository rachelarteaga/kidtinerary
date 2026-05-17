import { describe, it, expect } from "vitest";
import {
  computeFriendOverlaps,
  overlapKey,
  type FriendPlannerForOverlap,
  type UserPlannerEntry,
} from "@/lib/overlap";

const jack = "kid-jack";
const teddy = "kid-teddy";
const W1 = "2026-W25";
const W2 = "2026-W26";
const galileo = "act-galileo";
const tennis = "act-tennis";

describe("computeFriendOverlaps", () => {
  it("returns empty map when there are no user entries", () => {
    expect(computeFriendOverlaps([], [])).toEqual({});
  });

  it("returns empty map when there are no friend planners", () => {
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, week_key: W1 },
    ];
    expect(computeFriendOverlaps(user, [])).toEqual({});
  });

  it("returns empty map when no friend kid is in the same camp the same week", () => {
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, week_key: W1 },
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kids: [{ id: "fk-liam", name: "Liam", color: "#abc" }],
        entries: [
          { child_id: "fk-liam", activity_id: tennis, week_key: W1 }, // diff activity
          { child_id: "fk-liam", activity_id: galileo, week_key: W2 }, // diff week
        ],
      },
    ];
    expect(computeFriendOverlaps(user, friends)).toEqual({});
  });

  it("returns one overlap when one friend-kid matches one user cell", () => {
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, week_key: W1 },
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kids: [{ id: "fk-liam", name: "Liam", color: "#aabbcc" }],
        entries: [{ child_id: "fk-liam", activity_id: galileo, week_key: W1 }],
      },
    ];
    const out = computeFriendOverlaps(user, friends);
    expect(out[overlapKey(jack, W1)]).toEqual([
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kidName: "Liam",
        kidColor: "#aabbcc",
      },
    ]);
  });

  it("stacks multiple friend-kids on the same user cell, sorted by owner then kid", () => {
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, week_key: W1 },
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s2",
        shareToken: "tok2",
        ownerName: "Tess",
        kids: [{ id: "fk-junie", name: "Junie", color: "#111" }],
        entries: [{ child_id: "fk-junie", activity_id: galileo, week_key: W1 }],
      },
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kids: [
          { id: "fk-liam", name: "Liam", color: "#222" },
          { id: "fk-olive", name: "Olive", color: "#333" },
        ],
        entries: [
          { child_id: "fk-liam", activity_id: galileo, week_key: W1 },
          { child_id: "fk-olive", activity_id: galileo, week_key: W1 },
        ],
      },
    ];
    const out = computeFriendOverlaps(user, friends);
    const names = out[overlapKey(jack, W1)].map((o) => `${o.ownerName}/${o.kidName}`);
    // Sarah/Liam, Sarah/Olive, Tess/Junie — alphabetical owner then kid
    expect(names).toEqual(["Sarah/Liam", "Sarah/Olive", "Tess/Junie"]);
  });

  it("matches per-kid per-week independently (different kids' cells stay separate)", () => {
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, week_key: W1 },
      { child_id: teddy, activity_id: galileo, week_key: W2 },
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kids: [{ id: "fk-liam", name: "Liam", color: "#aaa" }],
        entries: [
          { child_id: "fk-liam", activity_id: galileo, week_key: W1 },
          { child_id: "fk-liam", activity_id: galileo, week_key: W2 },
        ],
      },
    ];
    const out = computeFriendOverlaps(user, friends);
    expect(Object.keys(out).sort()).toEqual(
      [overlapKey(jack, W1), overlapKey(teddy, W2)].sort(),
    );
  });

  it("deduplicates when the user has the same activity twice in one cell", () => {
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, week_key: W1 },
      { child_id: jack, activity_id: galileo, week_key: W1 }, // duplicate
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kids: [{ id: "fk-liam", name: "Liam", color: "#aaa" }],
        entries: [{ child_id: "fk-liam", activity_id: galileo, week_key: W1 }],
      },
    ];
    const out = computeFriendOverlaps(user, friends);
    expect(out[overlapKey(jack, W1)].length).toBe(1);
  });

  it("ignores friend entries whose child_id isn't in the kids list", () => {
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, week_key: W1 },
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kids: [], // empty — entry below references an unknown child
        entries: [{ child_id: "fk-ghost", activity_id: galileo, week_key: W1 }],
      },
    ];
    expect(computeFriendOverlaps(user, friends)).toEqual({});
  });
});
