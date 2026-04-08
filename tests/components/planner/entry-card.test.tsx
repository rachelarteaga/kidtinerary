import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlannerEntryCard } from "@/components/planner/entry-card";
import type { PlannerEntryRow } from "@/lib/queries";

// Mock server actions
vi.mock("@/lib/actions", () => ({
  updatePlannerEntryStatus: vi.fn().mockResolvedValue({ success: true }),
  updatePlannerEntryNotes: vi.fn().mockResolvedValue({ success: true }),
  removePlannerEntry: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock toast
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const mockEntry: PlannerEntryRow = {
  id: "entry-1",
  user_id: "user-1",
  child_id: "child-1",
  session_id: "session-1",
  status: "penciled_in",
  sort_order: 0,
  notes: null,
  created_at: "2026-04-01T00:00:00",
  session: {
    id: "session-1",
    starts_at: "2026-06-15",
    ends_at: "2026-06-19",
    time_slot: "full_day",
    hours_start: "09:00",
    hours_end: "15:00",
    is_sold_out: false,
    activity: {
      id: "activity-1",
      name: "Super Science Camp",
      slug: "super-science-camp",
      categories: ["stem"],
      registration_url: "https://example.com/register",
      organization: { id: "org-1", name: "STEM Co." },
      price_options: [
        { id: "price-1", label: "Weekly", price_cents: 30000, price_unit: "per_week" },
      ],
      activity_locations: [
        { id: "loc-1", address: "123 Main St", location_name: "Main Campus" },
      ],
    },
  },
};

describe("PlannerEntryCard", () => {
  const onEntryUpdated = vi.fn();
  const onEntryRemoved = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders activity name as a link to the detail page", () => {
    render(
      <PlannerEntryCard
        entry={mockEntry}
        isGreyedOut={false}
        onEntryUpdated={onEntryUpdated}
        onEntryRemoved={onEntryRemoved}
      />
    );
    const link = screen.getByRole("link", { name: /Super Science Camp/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/activity/super-science-camp");
  });

  it("shows 'Penciled In' status button when status is penciled_in", () => {
    render(
      <PlannerEntryCard
        entry={mockEntry}
        isGreyedOut={false}
        onEntryUpdated={onEntryUpdated}
        onEntryRemoved={onEntryRemoved}
      />
    );
    expect(screen.getByRole("button", { name: /Penciled In/i })).toBeInTheDocument();
  });

  it("shows 'Locked In' status button when status is locked_in", () => {
    render(
      <PlannerEntryCard
        entry={{ ...mockEntry, status: "locked_in" }}
        isGreyedOut={false}
        onEntryUpdated={onEntryUpdated}
        onEntryRemoved={onEntryRemoved}
      />
    );
    expect(screen.getByRole("button", { name: /Locked In/i })).toBeInTheDocument();
  });

  it("renders price tag from price_options", () => {
    render(
      <PlannerEntryCard
        entry={mockEntry}
        isGreyedOut={false}
        onEntryUpdated={onEntryUpdated}
        onEntryRemoved={onEntryRemoved}
      />
    );
    // $300/week — price_cents=30000 → $300
    expect(screen.getByText(/\$300\/week/i)).toBeInTheDocument();
  });

  it("renders time slot tag", () => {
    render(
      <PlannerEntryCard
        entry={mockEntry}
        isGreyedOut={false}
        onEntryUpdated={onEntryUpdated}
        onEntryRemoved={onEntryRemoved}
      />
    );
    expect(screen.getByText(/Full Day/i)).toBeInTheDocument();
  });

  it("applies opacity-50 when isGreyedOut is true and not locked in", () => {
    const { container } = render(
      <PlannerEntryCard
        entry={mockEntry}
        isGreyedOut={true}
        onEntryUpdated={onEntryUpdated}
        onEntryRemoved={onEntryRemoved}
      />
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("opacity-50");
  });

  it("does NOT apply opacity-50 when isGreyedOut is false", () => {
    const { container } = render(
      <PlannerEntryCard
        entry={mockEntry}
        isGreyedOut={false}
        onEntryUpdated={onEntryUpdated}
        onEntryRemoved={onEntryRemoved}
      />
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).not.toContain("opacity-50");
  });

  it("shows notes textarea after clicking 'Add note'", () => {
    render(
      <PlannerEntryCard
        entry={mockEntry}
        isGreyedOut={false}
        onEntryUpdated={onEntryUpdated}
        onEntryRemoved={onEntryRemoved}
      />
    );
    const noteBtn = screen.getByText(/Add note/i);
    fireEvent.click(noteBtn);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders remove button", () => {
    render(
      <PlannerEntryCard
        entry={mockEntry}
        isGreyedOut={false}
        onEntryUpdated={onEntryUpdated}
        onEntryRemoved={onEntryRemoved}
      />
    );
    expect(screen.getByRole("button", { name: /Remove from plan/i })).toBeInTheDocument();
  });

  it("pre-opens notes textarea when entry already has notes", () => {
    render(
      <PlannerEntryCard
        entry={{ ...mockEntry, notes: "Bring sunscreen" }}
        isGreyedOut={false}
        onEntryUpdated={onEntryUpdated}
        onEntryRemoved={onEntryRemoved}
      />
    );
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Bring sunscreen");
  });
});
