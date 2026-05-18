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

// Canonical fingerprints (any unique string — actual SHA-256 hex in prod).
const FP_GALILEO = "fp-galileo-westport-ct";
const FP_TENNIS = "fp-tennis-westport-ct";
const FP_LIONS = "fp-lions-park-x-press-westport-ct";

describe("computeFriendOverlaps — fallback (activity_id, both sides null fingerprint)", () => {
  it("returns empty map when there are no user entries", () => {
    expect(computeFriendOverlaps([], [])).toEqual({});
  });

  it("returns empty map when there are no friend planners", () => {
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, canonical_fingerprint: null, week_key: W1 },
    ];
    expect(computeFriendOverlaps(user, [])).toEqual({});
  });

  it("returns empty map when no friend kid is in the same camp the same week", () => {
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, canonical_fingerprint: null, week_key: W1 },
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kids: [{ id: "fk-liam", name: "Liam", color: "#abc" }],
        entries: [
          { child_id: "fk-liam", activity_id: tennis, canonical_fingerprint: null, week_key: W1 },
          { child_id: "fk-liam", activity_id: galileo, canonical_fingerprint: null, week_key: W2 },
        ],
      },
    ];
    expect(computeFriendOverlaps(user, friends)).toEqual({});
  });

  it("returns one overlap when one friend-kid matches one user cell", () => {
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, canonical_fingerprint: null, week_key: W1 },
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kids: [{ id: "fk-liam", name: "Liam", color: "#aabbcc" }],
        entries: [{ child_id: "fk-liam", activity_id: galileo, canonical_fingerprint: null, week_key: W1 }],
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
      { child_id: jack, activity_id: galileo, canonical_fingerprint: null, week_key: W1 },
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s2",
        shareToken: "tok2",
        ownerName: "Tess",
        kids: [{ id: "fk-junie", name: "Junie", color: "#111" }],
        entries: [{ child_id: "fk-junie", activity_id: galileo, canonical_fingerprint: null, week_key: W1 }],
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
          { child_id: "fk-liam", activity_id: galileo, canonical_fingerprint: null, week_key: W1 },
          { child_id: "fk-olive", activity_id: galileo, canonical_fingerprint: null, week_key: W1 },
        ],
      },
    ];
    const out = computeFriendOverlaps(user, friends);
    const names = out[overlapKey(jack, W1)].map((o) => `${o.ownerName}/${o.kidName}`);
    expect(names).toEqual(["Sarah/Liam", "Sarah/Olive", "Tess/Junie"]);
  });

  it("matches per-kid per-week independently (different kids' cells stay separate)", () => {
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, canonical_fingerprint: null, week_key: W1 },
      { child_id: teddy, activity_id: galileo, canonical_fingerprint: null, week_key: W2 },
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kids: [{ id: "fk-liam", name: "Liam", color: "#aaa" }],
        entries: [
          { child_id: "fk-liam", activity_id: galileo, canonical_fingerprint: null, week_key: W1 },
          { child_id: "fk-liam", activity_id: galileo, canonical_fingerprint: null, week_key: W2 },
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
      { child_id: jack, activity_id: galileo, canonical_fingerprint: null, week_key: W1 },
      { child_id: jack, activity_id: galileo, canonical_fingerprint: null, week_key: W1 },
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kids: [{ id: "fk-liam", name: "Liam", color: "#aaa" }],
        entries: [{ child_id: "fk-liam", activity_id: galileo, canonical_fingerprint: null, week_key: W1 }],
      },
    ];
    const out = computeFriendOverlaps(user, friends);
    expect(out[overlapKey(jack, W1)].length).toBe(1);
  });

  it("ignores friend entries whose child_id isn't in the kids list", () => {
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, canonical_fingerprint: null, week_key: W1 },
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kids: [],
        entries: [{ child_id: "fk-ghost", activity_id: galileo, canonical_fingerprint: null, week_key: W1 }],
      },
    ];
    expect(computeFriendOverlaps(user, friends)).toEqual({});
  });
});

