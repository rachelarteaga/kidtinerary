"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { FilterChip } from "./filter-chip";
import { parseFilterState, serializeFilterState } from "@/lib/catalog-filters";
import type { FilterState } from "@/lib/catalog-filters";

type SeasonBucket = "this-summer" | "this-school-year" | "past" | "unknown";

interface Props {
  value?: SeasonBucket[];
}

const SEASON_OPTIONS: { value: SeasonBucket; label: string }[] = [
  { value: "this-summer", label: "This summer" },
  { value: "this-school-year", label: "This school year" },
  { value: "past", label: "Past" },
  { value: "unknown", label: "Date unknown" },
];

function buildLabel(value?: SeasonBucket[]): string {
  if (!value || value.length === 0) return "All seasons";
  if (value.length === 1) {
    return SEASON_OPTIONS.find((o) => o.value === value[0])?.label ?? "All seasons";
  }
  return `${value.length} seasons`;
}

export function SeasonFilter({ value }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active = Boolean(value && value.length > 0);
  const label = buildLabel(value);

  function toggle(bucket: SeasonBucket) {
    const current = parseFilterState(new URLSearchParams(searchParams.toString()));
    const existing = current.seasons ?? [];
    const next = existing.includes(bucket)
      ? existing.filter((s) => s !== bucket)
      : [...existing, bucket];
    const nextState: FilterState = {
      ...current,
      seasons: next.length > 0 ? next : undefined,
    };
    const params = serializeFilterState(nextState);
    const sort = searchParams.get("sort");
    if (sort) params.set("sort", sort);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function clearAll() {
    const current = parseFilterState(new URLSearchParams(searchParams.toString()));
    const nextState: FilterState = { ...current, seasons: undefined };
    const params = serializeFilterState(nextState);
    const sort = searchParams.get("sort");
    if (sort) params.set("sort", sort);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const selected = value ?? [];

  return (
    <FilterChip label={label} active={active}>
      <div className="space-y-0.5">
        <label className="flex items-center gap-2 py-1.5 cursor-pointer text-sm text-ink">
          <input
            type="radio"
            name="season-filter-all"
            checked={selected.length === 0}
            onChange={clearAll}
            className="accent-ink"
          />
          All seasons
        </label>

        <div className="border-t border-ink-3 my-1" />

        {SEASON_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 py-1.5 cursor-pointer text-sm text-ink">
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={() => toggle(opt.value)}
              className="accent-ink"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </FilterChip>
  );
}
