"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { FilterChip } from "./filter-chip";
import { parseFilterState, serializeFilterState } from "@/lib/catalog-filters";

interface Props {
  value?: "me" | "friends";
}

function buildLabel(value?: "me" | "friends"): string {
  if (!value) return "All sources";
  if (value === "me") return "Added by me";
  return "From friends";
}

export function SourceFilter({ value }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active = Boolean(value);
  const label = buildLabel(value);

  function applyChange(next: "me" | "friends" | undefined) {
    const current = parseFilterState(new URLSearchParams(searchParams.toString()));
    const nextState = { ...current, source: next };
    const params = serializeFilterState(nextState);
    const sort = searchParams.get("sort");
    if (sort) params.set("sort", sort);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <FilterChip label={label} active={active}>
      <div className="space-y-0.5">
        <label className="flex items-center gap-2 py-1.5 cursor-pointer text-sm text-ink">
          <input
            type="radio"
            name="source-filter"
            checked={!value}
            onChange={() => applyChange(undefined)}
            className="accent-ink"
          />
          All sources
        </label>
        <label className="flex items-center gap-2 py-1.5 cursor-pointer text-sm text-ink">
          <input
            type="radio"
            name="source-filter"
            checked={value === "me"}
            onChange={() => applyChange("me")}
            className="accent-ink"
          />
          Added by me
        </label>
        <label className="flex items-center gap-2 py-1.5 cursor-pointer text-sm text-ink">
          <input
            type="radio"
            name="source-filter"
            checked={value === "friends"}
            onChange={() => applyChange("friends")}
            className="accent-ink"
          />
          From friends
        </label>
      </div>
    </FilterChip>
  );
}
