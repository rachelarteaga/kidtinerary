"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { FilterChip } from "./filter-chip";
import { parseFilterState, serializeFilterState } from "@/lib/catalog-filters";
import { CATEGORIES } from "@/lib/constants";
import { categoryLabel } from "@/lib/format";

interface Props {
  value?: string[];
}

function buildLabel(value?: string[]): string {
  if (!value || value.length === 0) return "All categories";
  if (value.length === 1) return categoryLabel(value[0]);
  if (value.length === 2) return `${categoryLabel(value[0])}, ${categoryLabel(value[1])}`;
  return `${categoryLabel(value[0])}, ${categoryLabel(value[1])} +${value.length - 2}`;
}

export function CategoryFilter({ value }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active = Boolean(value && value.length > 0);
  const label = buildLabel(value);

  function toggle(cat: string) {
    const current = parseFilterState(new URLSearchParams(searchParams.toString()));
    const existing = current.categories ?? [];
    const next = existing.includes(cat)
      ? existing.filter((c) => c !== cat)
      : [...existing, cat];
    const nextState = {
      ...current,
      categories: next.length > 0 ? next : undefined,
    };
    const params = serializeFilterState(nextState);
    const sort = searchParams.get("sort");
    if (sort) params.set("sort", sort);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function clearAll() {
    const current = parseFilterState(new URLSearchParams(searchParams.toString()));
    const nextState = { ...current, categories: undefined };
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
            name="category-filter-all"
            checked={selected.length === 0}
            onChange={clearAll}
            className="accent-ink"
          />
          All categories
        </label>

        <div className="border-t border-ink-3 my-1" />

        <div className="max-h-72 overflow-y-auto">
          {CATEGORIES.map((cat) => (
            <label key={cat} className="flex items-center gap-2 py-1.5 cursor-pointer text-sm text-ink">
              <input
                type="checkbox"
                checked={selected.includes(cat)}
                onChange={() => toggle(cat)}
                className="accent-ink"
              />
              {categoryLabel(cat)}
            </label>
          ))}
        </div>
      </div>
    </FilterChip>
  );
}
