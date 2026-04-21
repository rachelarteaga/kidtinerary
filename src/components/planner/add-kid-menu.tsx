"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addKidToPlanner } from "@/lib/actions";
import { ChildForm } from "@/components/kids/child-form";
import { KidAvatar } from "./kid-avatar";

interface Kid {
  id: string;
  name: string;
  color: string;
  avatar_url: string | null;
}

interface Props {
  plannerId: string;
  availableKids: Kid[];
}

export function AddKidMenu({ plannerId, availableKids }: Props) {
  const [open, setOpen] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function addExisting(childId: string) {
    startTransition(async () => {
      const result = await addKidToPlanner(plannerId, childId);
      if (result.error) {
        alert(result.error);
        return;
      }
      router.refresh();
      setOpen(false);
    });
  }

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="Add kid"
          aria-label="Add kid"
          className="w-8 h-8 rounded-full border border-dashed border-driftwood/60 bg-white text-stone hover:border-bark hover:text-bark hover:bg-bark/5 flex items-center justify-center text-base leading-none transition-colors"
        >
          +
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-driftwood/30 rounded-lg shadow-lg p-1 min-w-[220px] z-20">
            {availableKids.length === 0 && (
              <div className="px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-driftwood italic">
                No other kids in your profile
              </div>
            )}
            {availableKids.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => addExisting(k.id)}
                disabled={isPending}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-driftwood/10 disabled:opacity-50 text-left"
              >
                <KidAvatar name={k.name} color={k.color} avatarUrl={k.avatar_url} size={20} />
                <span className="text-sm text-bark">{k.name}</span>
              </button>
            ))}
            <div className="border-t border-driftwood/30 mt-1 pt-1">
              <button
                type="button"
                onClick={() => {
                  setCreatingNew(true);
                  setOpen(false);
                }}
                className="w-full text-left px-2 py-1.5 rounded-md hover:bg-driftwood/10 font-mono text-[11px] uppercase tracking-widest text-campfire"
              >
                + Add a new kid
              </button>
            </div>
          </div>
        )}
      </div>

      {creatingNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-bark/40" onClick={() => setCreatingNew(false)} />
          <div className="relative bg-cream rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-2xl text-bark">Add a new kid</h2>
              <button
                type="button"
                onClick={() => setCreatingNew(false)}
                aria-label="Close"
                className="text-stone hover:text-bark"
              >
                ✕
              </button>
            </div>
            <ChildForm
              onCreated={async (createdChildId: string) => {
                await addKidToPlanner(plannerId, createdChildId);
              }}
              onDone={() => {
                setCreatingNew(false);
                router.refresh();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
