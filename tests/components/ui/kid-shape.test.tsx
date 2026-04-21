import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { KidShape } from "@/components/ui/kid-shape";

describe("KidShape", () => {
  it("renders a circle for index 0", () => {
    const { container } = render(<KidShape index={0} size={32} initial="M" />);
    expect(container.querySelector("circle")).not.toBeNull();
  });

  it("renders a square for index 1", () => {
    const { container } = render(<KidShape index={1} size={32} initial="L" />);
    expect(container.querySelector("rect")).not.toBeNull();
  });

  it("renders a triangle for index 2", () => {
    const { container } = render(<KidShape index={2} size={32} initial="R" />);
    const polygons = container.querySelectorAll("polygon");
    expect(polygons.length).toBeGreaterThan(0);
  });

  it("renders a diamond for index 3", () => {
    const { container } = render(<KidShape index={3} size={32} initial="S" />);
    const polygons = container.querySelectorAll("polygon");
    expect(polygons.length).toBeGreaterThan(0);
  });

  it("wraps back to circle after 4 kids", () => {
    const { container } = render(<KidShape index={4} size={32} initial="P" />);
    expect(container.querySelector("circle")).not.toBeNull();
  });

  it("renders the initial inside the shape", () => {
    const { getByText } = render(<KidShape index={0} size={32} initial="M" />);
    expect(getByText("M")).toBeInTheDocument();
  });

  it("renders a 10px dot variant with no initial when dotOnly is true", () => {
    const { container, queryByText } = render(
      <KidShape index={0} size={10} initial="M" dotOnly />
    );
    expect(container.querySelector("circle")).not.toBeNull();
    expect(queryByText("M")).toBeNull();
  });
});
