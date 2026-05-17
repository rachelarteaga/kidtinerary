import { describe, it, expect } from "vitest";
import { validateProfileName } from "@/lib/actions-profile-name-validation";

describe("validateProfileName", () => {
  it("accepts a normal first and last name", () => {
    expect(validateProfileName({ firstName: "Sarah", lastName: "Jones" })).toEqual({});
  });

  it("rejects an empty first name", () => {
    expect(validateProfileName({ firstName: "", lastName: "Jones" }).error).toMatch(/first/i);
  });

  it("rejects a whitespace-only first name", () => {
    expect(validateProfileName({ firstName: "   ", lastName: "Jones" }).error).toMatch(/first/i);
  });

  it("rejects an empty last name", () => {
    expect(validateProfileName({ firstName: "Sarah", lastName: "" }).error).toMatch(/last/i);
  });

  it("rejects a whitespace-only last name", () => {
    expect(validateProfileName({ firstName: "Sarah", lastName: "\t " }).error).toMatch(/last/i);
  });

  it("trims surrounding whitespace before checking emptiness", () => {
    expect(validateProfileName({ firstName: "  Sarah  ", lastName: "  Jones " })).toEqual({});
  });

  it("accepts names with hyphens, apostrophes, and unicode", () => {
    expect(validateProfileName({ firstName: "Anne-Marie", lastName: "O'Connor" })).toEqual({});
    expect(validateProfileName({ firstName: "José", lastName: "García" })).toEqual({});
  });
});
