import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders with default variant (primary = ink black)", () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole("button", { name: "Click me" });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain("bg-ink");
    expect(btn.className).toContain("text-ink-inverse");
  });

  it("renders dark variant (same as primary)", () => {
    render(<Button variant="dark">Details</Button>);
    const btn = screen.getByRole("button", { name: "Details" });
    expect(btn.className).toContain("bg-ink");
  });

  it("renders outline variant (white fill, ink border)", () => {
    render(<Button variant="outline">Compare</Button>);
    const btn = screen.getByRole("button", { name: "Compare" });
    expect(btn.className).toContain("bg-surface");
    expect(btn.className).toContain("border-ink");
  });

  it("renders nature variant (success mint fill)", () => {
    render(<Button variant="nature">Add</Button>);
    const btn = screen.getByRole("button", { name: "Add" });
    expect(btn.className).toContain("bg-[#d8f0e6]");
  });

  it("renders ghost variant (transparent)", () => {
    render(<Button variant="ghost">Dismiss</Button>);
    const btn = screen.getByRole("button", { name: "Dismiss" });
    expect(btn.className).toContain("bg-transparent");
  });

  it("keeps uppercase tracking on label per spec", () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn.className).toContain("uppercase");
    expect(btn.className).toContain("tracking-widest");
  });
});
