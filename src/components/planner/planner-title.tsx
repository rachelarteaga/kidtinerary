"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePlannerName } from "@/lib/actions";

interface Props {
  plannerId: string;
  name: string;
}

export function PlannerTitle({ plannerId, name }: Props) {
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
          className="font-serif text-4xl bg-transparent border-b-2 border-bark/40 focus:border-bark outline-none min-w-[200px]"
        />
        {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="font-serif text-4xl hover:underline decoration-bark/30 decoration-2 underline-offset-4 inline-flex items-center gap-2 group"
      aria-label="Edit planner name"
    >
      <span>{name}</span>
      <span
        aria-hidden="true"
        className="text-base text-stone opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ✎
      </span>
    </button>
  );
}
