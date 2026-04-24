"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePlannerName } from "@/lib/actions";
import { SharePill } from "./shared-indicator-pill";

interface Props {
  plannerId: string;
  name: string;
  sharesActiveCount: number;
  onShareClick: () => void;
}

export function PlannerTitle({ plannerId, name, sharesActiveCount, onShareClick }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    setValue(name);
  }, [name]);

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.select(), 0);
  }, [editing]);

  function commit() {
    const trimmed = value.trim();
    if (trimmed === name) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const result = await updatePlannerName(plannerId, trimmed);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setEditing(false);
      router.refresh();
    });
  }

  function cancel() {
    setValue(name);
    setError(null);
    setEditing(false);
  }

  if (editing) {
    return (
      <div>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value.slice(0, 50));
            setError(null);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          maxLength={50}
          disabled={isPending}
          className="font-display font-extrabold text-[26px] sm:text-4xl text-ink bg-transparent border-b-2 border-ink-3 focus:border-ink outline-none min-w-[200px] tracking-tight"
        />
        {error && <p className="text-sm text-[#ef8c8f] mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-3">
      <button
        onClick={() => setEditing(true)}
        className="font-display font-extrabold text-[26px] sm:text-4xl text-ink tracking-tight text-left hover:underline decoration-ink-3 decoration-2 underline-offset-4 inline-flex items-center gap-2 group"
        aria-label="Edit planner name"
      >
        <span>{name}</span>
        <span
          aria-hidden="true"
          className="text-base text-ink-3 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          ✎
        </span>
      </button>
      <SharePill shared={sharesActiveCount > 0} onClick={onShareClick} />
    </div>
  );
}
