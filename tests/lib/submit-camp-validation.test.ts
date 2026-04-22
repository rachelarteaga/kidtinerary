import { describe, it, expect } from "vitest";
import { validateSubmitCampInput } from "@/lib/submit-camp-validation";

describe("validateSubmitCampInput", () => {
  it("accepts org + camp name", () => {
    const r = validateSubmitCampInput({ orgName: "YMCA", campName: "Camp Kanata", shared: false });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.orgName).toBe("YMCA");
      expect(r.value.campName).toBe("Camp Kanata");
      expect(r.value.url).toBeUndefined();
    }
  });

  it("accepts URL only", () => {
    const r = validateSubmitCampInput({ url: "https://sciencecamp.com", shared: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.url).toBe("https://sciencecamp.com");
  });

  it("accepts activityId (autocomplete hit)", () => {
    const r = validateSubmitCampInput({ activityId: "00000000-0000-0000-0000-000000000001", shared: false });
    expect(r.ok).toBe(true);
  });

  it("trims whitespace from fields", () => {
    const r = validateSubmitCampInput({ orgName: "  YMCA  ", campName: "  Kanata  ", shared: false });
    if (r.ok) {
      expect(r.value.orgName).toBe("YMCA");
      expect(r.value.campName).toBe("Kanata");
    }
  });

  it("rejects empty input", () => {
    const r = validateSubmitCampInput({ shared: false });
    expect(r.ok).toBe(false);
  });

  it("rejects org without camp name", () => {
    const r = validateSubmitCampInput({ orgName: "YMCA", shared: false });
    expect(r.ok).toBe(false);
  });

  it("rejects camp name without org", () => {
    const r = validateSubmitCampInput({ campName: "Kanata", shared: false });
    expect(r.ok).toBe(false);
  });

  it("rejects URL that does not parse", () => {
    const r = validateSubmitCampInput({ url: "not a url", shared: false });
    expect(r.ok).toBe(false);
  });
});
