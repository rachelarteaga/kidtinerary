import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CampCard } from "@/components/activity/camp-card";
import type { ActivityRow } from "@/lib/queries";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock favorite button to avoid server action import
vi.mock("@/components/favorites/favorite-button", () => ({
  FavoriteButton: ({ activityId }: { activityId: string }) => (
    <button data-testid={`fav-${activityId}`}>fav</button>
  ),
}));

const mockActivity: ActivityRow = {
  id: "test-id",
  name: "Nature Explorers Camp",
  slug: "nature-explorers-camp",
  description: "A fun nature camp",
  categories: ["nature", "arts"],
  age_min: 5,
  age_max: 9,
  indoor_outdoor: "outdoor",
  registration_url: "https://example.com",
  data_confidence: "high",
  is_active: true,
  organization: { id: "org-1", name: "Raleigh Parks", website: null },
  activity_locations: [{ id: "loc-1", address: "123 Main St", location_name: "Central Park" }],
  sessions: [
    {
      id: "s-1",
      starts_at: "2026-06-15",
      ends_at: "2026-06-19",
      time_slot: "full_day",
      hours_start: "09:00",
      hours_end: "15:00",
      is_sold_out: false,
      spots_available: null,
    },
  ],
  price_options: [
    {
      id: "p-1",
      label: "Standard",
      price_cents: 28500,
      price_unit: "per_week",
      conditions: null,
      confidence: "verified",
    },
  ],
};

describe("CampCard", () => {
  it("renders activity name", () => {
    render(<CampCard activity={mockActivity} isFavorited={false} />);
    expect(screen.getByText("Nature Explorers Camp")).toBeInTheDocument();
  });

  it("renders organization name", () => {
    render(<CampCard activity={mockActivity} isFavorited={false} />);
    expect(screen.getByText("Raleigh Parks")).toBeInTheDocument();
  });

  it("renders price", () => {
    render(<CampCard activity={mockActivity} isFavorited={false} />);
    expect(screen.getByText("$285")).toBeInTheDocument();
  });

  it("renders age range tag", () => {
    render(<CampCard activity={mockActivity} isFavorited={false} />);
    expect(screen.getByText("Ages 5–9")).toBeInTheDocument();
  });

  it("links to activity detail page", () => {
    render(<CampCard activity={mockActivity} isFavorited={false} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/activity/nature-explorers-camp");
  });

  it("renders session count", () => {
    render(<CampCard activity={mockActivity} isFavorited={false} />);
    expect(screen.getByText(/1\s+session/)).toBeInTheDocument();
  });
});
