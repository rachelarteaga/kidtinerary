import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { AddressInput } from "@/components/explore/address-input";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AddressInput", () => {
  it("renders the input with placeholder", () => {
    render(
      <AddressInput
        value=""
        onChange={() => {}}
        onSelect={() => {}}
        placeholder="Enter address"
      />
    );
    expect(screen.getByPlaceholderText("Enter address")).toBeInTheDocument();
  });

  it("does not fetch for very short input", async () => {
    vi.useFakeTimers();
    render(
      <AddressInput value="ab" onChange={() => {}} onSelect={() => {}} />
    );
    await act(async () => {
      vi.runAllTimers();
    });
    expect(mockFetch).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("calls fetch after debounce with long enough input", async () => {
    vi.useFakeTimers();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        lat: 35.77,
        lng: -78.63,
        formatted_address: "Raleigh, NC, USA",
      }),
    });

    render(
      <AddressInput value="Raleigh NC" onChange={() => {}} onSelect={() => {}} />
    );

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    await act(async () => {
      // flush microtasks/promises
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/geocode?address=")
    );

    vi.useRealTimers();
  });

  it("shows suggestion after successful geocode", async () => {
    vi.useFakeTimers();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        lat: 35.77,
        lng: -78.63,
        formatted_address: "Raleigh, NC, USA",
      }),
    });

    render(
      <AddressInput value="Raleigh NC" onChange={() => {}} onSelect={() => {}} />
    );

    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });
    // flush promise chain from fetch mock
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Raleigh, NC, USA")).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("calls onSelect when suggestion is clicked", async () => {
    vi.useFakeTimers();
    const onSelect = vi.fn();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        lat: 35.77,
        lng: -78.63,
        formatted_address: "Raleigh, NC, USA",
      }),
    });

    render(
      <AddressInput value="Raleigh NC" onChange={() => {}} onSelect={onSelect} />
    );

    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const btn = screen.getByText("Raleigh, NC, USA");
    fireEvent.mouseDown(btn);

    expect(onSelect).toHaveBeenCalledWith("Raleigh, NC, USA", 35.77, -78.63);

    vi.useRealTimers();
  });

  it("closes dropdown on Escape key", async () => {
    vi.useFakeTimers();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        lat: 35.77,
        lng: -78.63,
        formatted_address: "Raleigh, NC, USA",
      }),
    });

    render(
      <AddressInput value="Raleigh NC" onChange={() => {}} onSelect={() => {}} />
    );

    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Raleigh, NC, USA")).toBeInTheDocument();

    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByText("Raleigh, NC, USA")).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
