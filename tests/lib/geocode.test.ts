import { describe, it, expect, vi, beforeEach } from "vitest";
import { geocodeAddress, type GeoResult } from "@/lib/geocode";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("geocodeAddress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
  });

  it("returns lat/lng for a valid address", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            geometry: {
              location: { lat: 35.7796, lng: -78.6382 },
            },
            formatted_address: "Raleigh, NC 27601, USA",
          },
        ],
        status: "OK",
      }),
    });

    const result = await geocodeAddress("Raleigh, NC");

    expect(result).toEqual({
      lat: 35.7796,
      lng: -78.6382,
      formatted_address: "Raleigh, NC 27601, USA",
    });
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("returns null for an invalid address", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [],
        status: "ZERO_RESULTS",
      }),
    });

    const result = await geocodeAddress("asdfghjkl not a real place");
    expect(result).toBeNull();
  });

  it("returns null when API errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
    });

    const result = await geocodeAddress("Raleigh, NC");
    expect(result).toBeNull();
  });
});
