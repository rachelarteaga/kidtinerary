import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders with default variant (primary)", () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole("button", { name: "Click me" });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain("bg-sunset");
  });

  it("renders dark variant", () => {
    render(<Button variant="dark">Details</Button>);
    const btn = screen.getByRole("button", { name: "Details" });
    expect(btn.className).toContain("bg-bark");
  });

  it("renders outline variant", () => {
    render(<Button variant="outline">Compare</Button>);
    const btn = screen.getByRole("button", { name: "Compare" });
    expect(btn.className).toContain("border");
  });

  it("renders nature variant", () => {
    render(<Button variant="nature">Add</Button>);
    const btn = screen.getByRole("button", { name: "Add" });
    expect(btn.className).toContain("bg-meadow");
  });

  it("applies pill shape and mono font", () => {
    render(<Button>Test</Button>);
    const btn = screen.getByRole("button", { name: "Test" });
    expect(btn.className).toContain("rounded-full");
    expect(btn.className).toContain("font-mono");
  });

  it("passes through HTML button props", () => {
    render(<Button disabled>Disabled</Button>);
    const btn = screen.getByRole("button", { name: "Disabled" });
    expect(btn).toBeDisabled();
  });
});
