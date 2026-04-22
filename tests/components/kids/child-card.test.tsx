import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChildCard } from "@/components/kids/child-card";

vi.mock("@/lib/actions", () => ({
  deleteChild: vi.fn(),
  updateChildAvatar: vi.fn(),
}));

describe("ChildCard", () => {
  const child = {
    id: "kid-1",
    name: "Maya",
    birth_date: "2018-05-01",
    interests: ["art"],
    avatar_url: null,
  };

  it("renders the kid's name and age", () => {
    render(<ChildCard child={child} index={0} onEdit={() => {}} />);
    expect(screen.getByText("Maya")).toBeInTheDocument();
    expect(screen.getByText(/^Age \d+$/)).toBeInTheDocument();
  });

  it("does not render the deprecated 'Planner coming soon' stub", () => {
    render(<ChildCard child={child} index={0} onEdit={() => {}} />);
    expect(screen.queryByText(/planner coming soon/i)).not.toBeInTheDocument();
  });

  it("exposes an accessible avatar button", () => {
    render(<ChildCard child={child} index={0} onEdit={() => {}} />);
    expect(screen.getByRole("button", { name: /change avatar for maya/i })).toBeInTheDocument();
  });
});