describe("computeFriendOverlaps — canonical_fingerprint (the bug fix)", () => {
  // The Rachel case. User's row and friend's row reference different activity_ids
  // because each parent submitted "the same camp" independently. The matcher
  // groups them via canonical_fingerprint and surfaces the overlap.
  it("matches across different activity_ids when fingerprints agree (Rachel case)", () => {
    const user: UserPlannerEntry[] = [
      {
        child_id: jack,
        activity_id: "act-rachel-lions-park",
        canonical_fingerprint: FP_LIONS,
        week_key: W1,
      },
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kids: [{ id: "fk-jack-friend", name: "JackFriend", color: "#abc" }],
        entries: [
          {
            child_id: "fk-jack-friend",
            activity_id: "act-friend-summer-x-press",
            canonical_fingerprint: FP_LIONS,
            week_key: W1,
          },
        ],
      },
    ];
    const out = computeFriendOverlaps(user, friends);
    expect(out[overlapKey(jack, W1)]).toHaveLength(1);
    expect(out[overlapKey(jack, W1)][0].kidName).toBe("JackFriend");
  });

  it("doesn't match across different fingerprints (genuinely different activities)", () => {
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, canonical_fingerprint: FP_GALILEO, week_key: W1 },
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kids: [{ id: "fk-liam", name: "Liam", color: "#aaa" }],
        entries: [
          { child_id: "fk-liam", activity_id: tennis, canonical_fingerprint: FP_TENNIS, week_key: W1 },
        ],
      },
    ];
    expect(computeFriendOverlaps(user, friends)).toEqual({});
  });

  it("doesn't conflate identical activity_id with different fingerprints (defensive)", () => {
    // Pathological: same activity_id, different fingerprints. Should NOT match
    // via the fingerprint path because the user has a non-null fingerprint so
    // we use it as the primary key. (Real DB shouldn't produce this, but the
    // matcher should be robust.)
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, canonical_fingerprint: FP_GALILEO, week_key: W1 },
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kids: [{ id: "fk-liam", name: "Liam", color: "#aaa" }],
        entries: [
          { child_id: "fk-liam", activity_id: galileo, canonical_fingerprint: FP_TENNIS, week_key: W1 },
        ],
      },
    ];
    expect(computeFriendOverlaps(user, friends)).toEqual({});
  });
});

describe("computeFriendOverlaps — mixed null/non-null fingerprints during rollout", () => {
  it("user has fingerprint, friend has null → no fingerprint match (and id-only fallback skipped)", () => {
    // User side has a fingerprint, so the matcher uses fingerprint-only.
    // Friend's row has null fingerprint, so it's only in the id index.
    // The two never meet — overlap is missed during the rollout gap, which is
    // the correct conservative behavior (we'd rather miss than false-positive).
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, canonical_fingerprint: FP_GALILEO, week_key: W1 },
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kids: [{ id: "fk-liam", name: "Liam", color: "#aaa" }],
        entries: [
          { child_id: "fk-liam", activity_id: galileo, canonical_fingerprint: null, week_key: W1 },
        ],
      },
    ];
    expect(computeFriendOverlaps(user, friends)).toEqual({});
  });

  it("user has null fingerprint, friend has fingerprint → fall back to activity_id and still match", () => {
    // Legacy user row pre-backfill, but the friend's row has been fingerprinted.
    // The friend's entry is in BOTH indices (fp + id) when it has a fingerprint,
    // so the user's id-key lookup still finds it.
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, canonical_fingerprint: null, week_key: W1 },
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kids: [{ id: "fk-liam", name: "Liam", color: "#aaa" }],
        entries: [
          { child_id: "fk-liam", activity_id: galileo, canonical_fingerprint: FP_GALILEO, week_key: W1 },
        ],
      },
    ];
    const out = computeFriendOverlaps(user, friends);
    expect(out[overlapKey(jack, W1)]).toHaveLength(1);
  });

  it("dedups when the same friend entry would match via both indices", () => {
    // Friend's entry has a fingerprint AND matches activity_id. The user has
    // a fingerprint. Lookup goes via fingerprint path only — should produce
    // exactly one overlap, not two.
    const user: UserPlannerEntry[] = [
      { child_id: jack, activity_id: galileo, canonical_fingerprint: FP_GALILEO, week_key: W1 },
    ];
    const friends: FriendPlannerForOverlap[] = [
      {
        shareId: "s1",
        shareToken: "tok1",
        ownerName: "Sarah",
        kids: [{ id: "fk-liam", name: "Liam", color: "#aaa" }],
        entries: [
          { child_id: "fk-liam", activity_id: galileo, canonical_fingerprint: FP_GALILEO, week_key: W1 },
        ],
      },
    ];
    const out = computeFriendOverlaps(user, friends);
    expect(out[overlapKey(jack, W1)]).toHaveLength(1);
  });
});
