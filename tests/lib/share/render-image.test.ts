import { describe, it, expect } from "vitest";
import { buildShareFilename } from "@/lib/share/render-image";

describe("buildShareFilename", () => {
  it("produces a planner-friendly png filename", () => {
    const name = buildShareFilename("Summer 2026");
    expect(name).toMatch(/^summer-2026-planner-\d{8}\.png$/);
  });

  it("sanitizes special characters", () => {
    const name = buildShareFilename("Rachel's / Summer!");
    expect(name).toMatch(/^rachel-s-summer-planner-\d{8}\.png$/);
  });
});
