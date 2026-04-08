import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tag } from "@/components/ui/tag";

describe("Tag", () => {
  it("renders with category color for age type", () => {
    render(<Tag type="age" label="Ages 5-9" />);
    const tag = screen.getByText("Ages 5-9");
    expect(tag).toBeInTheDocument();
    expect(tag.className).toContain("text-[#3d7a54]");
  });

  it("renders with category color for type type", () => {
    render(<Tag type="category" label="Arts" />);
    const tag = screen.getByText("Arts");
    expect(tag.className).toContain("text-[#b85c3c]");
  });

  it("renders with schedule color", () => {
    render(<Tag type="schedule" label="Full Day" />);
    const tag = screen.getByText("Full Day");
    expect(tag.className).toContain("text-[#4a6d8c]");
  });

  it("uses mono font and uppercase", () => {
    render(<Tag type="age" label="Test" />);
    const tag = screen.getByText("Test");
    expect(tag.className).toContain("font-mono");
    expect(tag.className).toContain("uppercase");
  });
});
