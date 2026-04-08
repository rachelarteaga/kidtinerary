"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface SortBarProps {
  total: number;
}

export function SortBar({ total }: SortBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort") ?? "name";

  function handleSort(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    params.delete("page");
    router.push(`/explore?${params.toString()}`);
  }

  return (
    <div className="flex items-center justify-between mb-4">
      <p className="font-mono text-xs text-stone uppercase tracking-wide">
        {total} {total === 1 ? "activity" : "activities"} found
      </p>
      <div className="flex items-center gap-2">
        <label className="font-mono text-[10px] text-stone uppercase tracking-wide">
          Sort by
        </label>
        <select
          value={currentSort}
          onChange={(e) => handleSort(e.target.value)}
          className="px-2 py-1 rounded-lg border border-driftwood/50 bg-cream/50 text-bark text-xs focus:outline-none focus:border-sunset"
        >
          <option value="name">Name</option>
          <option value="price_low">Price: Low to High</option>
          <option value="price_high">Price: High to Low</option>
        </select>
      </div>
    </div>
  );
}
