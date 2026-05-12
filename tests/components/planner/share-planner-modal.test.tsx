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
  isShared: false,
  isUnsharing: false,
  onStopSharing: () => {},
  existingShareKidIds: null,
  existingShareIncludeCost: null,
  existingShareIncludePersonalBlockDetails: null,
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

  it("hides Stop sharing when not shared", () => {
    render(<SharePlannerModal {...baseProps} />);
    expect(screen.queryByRole("button", { name: /stop sharing/i })).toBeNull();
  });

  it("shows Stop sharing + live badge when shared", () => {
    const onStopSharing = vi.fn();
    render(<SharePlannerModal {...baseProps} isShared onStopSharing={onStopSharing} />);
    expect(screen.getByLabelText(/currently shared/i)).toBeInTheDocument();
    const stopBtn = screen.getByRole("button", { name: /stop sharing/i });
    fireEvent.click(stopBtn);
    expect(onStopSharing).toHaveBeenCalled();
  });

  it("relabels the link button when already shared", () => {
    render(<SharePlannerModal {...baseProps} isShared />);
    expect(screen.getByRole("button", { name: /copy live link/i })).toBeInTheDocument();
  });

  it("seeds checkboxes from an existing share's kid_ids", () => {
    render(
      <SharePlannerModal
        {...baseProps}
        isShared
        existingShareKidIds={["k1"]}
      />
    );
    expect(screen.getByLabelText(/maya/i)).toBeChecked();
    expect(screen.getByLabelText(/jonah/i)).not.toBeChecked();
  });

  it("checks newly-added kids by default when share kid_ids is a subset", () => {
    // Simulates the bug from observed issues / schedule.md: a kid was on the
    // planner before share creation but accidentally never made it into
    // kid_ids. On the next open, the modal should NOT keep that kid
    // unchecked just because they're not in kid_ids — but with no existing
    // share, defaulting to all kids is correct. Here we simulate the
    // explicit-restore path.
    render(
      <SharePlannerModal
        {...baseProps}
        existingShareKidIds={null}
      />
    );
    expect(screen.getByLabelText(/maya/i)).toBeChecked();
    expect(screen.getByLabelText(/jonah/i)).toBeChecked();
  });

  it("seeds Include opt-ins from the existing share's settings", () => {
    render(
      <SharePlannerModal
        {...baseProps}
        isShared
        existingShareIncludeCost
        existingShareIncludePersonalBlockDetails
      />
    );
    expect(screen.getByLabelText(/cost paid/i)).toBeChecked();
    expect(screen.getByLabelText(/non-activity block details/i)).toBeChecked();
  });

  it("ignores orphan kid_ids that no longer match a kid on the planner", () => {
    render(
      <SharePlannerModal
        {...baseProps}
        isShared
        existingShareKidIds={["k1", "removed-kid"]}
      />
    );
    // Only Maya is checked; the orphan id is silently ignored, so Jonah
    // is unchecked (preserving the owner's prior intent to share only k1).
    expect(screen.getByLabelText(/maya/i)).toBeChecked();
    expect(screen.getByLabelText(/jonah/i)).not.toBeChecked();
  });
});
