"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/constants";
import { categoryLabel } from "@/lib/format";
import { AddressInput } from "@/components/explore/address-input";

const RADIUS_OPTIONS = [5, 10, 15, 20, 30] as const;
const DEFAULT_RADIUS = 20;

export function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [keyword, setKeyword] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [ageMin, setAgeMin] = useState(searchParams.get("age_min") ?? "");
  const [ageMax, setAgeMax] = useState(searchParams.get("age_max") ?? "");
  const [address, setAddress] = useState(searchParams.get("address") ?? "");
  const [radius, setRadius] = useState<number>(
    searchParams.get("radius") ? parseInt(searchParams.get("radius")!, 10) : DEFAULT_RADIUS
  );
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  // Pre-filled lat/lng from autocomplete selection (avoids geocoding on search)
  const [selectedLat, setSelectedLat] = useState<number | null>(
    searchParams.get("lat") ? parseFloat(searchParams.get("lat")!) : null
  );
  const [selectedLng, setSelectedLng] = useState<number | null>(
    searchParams.get("lng") ? parseFloat(searchParams.get("lng")!) : null
  );

  const handleSearch = useCallback(async () => {
    const params = new URLSearchParams();
    if (keyword.trim()) params.set("q", keyword.trim());
    if (category) params.set("category", category);
    if (ageMin) params.set("age_min", ageMin);
    if (ageMax) params.set("age_max", ageMax);

    if (address.trim()) {
      // If autocomplete already provided lat/lng, use them directly
      if (selectedLat != null && selectedLng != null) {
        params.set("address", address.trim());
        params.set("lat", selectedLat.toString());
        params.set("lng", selectedLng.toString());
        params.set("radius", radius.toString());
      } else {
        // Fallback: geocode on submit
        setGeocoding(true);
        setGeocodeError(null);
        try {
          const res = await fetch(
            `/api/geocode?address=${encodeURIComponent(address.trim())}`
          );
          if (res.ok) {
            const geo = await res.json();
            params.set("address", address.trim());
            params.set("lat", geo.lat.toString());
            params.set("lng", geo.lng.toString());
            params.set("radius", radius.toString());
          } else {
            setGeocodeError("Address not found. Try a more specific address or zip code.");
            setGeocoding(false);
            return;
          }
        } catch {
          setGeocodeError("Could not geocode address. Please try again.");
          setGeocoding(false);
          return;
        }
        setGeocoding(false);
      }
    }

    router.push(`/explore?${params.toString()}`);
  }, [keyword, category, ageMin, ageMax, address, selectedLat, selectedLng, radius, router]);

  return (
    <div className="bg-surface rounded-2xl border border-ink-3 shadow-sm p-4 sm:p-6">
      {/* Row 1: Keyword + Category + Age Range */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Keyword */}
        <div>
          <label className="block font-sans text-[10px] uppercase tracking-wide text-ink-2 mb-1.5">
            Search
          </label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Soccer, art, STEM..."
            className="w-full px-3 py-2 rounded-lg border border-ink-3 bg-surface/50 text-ink placeholder:text-ink-3 text-sm focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink/30"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block font-sans text-[10px] uppercase tracking-wide text-ink-2 mb-1.5">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-ink-3 bg-surface/50 text-ink text-sm focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink/30"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {categoryLabel(cat)}
              </option>
            ))}
          </select>
        </div>

        {/* Age Range */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block font-sans text-[10px] uppercase tracking-wide text-ink-2 mb-1.5">
              Age Min
            </label>
            <input
              type="number"
              min={3}
              max={12}
              value={ageMin}
              onChange={(e) => setAgeMin(e.target.value)}
              placeholder="3"
              className="w-full px-3 py-2 rounded-lg border border-ink-3 bg-surface/50 text-ink text-sm focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink/30"
            />
          </div>
          <div className="flex-1">
            <label className="block font-sans text-[10px] uppercase tracking-wide text-ink-2 mb-1.5">
              Age Max
            </label>
            <input
              type="number"
              min={3}
              max={12}
              value={ageMax}
              onChange={(e) => setAgeMax(e.target.value)}
              placeholder="12"
              className="w-full px-3 py-2 rounded-lg border border-ink-3 bg-surface/50 text-ink text-sm focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink/30"
            />
          </div>
        </div>
      </div>

      {/* Row 2: Address + Radius */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Address input with autocomplete */}
        <div>
          <label className="block font-sans text-[10px] uppercase tracking-wide text-ink-2 mb-1.5">
            Near Address
          </label>
          <AddressInput
            value={address}
            onChange={(val) => {
              setAddress(val);
              setSelectedLat(null);
              setSelectedLng(null);
              setGeocodeError(null);
            }}
            onSelect={(formatted, lat, lng) => {
              setAddress(formatted);
              setSelectedLat(lat);
              setSelectedLng(lng);
              setGeocodeError(null);
            }}
            onError={setGeocodeError}
          />
          {geocodeError && (
            <p className="mt-1 font-sans text-[10px] text-ink">{geocodeError}</p>
          )}
        </div>

        {/* Radius pill buttons */}
        <div>
          <label className="block font-sans text-[10px] uppercase tracking-wide text-ink-2 mb-1.5">
            Radius
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {RADIUS_OPTIONS.map((mi) => (
              <button
                key={mi}
                type="button"
                onClick={() => setRadius(mi)}
                className={`px-3 py-1.5 rounded-full font-sans text-xs transition-colors ${
                  radius === mi
                    ? "bg-ink text-ink-inverse"
                    : "bg-surface border border-ink-3 text-ink hover:border-ink/50"
                }`}
              >
                {mi} mi
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Full-width search button */}
      <div className="mt-4">
        <Button onClick={handleSearch} className="w-full py-3 text-sm" disabled={geocoding}>
          {geocoding ? "Searching..." : "Search Activities"}
        </Button>
      </div>
    </div>
  );
}
