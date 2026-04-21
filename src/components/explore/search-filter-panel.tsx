"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CATEGORIES, INDOOR_OUTDOOR, TIME_SLOTS } from "@/lib/constants";
import { categoryLabel, formatTimeSlot } from "@/lib/format";
import { AddressInput } from "@/components/explore/address-input";

const RADIUS_OPTIONS = [5, 10, 15, 20, 30] as const;
const DEFAULT_RADIUS = 20;

export function SearchFilterPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Search state
  const [keyword, setKeyword] = useState(searchParams.get("q") ?? "");
  const [address, setAddress] = useState(searchParams.get("address") ?? "");
  const [radius, setRadius] = useState<number>(
    searchParams.get("radius") ? parseInt(searchParams.get("radius")!, 10) : DEFAULT_RADIUS
  );
  const [selectedLat, setSelectedLat] = useState<number | null>(
    searchParams.get("lat") ? parseFloat(searchParams.get("lat")!) : null
  );
  const [selectedLng, setSelectedLng] = useState<number | null>(
    searchParams.get("lng") ? parseFloat(searchParams.get("lng")!) : null
  );
  const [childAge, setChildAge] = useState(searchParams.get("age") ?? "");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  // Filter state (applied instantly via URL)
  const activeCategories = searchParams.get("categories")?.split(",").filter(Boolean) ?? [];
  const activeCategory = searchParams.get("category") ?? "";
  const activeIndoorOutdoor = searchParams.get("indoor_outdoor") ?? "";
  const activeTimeSlot = searchParams.get("time_slot") ?? "";
  const currentSort = searchParams.get("sort") ?? "name";

  const hasFilters = activeCategories.length > 0 || activeCategory || activeIndoorOutdoor || activeTimeSlot;

  // Instant filter updates (no search button needed)
  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`/explore?${params.toString()}`);
  }

  function toggleCategory(cat: string) {
    const current = searchParams.get("categories")?.split(",").filter(Boolean) ?? [];
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    updateParam("categories", next.join(","));
  }

  function clearAll() {
    const params = new URLSearchParams();
    // Preserve address/location if set
    if (searchParams.get("address")) params.set("address", searchParams.get("address")!);
    if (searchParams.get("lat")) params.set("lat", searchParams.get("lat")!);
    if (searchParams.get("lng")) params.set("lng", searchParams.get("lng")!);
    if (searchParams.get("radius")) params.set("radius", searchParams.get("radius")!);
    router.push(`/explore?${params.toString()}`);
  }

  // Search button handler (for keyword + address + age)
  const handleSearch = useCallback(async () => {
    const params = new URLSearchParams(searchParams.toString());

    // Update keyword
    if (keyword.trim()) {
      params.set("q", keyword.trim());
    } else {
      params.delete("q");
    }

    // Update child age
    if (childAge) { params.set("age", childAge); } else { params.delete("age"); }
    params.delete("age_min");
    params.delete("age_max");

    // Update address/location
    if (address.trim()) {
      if (selectedLat != null && selectedLng != null) {
        params.set("address", address.trim());
        params.set("lat", selectedLat.toString());
        params.set("lng", selectedLng.toString());
        params.set("radius", radius.toString());
      } else {
        setGeocoding(true);
        setGeocodeError(null);
        try {
          const res = await fetch(`/api/geocode?address=${encodeURIComponent(address.trim())}`);
          if (res.ok) {
            const geo = await res.json();
            params.set("address", address.trim());
            params.set("lat", geo.lat.toString());
            params.set("lng", geo.lng.toString());
            params.set("radius", radius.toString());
          } else {
            setGeocodeError("Address not found.");
            setGeocoding(false);
            return;
          }
        } catch {
          setGeocodeError("Could not geocode address.");
          setGeocoding(false);
          return;
        }
        setGeocoding(false);
      }
    } else {
      params.delete("address");
      params.delete("lat");
      params.delete("lng");
      params.delete("radius");
    }

    params.delete("page");
    router.push(`/explore?${params.toString()}`);
  }, [keyword, childAge, address, selectedLat, selectedLng, radius, searchParams, router]);

  const hasLocation = !!searchParams.get("lat");

  return (
    <aside className="space-y-5">
      {/* Keyword search */}
      <div>
        <label className="block font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-1.5">
          Search
        </label>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Soccer, art, STEM..."
          className="w-full px-3 py-2 rounded-lg border border-ink-3 bg-surface text-ink placeholder:text-ink-3 text-sm focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink/30"
        />
      </div>

      {/* Location */}
      <div>
        <label className="block font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-1.5">
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

      {/* Radius (only when location is set) */}
      {(hasLocation || selectedLat != null) && (
        <div>
          <label className="block font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-1.5">
            Radius
          </label>
          <div className="flex flex-wrap gap-1.5">
            {RADIUS_OPTIONS.map((mi) => (
              <button
                key={mi}
                type="button"
                onClick={() => setRadius(mi)}
                className={`px-2.5 py-1 rounded-full font-sans text-[11px] transition-colors ${
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
      )}

      {/* Child's age */}
      <div>
        <label className="block font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-1.5">
          Child&apos;s Age
        </label>
        <input
          type="number"
          min={3}
          max={18}
          value={childAge}
          onChange={(e) => setChildAge(e.target.value)}
          placeholder="e.g. 7"
          className="w-full px-3 py-2 rounded-lg border border-ink-3 bg-surface text-ink text-sm focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink/30"
        />
      </div>

      {/* Search button */}
      <Button onClick={handleSearch} className="w-full py-2.5" disabled={geocoding}>
        {geocoding ? "Searching..." : "Search"}
      </Button>

      {/* Divider */}
      <div className="border-t border-ink-3" />

      {/* Sort */}
      <div>
        <label className="block font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-1.5">
          Sort By
        </label>
        <select
          value={currentSort}
          onChange={(e) => updateParam("sort", e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-ink-3 bg-surface text-ink text-sm focus:outline-none focus:border-ink"
        >
          <option value="name">Name</option>
          <option value="price_low">Price: Low to High</option>
          <option value="price_high">Price: High to Low</option>
          {hasLocation && <option value="distance">Distance: Nearest</option>}
        </select>
      </div>

      {/* Categories */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-sans text-[10px] uppercase tracking-widest text-ink-2">
            Category
          </h4>
          {hasFilters && (
            <button
              onClick={clearAll}
              className="font-sans text-[10px] uppercase tracking-wide text-ink hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        <div className="space-y-0.5">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategories.includes(cat) || activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`block w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-ink/10 text-ink font-medium"
                    : "text-ink hover:bg-ink/5"
                }`}
              >
                {categoryLabel(cat)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Setting */}
      <div>
        <h4 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">
          Setting
        </h4>
        <div className="space-y-0.5">
          <button
            onClick={() => updateParam("indoor_outdoor", "")}
            className={`block w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
              !activeIndoorOutdoor ? "bg-ink/8 text-ink font-medium" : "text-ink hover:bg-ink/5"
            }`}
          >
            All
          </button>
          {INDOOR_OUTDOOR.map((io) => (
            <button
              key={io}
              onClick={() => updateParam("indoor_outdoor", io)}
              className={`block w-full text-left px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                activeIndoorOutdoor === io
                  ? "bg-ink/10 text-ink font-medium"
                  : "text-ink hover:bg-ink/5"
              }`}
            >
              {io}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule */}
      <div>
        <h4 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">
          Schedule
        </h4>
        <div className="space-y-0.5">
          <button
            onClick={() => updateParam("time_slot", "")}
            className={`block w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
              !activeTimeSlot ? "bg-ink/8 text-ink font-medium" : "text-ink hover:bg-ink/5"
            }`}
          >
            Any
          </button>
          {TIME_SLOTS.map((slot) => (
            <button
              key={slot}
              onClick={() => updateParam("time_slot", slot)}
              className={`block w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                activeTimeSlot === slot
                  ? "bg-ink/10 text-ink font-medium"
                  : "text-ink hover:bg-ink/5"
              }`}
            >
              {formatTimeSlot(slot)}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
