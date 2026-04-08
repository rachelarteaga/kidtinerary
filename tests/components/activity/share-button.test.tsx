import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ShareButton } from "@/components/activity/share-button";

describe("ShareButton", () => {
  beforeEach(() => {
    // Ensure a clean navigator state before each test
    Object.defineProperty(global, "navigator", {
      value: { share: undefined, clipboard: undefined },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders with label 'Share'", () => {
    render(<ShareButton title="Nature Camp" url="https://example.com/activity/nature-camp" />);
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
  });

  it("calls navigator.share when available", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global, "navigator", {
      value: { share: shareMock },
      writable: true,
      configurable: true,
    });

    render(<ShareButton title="Nature Camp" url="https://example.com/activity/nature-camp" />);
    fireEvent.click(screen.getByRole("button", { name: /share/i }));

    await waitFor(() => {
      expect(shareMock).toHaveBeenCalledWith({
        title: "Nature Camp",
        url: "https://example.com/activity/nature-camp",
      });
    });
  });

  it("copies to clipboard and shows 'Copied!' when share API is unavailable", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global, "navigator", {
      value: { clipboard: { writeText: writeTextMock } },
      writable: true,
      configurable: true,
    });

    render(<ShareButton title="Nature Camp" url="https://example.com/activity/nature-camp" />);
    fireEvent.click(screen.getByRole("button", { name: /share/i }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        "https://example.com/activity/nature-camp"
      );
    });

    expect(screen.getByRole("button", { name: /copied!/i })).toBeInTheDocument();
  });

  it("reverts from 'Copied!' back to 'Share' after timeout", async () => {
    vi.useFakeTimers();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global, "navigator", {
      value: { clipboard: { writeText: writeTextMock } },
      writable: true,
      configurable: true,
    });

    render(<ShareButton title="Nature Camp" url="https://example.com/activity/nature-camp" />);
    fireEvent.click(screen.getByRole("button", { name: /share/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /copied!/i })).toBeInTheDocument();
    });

    vi.advanceTimersByTime(2001);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
    });

    vi.useRealTimers();
  });
});
