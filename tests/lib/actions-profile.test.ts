import { describe, it, expect } from "vitest";
import { validateProfileInput } from "@/lib/actions-profile-validation";

describe("validateProfileInput", () => {
  it("rejects empty name", () => {
    const result = validateProfileInput({ fullName: "", address: "123 Main", phone: "" });
    expect(result.error).toMatch(/name/i);
  });

  it("accepts empty phone (optional)", () => {
    const result = validateProfileInput({ fullName: "Rachel", address: "123 Main", phone: "" });
    expect(result.error).toBeUndefined();
  });

  it("rejects obviously invalid phone", () => {
    const result = validateProfileInput({ fullName: "Rachel", address: "123 Main", phone: "abc" });
    expect(result.error).toMatch(/phone/i);
  });

  it("accepts E.164-ish phone", () => {
    const result = validateProfileInput({ fullName: "Rachel", address: "123 Main", phone: "+12025551234" });
    expect(result.error).toBeUndefined();
  });
});
