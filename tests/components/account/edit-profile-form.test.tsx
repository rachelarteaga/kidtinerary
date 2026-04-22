import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditProfileForm } from "@/components/account/edit-profile-form";

vi.mock("@/lib/actions", () => ({ updateProfile: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe("EditProfileForm", () => {
  const initial = {
    fullName: "Rachel",
    email: "rachel@example.com",
    address: "123 Main St",
    phone: "+15555551234",
  };

  it("prefills name, address, and phone; shows email read-only", () => {
    render(<EditProfileForm initial={initial} />);
    expect(screen.getByDisplayValue("Rachel")).toBeInTheDocument();
    expect(screen.getByDisplayValue("123 Main St")).toBeInTheDocument();
    expect(screen.getByDisplayValue("+15555551234")).toBeInTheDocument();

    const emailInput = screen.getByDisplayValue("rachel@example.com");
    expect(emailInput).toHaveAttribute("readonly");
  });

  it("renders the 'contact support' hint for email", () => {
    render(<EditProfileForm initial={initial} />);
    expect(screen.getByText(/contact support/i)).toBeInTheDocument();
  });
});
