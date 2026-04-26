"use client";

import { useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { AnchoredPopover } from "@/components/ui/anchored-popover";

const SORT_OPTIONS = [
  { value: "recents", label: "Recently added" },
  { value: "alpha", label: "A → Z" },
  { value: "deadline", label: "Registration deadline" },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]["value"];

interface Props {
  value: SortKey;
}

export function SortMenu({ value }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeLabel = SORT_OPTIONS.find((o) => o.value === value)?.label ?? "Recently added";

  function applySort(sortKey: SortKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (sortKey === "recents") {
      params.delete("sort");
    } else {
      params.set("sort", sortKey);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setOpen(false);
  }

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-sans text-[10px] font-semibold tracking-wide text-ink-2 border border-ink-3 rounded-full px-3 py-1.5 inline-flex items-center gap-1 hover:border-ink transition-colors whitespace-nowrap"
      >
        <span className="text-ink-2">Sort:</span>{" "}
        <span className="text-ink">{activeLabel}</span>{" "}
        <span aria-hidden className="text-ink-2">▾</span>
      </button>
      <AnchoredPopover
        anchorRef={ref}
        open={open}
        onClose={() => setOpen(false)}
        align="end"
        className="bg-surface border border-ink rounded-xl shadow-[3px_3px_0_0_rgba(0,0,0,0.12)] p-3 min-w-[200px]"
      >
        <div className="space-y-0.5">
          {SORT_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 py-1.5 cursor-pointer text-sm text-ink">
              <input
                type="radio"
                name="sort-menu"
                checked={value === opt.value}
                onChange={() => applySort(opt.value)}
                className="accent-ink"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </AnchoredPopover>
    </>
  );
}
