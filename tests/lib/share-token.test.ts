import { describe, it, expect } from "vitest";
import { generateShareToken } from "@/lib/share-token";

describe("generateShareToken", () => {
  it("produces a 32-char url-safe token", () => {
    const t = generateShareToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("returns a different token on each call", () => {
    expect(generateShareToken()).not.toEqual(generateShareToken());
  });
});
