import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MyPlannersClient } from "@/app/account/planners/client";
import type { PlannerSummary } from "@/lib/queries";

vi.mock("@/lib/actions", () => ({
  createPlanner: vi.fn(),
  deletePlanner: vi.fn(),
  duplicatePlanner: vi.fn(),
  updatePlannerName: vi.fn(),
  createPlannerShare: vi.fn(),
  revokePlannerShareByPlanner: vi.fn(),
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const kids = [
  { id: "k1", name: "Maya" },
  { id: "k2", name: "Jonah" },
];

function makeSummary(overrides: Partial<PlannerSummary> = {}): PlannerSummary {
  return {
    id: "p1",
    name: "Summer 2026",
    startDate: "2026-06-15",
    endDate: "2026-08-28",
    kidCount: 2,
    lastEditedAt: "2026-04-22T12:00:00Z",
    shareToken: null,
    shareId: null,
    shareKidIds: [],
    shareIncludeCost: false,
    shareIncludePersonalBlockDetails: false,
    ...overrides,
  };
}

describe("MyPlannersClient", () => {
  it("renders empty state when there are no planners", () => {
    render(<MyPlannersClient initialPlanners={[]} allKids={kids} />);
    expect(screen.getByText(/don't have any planners yet/i)).toBeInTheDocument();
  });

  it("renders a row per planner with name + kid count", () => {
    render(
      <MyPlannersClient
        initialPlanners={[makeSummary(), makeSummary({ id: "p2", name: "School year", kidCount: 1 })]}
        allKids={kids}
      />,
    );
    const renameButtons = screen.getAllByRole("button", { name: /rename planner/i });
    expect(renameButtons).toHaveLength(2);
    expect(screen.getByText("Summer 2026")).toBeInTheDocument();
    expect(screen.getByText("School year")).toBeInTheDocument();
  });

  it("renders a 'Share planner' CTA when off and 'Sharing on' badge + Stop sharing when on", () => {
    render(
      <MyPlannersClient
        initialPlanners={[
          makeSummary({ id: "p1", name: "A", shareToken: null }),
          makeSummary({ id: "p2", name: "B", shareToken: "tok-abc", shareId: "s1", shareKidIds: ["k1"] }),
        ]}
        allKids={kids}
      />,
    );
    // Off row: clickable "Share planner" CTA
    expect(screen.getByRole("button", { name: /share planner/i })).toBeInTheDocument();
    // On row: read-only "Sharing on" status badge (not a button)
    expect(screen.getByLabelText(/sharing is on/i)).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    // ON row exposes Copy link, Edit settings, Stop sharing
    expect(screen.getByRole("button", { name: /copy link/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit settings/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stop sharing/i })).toBeInTheDocument();
  });

  it("opens the delete confirm modal when Delete is clicked", () => {
    render(<MyPlannersClient initialPlanners={[makeSummary()]} allKids={kids} />);
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(screen.getByText(/delete "summer 2026"\?/i)).toBeInTheDocument();
  });

  it("opens the new planner modal from the header button", () => {
    render(<MyPlannersClient initialPlanners={[makeSummary()]} allKids={kids} />);
    fireEvent.click(screen.getByRole("button", { name: /\+ new planner/i }));
    expect(screen.getByRole("heading", { name: /^new planner$/i })).toBeInTheDocument();
  });
});
