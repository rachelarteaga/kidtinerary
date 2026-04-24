import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActivityPickerSection } from "@/components/planner/activity-picker-section";
import type { UserCampWithActivity } from "@/lib/queries";

function makeActivity(overrides: Partial<UserCampWithActivity> = {}): UserCampWithActivity {
  return {
    id: "uc-1",
    color: "#f4b76f",
    plannerEntryCount: 0,
    activity: {
      id: "act-1",
      name: "Camp Kanata",
      verified: false,
      organization: { id: "org-1", name: "YMCA of the Triangle" },
    },
    ...overrides,
  } as UserCampWithActivity;
}

describe("ActivityPickerSection", () => {
  it("renders nothing when the list is empty", () => {
    const { container } = render(
      <ActivityPickerSection activities={[]} onPick={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a section header when activities exist", () => {
    render(
      <ActivityPickerSection activities={[makeActivity()]} onPick={() => {}} />
    );
    expect(screen.getByText(/from my activities/i)).toBeInTheDocument();
  });

  it("renders one row per activity with name and org", () => {
    render(
      <ActivityPickerSection
        activities={[
          makeActivity(),
          makeActivity({
            id: "uc-2",
            activity: {
              id: "act-2",
              name: "Robotics",
              verified: true,
              organization: { id: "org-2", name: "Blue Ridge School" },
            },
          }),
        ]}
        onPick={() => {}}
      />
    );
    expect(screen.getByText("Camp Kanata")).toBeInTheDocument();
    expect(screen.getByText("YMCA of the Triangle")).toBeInTheDocument();
    expect(screen.getByText("Robotics")).toBeInTheDocument();
    expect(screen.getByText("Blue Ridge School")).toBeInTheDocument();
  });

  it("hides org when it matches the activity name or equals 'User-submitted'", () => {
    render(
      <ActivityPickerSection
        activities={[
          makeActivity({
            activity: {
              id: "act-a",
              name: "Match",
              verified: false,
              organization: { id: "o-a", name: "Match" },
            },
          }),
          makeActivity({
            id: "uc-b",
            activity: {
              id: "act-b",
              name: "Hidden",
              verified: false,
              organization: { id: "o-b", name: "User-submitted" },
            },
          }),
        ]}
        onPick={() => {}}
      />
    );
    expect(screen.queryByText(/user-submitted/i)).toBeNull();
    // "Match" appears once (as the name), not twice.
    expect(screen.getAllByText("Match")).toHaveLength(1);
  });

  it("calls onPick with the userCampId when a row is tapped", () => {
    const onPick = vi.fn();
    render(
      <ActivityPickerSection
        activities={[makeActivity({ id: "uc-42" })]}
        onPick={onPick}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /camp kanata/i }));
    expect(onPick).toHaveBeenCalledWith("uc-42");
  });

  it("shows verified badge and placement count when present", () => {
    render(
      <ActivityPickerSection
        activities={[
          makeActivity({
            plannerEntryCount: 3,
            activity: {
              id: "act-v",
              name: "Robotics Intensive",
              verified: true,
              organization: { id: "o-v", name: "Some Org" },
            },
          }),
        ]}
        onPick={() => {}}
      />
    );
    expect(screen.getByText("3x")).toBeInTheDocument();
    expect(screen.getByText(/verified/i)).toBeInTheDocument();
  });
});
