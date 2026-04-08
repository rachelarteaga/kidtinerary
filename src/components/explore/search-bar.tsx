"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/constants";
import { categoryLabel } from "@/lib/format";

export function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [keyword, setKeyword] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [ageMin, setAgeMin] = useState(searchParams.get("age_min") ?? "");
  const [ageMax, setAgeMax] = useState(searchParams.get("age_max") ?? "");

  const handleSearch = useCallback(() => {
    const params = new URLSearchParams();
    if (keyword.trim()) params.set("q", keyword.trim());
    if (category) params.set("category", category);
    if (ageMin) params.set("age_min", ageMin);
    if (ageMax) params.set("age_max", ageMax);
    router.push(`/explore?${params.toString()}`);
  }, [keyword, category, ageMin, ageMax, router]);

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
          <Button onClick={handleSearch} className="w-full">
            Search
          </Button>
        </div>
      </div>
    </div>
  );
}
