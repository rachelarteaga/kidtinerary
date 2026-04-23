import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SharePill } from "@/components/planner/shared-indicator-pill";

describe("SharePill", () => {
  it("renders 'Share' label when not shared", () => {
    render(<SharePill shared={false} onClick={() => {}} />);
    expect(screen.getByText("Share")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share planner/i })).toBeInTheDocument();
  });

  it("renders 'Shared' label + shared aria when shared", () => {
    render(<SharePill shared={true} onClick={() => {}} />);
    expect(screen.getByText("Shared")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /currently shared/i }),
    ).toBeInTheDocument();
  });

  it("fires onClick in both states", () => {
    const off = vi.fn();
    const on = vi.fn();
    const { rerender } = render(<SharePill shared={false} onClick={off} />);
    fireEvent.click(screen.getByRole("button"));
    expect(off).toHaveBeenCalledTimes(1);
    rerender(<SharePill shared={true} onClick={on} />);
    fireEvent.click(screen.getByRole("button"));
    expect(on).toHaveBeenCalledTimes(1);
  });

  it("is not a link (button only)", () => {
    render(<SharePill shared={true} onClick={() => {}} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
