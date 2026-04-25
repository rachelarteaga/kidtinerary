"use client";

import { useEffect, useState, useTransition } from "react";
import { addPlannerBlock } from "@/lib/actions";
import { KidAvatar } from "./kid-avatar";
import { BlockIcon } from "./block-icon";
import type { PlannerBlockType } from "@/lib/supabase/types";

interface ChildLite {
  id: string;
  name: string;
  color: string;
  avatar_url: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  plannerId: string;
  children: ChildLite[];
  scope: { childId: string | null; weekStart: string | null };
  onSubmitted: () => void;
  /** When true, skip the outer modal backdrop/wrapper — parent is responsible for chrome. */
  embedded?: boolean;
}

const TYPES: { id: PlannerBlockType; label: string; sub: string }[] = [
  { id: "school",  label: "School",   sub: "Year-round" },
  { id: "travel",  label: "Travel",   sub: "Trip, visit" },
  { id: "at_home", label: "At home",  sub: "Parent time, off" },
  { id: "other",   label: "Other",    sub: "Custom" },
];

function addDays(ymd: string, days: number): string {
  const d = new Date(ymd);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function AddBlockModal({ open, onClose, plannerId, children, scope, onSubmitted, embedded = false }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<PlannerBlockType>("travel");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedKids, setSelectedKids] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setStep(1);
      setType("travel");
      setTitle("");
      const ws = scope.weekStart ?? new Date().toISOString().split("T")[0];
      setStartDate(ws);
      setEndDate(addDays(ws, 4));
      setSelectedKids(scope.childId ? [scope.childId] : children.map((c) => c.id));
    }
  }, [open, scope.childId, scope.weekStart, children]);

  if (!open) return null;

  function toggleKid(id: string) {
    setSelectedKids((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await addPlannerBlock({
        plannerId,
        type,
        title,
        emoji: null,
        startDate,
        endDate,
        childIds: selectedKids,
      });
      if (result.error) { alert(result.error); return; }
      onSubmitted();
      onClose();
    });
  }

  const body = (
    <>
      <h2 className="font-display font-extrabold text-2xl mb-1">Add a block</h2>
      <p className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-4">
        Besides an activity
      </p>

      {step === 1 && (
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => { setType(t.id); setStep(2); }}
                className="border border-ink-3 rounded-xl p-3 bg-surface text-left hover:bg-ink-3/5 transition-colors"
              >
                <div className="mb-1"><BlockIcon type={t.id} size={24} /></div>
                <div className="font-medium text-sm text-ink">{t.label}</div>
                <div className="font-sans text-[10px] uppercase tracking-wide text-ink-2 mt-0.5">{t.sub}</div>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BlockIcon type={type} size={20} />
              <button
                onClick={() => setStep(1)}
                className="font-sans text-[10px] uppercase tracking-widest text-ink-2 hover:text-ink"
              >
                {TYPES.find((t) => t.id === type)?.label} · change
              </button>
            </div>

            <div>
              <label className="font-sans text-[10px] uppercase tracking-widest text-ink-2">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-surface border border-ink rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-ink mt-1"
                placeholder={type === "school" ? "School (year-round)" : "Outer Banks trip"}
              />
            </div>

            <div>
              <label className="font-sans text-[10px] uppercase tracking-widest text-ink-2">Dates</label>
              <div className="flex flex-col sm:flex-row gap-2 mt-1">
                <input type="date" aria-label="Start date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full sm:flex-1 min-w-0 bg-surface border border-ink rounded-lg px-3 py-2 text-ink" />
                <input type="date" aria-label="End date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full sm:flex-1 min-w-0 bg-surface border border-ink rounded-lg px-3 py-2 text-ink" />
              </div>
            </div>

            <div>
              <label className="font-sans text-[10px] uppercase tracking-widest text-ink-2">Who it applies to</label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {children.map((c, i) => {
                  const selected = selectedKids.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleKid(c.id)}
                      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border transition-colors ${selected ? "bg-surface" : "bg-surface opacity-50"}`}
                      style={selected ? { borderColor: "#151515" } : { borderColor: "#c0c0c0" }}
                    >
                      <KidAvatar name={c.name} color={c.color} index={i} avatarUrl={c.avatar_url} size={20} />
                      {c.name} {selected && "✓"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={onClose} className="font-sans text-[11px] uppercase tracking-widest px-4 py-2 text-ink-2 hover:text-ink">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={isPending || !title.trim() || selectedKids.length === 0}
                className="font-sans text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-ink text-ink-inverse hover:bg-ink/90 disabled:opacity-50"
              >
                {isPending ? "Adding…" : "Add to planner"}
              </button>
            </div>
          </div>
        )}
    </>
  );

  if (embedded) return body;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-ink/40 cursor-pointer" onClick={onClose} />
      <div className="relative bg-base rounded-2xl shadow-xl w-full max-w-md p-6">
        {body}
      </div>
    </div>
  );
}
