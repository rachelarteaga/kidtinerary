"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CATEGORIES, INDOOR_OUTDOOR, TIME_SLOTS } from "@/lib/constants";
import { categoryLabel, formatTimeSlot } from "@/lib/format";

export function FilterSidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page"); // Reset to page 1 on filter change
    router.push(`/explore?${params.toString()}`);
  }

  function toggleCategory(cat: string) {
    const current = searchParams.get("categories")?.split(",").filter(Boolean) ?? [];
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    updateParam("categories", next.join(","));
  }

  const activeCategories = searchParams.get("categories")?.split(",").filter(Boolean) ?? [];
  const activeIndoorOutdoor = searchParams.get("indoor_outdoor") ?? "";
  const activeTimeSlot = searchParams.get("time_slot") ?? "";

  const activeRadius = searchParams.get("radius") ? parseInt(searchParams.get("radius")!, 10) : 20;
  const hasLocation = !!searchParams.get("lat");

  const hasFilters = activeCategories.length > 0 || activeIndoorOutdoor || activeTimeSlot;

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("categories");
    params.delete("indoor_outdoor");
    params.delete("time_slot");
    params.delete("page");
    router.push(`/explore?${params.toString()}`);
  }

  const RADIUS_OPTIONS = [5, 10, 15, 20, 30] as const;

  function setRadius(mi: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("radius", mi.toString());
    params.delete("page");
    router.push(`/explore?${params.toString()}`);
  }

  return (
    <aside className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-sans text-xs uppercase tracking-widest text-ink-2">Filters</h3>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="font-sans text-[10px] uppercase tracking-wide text-ink hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Categories */}
      <div>
        <h4 className="font-sans text-[10px] uppercase tracking-wide text-ink-2 mb-2">
          Category
        </h4>
        <div className="space-y-1">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategories.includes(cat);
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

      {/* Indoor/Outdoor */}
      <div>
        <h4 className="font-sans text-[10px] uppercase tracking-wide text-ink-2 mb-2">
          Setting
        </h4>
        <div className="space-y-1">
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

      {/* Time Slot */}
      <div>
        <h4 className="font-sans text-[10px] uppercase tracking-wide text-ink-2 mb-2">
          Schedule
        </h4>
        <div className="space-y-1">
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

      {/* Radius (only shown when a location is active) */}
      {hasLocation && (
        <div>
          <h4 className="font-sans text-[10px] uppercase tracking-wide text-ink-2 mb-2">
            Radius
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {RADIUS_OPTIONS.map((mi) => (
              <button
                key={mi}
                type="button"
                onClick={() => setRadius(mi)}
                className={`px-3 py-1.5 rounded-full font-sans text-xs transition-colors ${
                  activeRadius === mi
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
    </aside>
  );
}
