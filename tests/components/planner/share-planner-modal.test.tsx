import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SharePlannerModal } from "@/components/planner/share-planner-modal";

vi.mock("@/lib/actions", () => ({ createPlannerShare: vi.fn() }));
vi.mock("@/lib/share/render-image", () => ({
  sharePlannerImage: vi.fn(),
  buildShareFilename: (n: string) => `${n}.png`,
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const kids = [
  { id: "k1", name: "Maya", avatar_url: null, index: 0 },
  { id: "k2", name: "Jonah", avatar_url: null, index: 1 },
];

const baseProps = {
  open: true as const,
  plannerId: "p1",
  plannerName: "Summer 2026",
  plannerStart: "2026-06-15",
  plannerEnd: "2026-08-28",
  ownerDisplayName: null,
  kids,
  sharedKids: [],
  sharedEntries: [],
  sharedBlocks: [],
  colorByActivityId: {},
  onClose: () => {},
};

describe("SharePlannerModal", () => {
  it("renders a checkbox per kid and pre-selects all", () => {
    render(<SharePlannerModal {...baseProps} />);
    expect(screen.getByLabelText(/maya/i)).toBeChecked();
    expect(screen.getByLabelText(/jonah/i)).toBeChecked();
  });

  it("defaults both Include opt-ins to OFF", () => {
    render(<SharePlannerModal {...baseProps} />);
    expect(screen.getByLabelText(/cost paid/i)).not.toBeChecked();
    expect(screen.getByLabelText(/non-activity block details/i)).not.toBeChecked();
  });

  it("disables 'Share a live link' when no kid is selected", () => {
    render(<SharePlannerModal {...baseProps} />);
    fireEvent.click(screen.getByLabelText(/maya/i));
    fireEvent.click(screen.getByLabelText(/jonah/i));
    const linkBtn = screen.getByRole("button", { name: /share a live link/i });
    expect(linkBtn).toBeDisabled();
  });
});
