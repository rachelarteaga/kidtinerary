import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SharedIndicatorPill } from "@/components/planner/shared-indicator-pill";

describe("SharedIndicatorPill", () => {
  it("renders nothing when count is 0", () => {
    const { container } = render(<SharedIndicatorPill count={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders 'Shared' when count is 1", () => {
    render(<SharedIndicatorPill count={1} />);
    expect(screen.getByText("Shared")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/account/sharing");
  });

  it("pluralizes aria label correctly when count > 1", () => {
    render(<SharedIndicatorPill count={3} />);
    expect(screen.getByLabelText(/3 active links/i)).toBeInTheDocument();
  });
});
