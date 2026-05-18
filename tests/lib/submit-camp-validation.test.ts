import { describe, it, expect } from "vitest";
import { validateSubmitCampInput } from "@/lib/submit-camp-validation";

const REGION = { city: "Westport", state: "CT" } as const;

describe("validateSubmitCampInput", () => {
  it("accepts org + camp name + region", () => {
    const r = validateSubmitCampInput({
      orgName: "YMCA",
      campName: "Camp Kanata",
      region: REGION,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.orgName).toBe("YMCA");
      expect(r.value.campName).toBe("Camp Kanata");
      expect(r.value.url).toBeUndefined();
      expect(r.value.region).toEqual({ city: "Westport", state: "CT" });
    }
  });

  it("accepts URL only with region", () => {
    const r = validateSubmitCampInput({
      url: "https://sciencecamp.com",
      region: REGION,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.url).toBe("https://sciencecamp.com");
  });

  it("accepts activityId (autocomplete hit) without region", () => {
    const r = validateSubmitCampInput({
      activityId: "00000000-0000-0000-0000-000000000001",
    });
    expect(r.ok).toBe(true);
  });

  it("accepts online region", () => {
    const r = validateSubmitCampInput({
      orgName: "Outschool",
      campName: "Python for Kids",
      region: { online: true },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.region).toEqual({ online: true });
  });

  it("trims whitespace from fields", () => {
    const r = validateSubmitCampInput({
      orgName: "  YMCA  ",
      campName: "  Kanata  ",
      region: REGION,
    });
    if (r.ok) {
      expect(r.value.orgName).toBe("YMCA");
      expect(r.value.campName).toBe("Kanata");
    }
  });

  it("rejects empty input", () => {
    const r = validateSubmitCampInput({});
    expect(r.ok).toBe(false);
  });

  it("rejects org without camp name", () => {
    const r = validateSubmitCampInput({ orgName: "YMCA", region: REGION });
    expect(r.ok).toBe(false);
  });

  it("rejects camp name without org", () => {
    const r = validateSubmitCampInput({ campName: "Kanata", region: REGION });
    expect(r.ok).toBe(false);
  });

  it("rejects URL that does not parse", () => {
    const r = validateSubmitCampInput({ url: "not a url", region: REGION });
    expect(r.ok).toBe(false);
  });

  it("rejects missing region", () => {
    const r = validateSubmitCampInput({
      orgName: "YMCA",
      campName: "Camp Kanata",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects invalid state code", () => {
    const r = validateSubmitCampInput({
      orgName: "YMCA",
      campName: "Camp Kanata",
      region: { city: "Westport", state: "ZZ" },
    });
    expect(r.ok).toBe(false);
  });

  it("rejects missing city", () => {
    const r = validateSubmitCampInput({
      orgName: "YMCA",
      campName: "Camp Kanata",
      region: { city: "", state: "CT" },
    });
    expect(r.ok).toBe(false);
  });

  it("uppercases state code on output", () => {
    const r = validateSubmitCampInput({
      orgName: "YMCA",
      campName: "Camp Kanata",
      region: { city: "Westport", state: "ct" },
    });
    expect(r.ok).toBe(true);
    if (r.ok && !("online" in r.value.region)) {
      expect(r.value.region.state).toBe("CT");
    }
  });

  it("passes through private=true", () => {
    const r = validateSubmitCampInput({
      orgName: "YMCA",
      campName: "Camp Kanata",
      region: REGION,
      private: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.private).toBe(true);
  });

  it("defaults private to false when omitted", () => {
    const r = validateSubmitCampInput({
      orgName: "YMCA",
      campName: "Camp Kanata",
      region: REGION,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.private).toBe(false);
  });
});
