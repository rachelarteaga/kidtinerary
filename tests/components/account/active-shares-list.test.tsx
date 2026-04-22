import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActiveSharesList, type PlannerShareRow } from "@/components/account/active-shares-list";

vi.mock("@/lib/actions", () => ({ revokeShare: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const row: PlannerShareRow = {
  id: "s1",
  token: "tkn-abc",
  plannerName: "Summer 2026",
  kidCount: 2,
  includeCost: false,
  includePersonalBlockDetails: false,
  createdAt: "2026-04-22T17:00:00Z",
};

describe("ActiveSharesList", () => {
  it("renders the empty state when no shares exist", () => {
    render(<ActiveSharesList shares={[]} />);
    expect(screen.getByText(/haven't shared any planners yet/i)).toBeInTheDocument();
  });

  it("renders a row per share with planner name, kid count, and revoke button", () => {
    render(<ActiveSharesList shares={[row]} />);
    expect(screen.getByText("Summer 2026")).toBeInTheDocument();
    expect(screen.getByText(/2 kids/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy link/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stop sharing/i })).toBeInTheDocument();
  });
});
