import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SharedCampDetailPanel } from "@/components/planner/shared-camp-detail-panel";

const camp = {
  org: "Happy Trails Nature Co.",
  name: "Happy Trails Nature Camp",
  location: "Rock Creek Park\n5200 Glover Rd NW, Washington DC",
  url: "https://happytrailsdc.com/summer",
  about: "Full-day outdoor adventure camp. Ages 5–9.",
};

describe("SharedCampDetailPanel", () => {
  it("returns nothing when closed", () => {
    const { container } = render(<SharedCampDetailPanel open={false} onClose={() => {}} camp={camp} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders org, name, location, link, and about when open", () => {
    render(<SharedCampDetailPanel open onClose={() => {}} camp={camp} />);
    expect(screen.getByText(camp.org)).toBeInTheDocument();
    expect(screen.getByText(camp.name)).toBeInTheDocument();
    expect(screen.getByText(/rock creek park/i)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", camp.url);
    expect(screen.getByText(/outdoor adventure/i)).toBeInTheDocument();
  });

  it("hides the Link section when url is null", () => {
    render(<SharedCampDetailPanel open onClose={() => {}} camp={{ ...camp, url: null }} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows cost only when weeklyCostCents is provided", () => {
    const { rerender } = render(<SharedCampDetailPanel open onClose={() => {}} camp={camp} />);
    expect(screen.queryByText(/\/ week/)).toBeNull();

    rerender(<SharedCampDetailPanel open onClose={() => {}} camp={{ ...camp, weeklyCostCents: 45000 }} />);
    expect(screen.getByText(/\$450 \/ week/)).toBeInTheDocument();
  });
});
