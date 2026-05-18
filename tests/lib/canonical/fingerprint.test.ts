import { describe, it, expect } from "vitest";
import {
  computeOrgFingerprint,
  computeActivityFingerprint,
  buildOrgCanonicalLabel,
} from "@/lib/canonical/fingerprint";

const westport = { city: "Westport", state: "CT" } as const;
const stamford = { city: "Stamford", state: "CT" } as const;
const onlineRegion = { online: true } as const;

describe("computeOrgFingerprint", () => {
  it("returns a 64-char hex hash for valid inputs", () => {
    const fp = computeOrgFingerprint({
      name: "Lions Park Recreation Center",
      region: westport,
    });
    expect(fp).toMatch(/^[a-f0-9]{64}$/);
  });

  it("matches across token-order variations of the same org", () => {
    const a = computeOrgFingerprint({ name: "YMCA of Westport", region: westport });
    const b = computeOrgFingerprint({ name: "Westport YMCA", region: westport });
    expect(a).toBe(b);
  });

  it("matches across abbreviation variations (rec / recreation)", () => {
    const a = computeOrgFingerprint({
      name: "Lions Park Rec Center",
      region: westport,
    });
    const b = computeOrgFingerprint({
      name: "Lions Park Recreation Center",
      region: westport,
    });
    expect(a).toBe(b);
  });

  it("distinguishes same-name orgs in different cities", () => {
    const a = computeOrgFingerprint({ name: "YMCA", region: westport });
    const b = computeOrgFingerprint({ name: "YMCA", region: stamford });
    expect(a).not.toBe(b);
  });

  it("treats online as its own region bucket", () => {
    const local = computeOrgFingerprint({ name: "Outschool", region: westport });
    const online = computeOrgFingerprint({ name: "Outschool", region: onlineRegion });
    expect(local).not.toBe(online);
  });

  it("returns empty string for insufficient inputs", () => {
    expect(computeOrgFingerprint({ name: "", region: westport })).toBe("");
    expect(
      computeOrgFingerprint({
        name: "YMCA",
        region: { city: "", state: "CT" },
      }),
    ).toBe("");
  });
});

describe("computeActivityFingerprint", () => {
  // The bug we're solving: Rachel and her friend each submitted what is the
  // same real-world camp. With same org + same region + the new normalize
  // pipeline, their activity fingerprints MUST match.
  it("collapses the Lions Park case (the bug we're fixing)", () => {
    const orgFp = computeOrgFingerprint({
      name: "Lions Park Recreation Center",
      region: westport,
    });
    const rachel = computeActivityFingerprint({
      orgFingerprint: orgFp,
      programName: "Lions Park X-Press",
    });
    const friend = computeActivityFingerprint({
      orgFingerprint: orgFp,
      programName: "Summer X-Press Day Camp at Lions Park",
    });
    expect(rachel).toBe(friend);
    expect(rachel).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps distinct programs distinct (Soccer vs Tennis at same org)", () => {
    const orgFp = computeOrgFingerprint({
      name: "Lions Park Recreation Center",
      region: westport,
    });
    const soccer = computeActivityFingerprint({
      orgFingerprint: orgFp,
      programName: "Soccer",
    });
    const tennis = computeActivityFingerprint({
      orgFingerprint: orgFp,
      programName: "Tennis",
    });
    expect(soccer).not.toBe(tennis);
  });

  it("treats same-name programs at different orgs as distinct activities", () => {
    const orgA = computeOrgFingerprint({ name: "YMCA", region: westport });
    const orgB = computeOrgFingerprint({
      name: "Lions Park Recreation Center",
      region: westport,
    });
    const a = computeActivityFingerprint({
      orgFingerprint: orgA,
      programName: "Adventure",
    });
    const b = computeActivityFingerprint({
      orgFingerprint: orgB,
      programName: "Adventure",
    });
    expect(a).not.toBe(b);
  });

  it("collapses program-name session/year variation under same org", () => {
    const orgFp = computeOrgFingerprint({ name: "YMCA", region: westport });
    const a = computeActivityFingerprint({
      orgFingerprint: orgFp,
      programName: "Adventure Camp Summer 2026",
    });
    const b = computeActivityFingerprint({
      orgFingerprint: orgFp,
      programName: "Adventure Camp Session 1",
    });
    expect(a).toBe(b);
  });

  it("returns empty string for missing inputs", () => {
    expect(
      computeActivityFingerprint({ orgFingerprint: "", programName: "Adventure" }),
    ).toBe("");
    expect(
      computeActivityFingerprint({ orgFingerprint: "abc", programName: "" }),
    ).toBe("");
  });
});

describe("buildOrgCanonicalLabel", () => {
  it("produces a readable label combining normalized name + region", () => {
    const label = buildOrgCanonicalLabel({
      name: "YMCA of Westport",
      region: westport,
    });
    expect(label).toContain("westport, CT");
    expect(label).toMatch(/westport\s+ymca/); // tokens sort alphabetically
  });

  it("returns empty string when inputs are insufficient", () => {
    expect(
      buildOrgCanonicalLabel({ name: "", region: westport }),
    ).toBe("");
  });
});
