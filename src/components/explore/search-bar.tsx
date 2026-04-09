"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/constants";
import { categoryLabel } from "@/lib/format";

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

  const handleSearch = useCallback(async () => {
    const params = new URLSearchParams();
    if (keyword.trim()) params.set("q", keyword.trim());
    if (category) params.set("category", category);
    if (ageMin) params.set("age_min", ageMin);
    if (ageMax) params.set("age_max", ageMax);

    if (address.trim()) {
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

    router.push(`/explore?${params.toString()}`);
  }, [keyword, category, ageMin, ageMax, address, radius, router]);

  return (
    <div className="bg-white rounded-2xl border border-driftwood/30 shadow-sm p-4 sm:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Keyword */}
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wide text-stone mb-1.5">
            Search
          </label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Soccer, art, STEM..."
            className="w-full px-3 py-2 rounded-lg border border-driftwood/50 bg-cream/50 text-bark placeholder:text-driftwood text-sm focus:outline-none focus:border-sunset focus:ring-1 focus:ring-sunset/30"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wide text-stone mb-1.5">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-driftwood/50 bg-cream/50 text-bark text-sm focus:outline-none focus:border-sunset focus:ring-1 focus:ring-sunset/30"
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
            <label className="block font-mono text-[10px] uppercase tracking-wide text-stone mb-1.5">
              Age Min
            </label>
            <input
              type="number"
              min={3}
              max={12}
              value={ageMin}
              onChange={(e) => setAgeMin(e.target.value)}
              placeholder="3"
              className="w-full px-3 py-2 rounded-lg border border-driftwood/50 bg-cream/50 text-bark text-sm focus:outline-none focus:border-sunset focus:ring-1 focus:ring-sunset/30"
            />
          </div>
          <div className="flex-1">
            <label className="block font-mono text-[10px] uppercase tracking-wide text-stone mb-1.5">
              Age Max
            </label>
            <input
              type="number"
              min={3}
              max={12}
              value={ageMax}
              onChange={(e) => setAgeMax(e.target.value)}
              placeholder="12"
              className="w-full px-3 py-2 rounded-lg border border-driftwood/50 bg-cream/50 text-bark text-sm focus:outline-none focus:border-sunset focus:ring-1 focus:ring-sunset/30"
            />
          </div>
        </div>

        {/* Search button */}
        <div className="flex items-end">
          <Button onClick={handleSearch} className="w-full" disabled={geocoding}>
            {geocoding ? "Searching..." : "Search"}
          </Button>
        </div>
      </div>

      {/* Address + Radius row */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Address input */}
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wide text-stone mb-1.5">
            Near Address
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-driftwood pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </span>
            <input
              type="text"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setGeocodeError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Your address or zip code"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-driftwood/50 bg-cream/50 text-bark placeholder:text-driftwood text-sm focus:outline-none focus:border-sunset focus:ring-1 focus:ring-sunset/30"
            />
          </div>
          {geocodeError && (
            <p className="mt-1 font-mono text-[10px] text-sunset">{geocodeError}</p>
          )}
        </div>

        {/* Radius pill buttons */}
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wide text-stone mb-1.5">
            Radius
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {RADIUS_OPTIONS.map((mi) => (
              <button
                key={mi}
                type="button"
                onClick={() => setRadius(mi)}
                className={`px-3 py-1.5 rounded-full font-mono text-xs transition-colors ${
                  radius === mi
                    ? "bg-sunset text-white"
                    : "bg-cream border border-driftwood/50 text-bark hover:border-sunset/50"
                }`}
              >
                {mi} mi
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
