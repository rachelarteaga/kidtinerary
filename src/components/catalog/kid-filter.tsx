"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { FilterChip } from "./filter-chip";
import { parseFilterState, serializeFilterState } from "@/lib/catalog-filters";

interface Props {
  kids: { id: string; name: string }[];
  value?: string[];
}

function buildLabel(kids: { id: string; name: string }[], value?: string[]): string {
  if (!value || value.length === 0) return "All kids";

  const kidNames = value
    .filter((id) => id !== "__unassigned")
    .map((id) => kids.find((k) => k.id === id)?.name)
    .filter((n): n is string => Boolean(n));

  const hasUnassigned = value.includes("__unassigned");
  const allNames = hasUnassigned ? [...kidNames, "Unassigned"] : kidNames;

  if (allNames.length === 0) return "All kids";
  if (allNames.length === 1) return allNames[0];
  if (allNames.length === 2) return `${allNames[0]}, ${allNames[1]}`;
  return `${allNames[0]}, ${allNames[1]} +${allNames.length - 2}`;
}

export function KidFilter({ kids, value }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active = Boolean(value && value.length > 0);
  const label = buildLabel(kids, value);

  function toggle(kidId: string) {
    const current = parseFilterState(new URLSearchParams(searchParams.toString()));
    const existing = current.kidIds ?? [];
    const next = existing.includes(kidId)
      ? existing.filter((id) => id !== kidId)
      : [...existing, kidId];
    const nextState = { ...current, kidIds: next.length > 0 ? next : undefined };
    const params = serializeFilterState(nextState);
    // preserve sort param (not managed by filterState)
    const sort = searchParams.get("sort");
    if (sort) params.set("sort", sort);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function clearAll() {
    const current = parseFilterState(new URLSearchParams(searchParams.toString()));
    const nextState = { ...current, kidIds: undefined };
    const params = serializeFilterState(nextState);
    const sort = searchParams.get("sort");
    if (sort) params.set("sort", sort);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const selected = value ?? [];

  return (
    <FilterChip label={label} active={active}>
      <div className="space-y-0.5">
        {/* All kids reset */}
        <label className="flex items-center gap-2 py-1.5 cursor-pointer text-sm text-ink">
          <input
            type="radio"
            name="kid-filter-all"
            checked={selected.length === 0}
            onChange={clearAll}
            className="accent-ink"
          />
          All kids
        </label>

        <div className="border-t border-ink-3 my-1" />

        {/* Per-kid checkboxes */}
        {kids.map((kid) => (
          <label key={kid.id} className="flex items-center gap-2 py-1.5 cursor-pointer text-sm text-ink">
            <input
              type="checkbox"
              checked={selected.includes(kid.id)}
              onChange={() => toggle(kid.id)}
              className="accent-ink"
            />
            {kid.name}
          </label>
        ))}

        {/* Unassigned */}
        <label className="flex items-center gap-2 py-1.5 cursor-pointer text-sm text-ink">
          <input
            type="checkbox"
            checked={selected.includes("__unassigned")}
            onChange={() => toggle("__unassigned")}
            className="accent-ink"
          />
          <span className="italic text-ink-2">Unassigned</span>
        </label>
      </div>
    </FilterChip>
  );
}
