"use client";

import { useEffect, useState, useTransition } from "react";
import { addPlannerBlock } from "@/lib/actions";
import { KidAvatar } from "./kid-avatar";
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
  children: ChildLite[];
  scope: { childId: string | null; weekStart: string | null };
  onSubmitted: () => void;
  /** When true, skip the outer modal backdrop/wrapper — parent is responsible for chrome. */
  embedded?: boolean;
}

const TYPES: { id: PlannerBlockType; label: string; sub: string; emoji: string }[] = [
  { id: "school",  label: "School",   sub: "Year-round",      emoji: "🏫" },
  { id: "travel",  label: "Travel",   sub: "Trip, visit",     emoji: "✈" },
  { id: "at_home", label: "At home",  sub: "Parent time, off", emoji: "🏡" },
  { id: "other",   label: "Other",    sub: "Custom",          emoji: "⭐" },
];

function addDays(ymd: string, days: number): string {
  const d = new Date(ymd);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function AddBlockModal({ open, onClose, children, scope, onSubmitted, embedded = false }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<PlannerBlockType>("travel");
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedKids, setSelectedKids] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setStep(1);
      setType("travel");
      setTitle("");
      setEmoji("");
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
        type,
        title,
        emoji: type === "other" ? emoji || null : null,
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
      <h2 className="font-serif text-2xl mb-1">Add a block</h2>
      <p className="font-mono text-[10px] uppercase tracking-widest text-stone mb-4">
        Besides a camp
      </p>

      {step === 1 && (
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => { setType(t.id); setStep(2); }}
                className="border border-driftwood/30 rounded-xl p-3 bg-white text-left hover:bg-driftwood/5 transition-colors"
              >
                <div className="text-2xl mb-1">{t.emoji}</div>
                <div className="font-medium text-sm text-bark">{t.label}</div>
                <div className="font-mono text-[10px] uppercase tracking-wide text-stone mt-0.5">{t.sub}</div>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">{type === "other" ? (emoji || "⭐") : TYPES.find((t) => t.id === type)?.emoji}</span>
              <button
                onClick={() => setStep(1)}
                className="font-mono text-[10px] uppercase tracking-widest text-stone hover:text-bark"
              >
                {TYPES.find((t) => t.id === type)?.label} · change
              </button>
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-stone">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white border border-driftwood rounded-lg px-3 py-2 text-bark focus:outline-none focus:border-sunset mt-1"
                placeholder={type === "school" ? "School (year-round)" : "Outer Banks trip"}
              />
            </div>

            {type === "other" && (
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-stone">Emoji (optional)</label>
                <input
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  className="w-full bg-white border border-driftwood rounded-lg px-3 py-2 text-bark focus:outline-none focus:border-sunset mt-1"
                  maxLength={4}
                  placeholder="⭐"
                />
              </div>
            )}

            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-stone">Dates</label>
              <div className="flex gap-2 mt-1">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="flex-1 bg-white border border-driftwood rounded-lg px-3 py-2 text-bark" />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="flex-1 bg-white border border-driftwood rounded-lg px-3 py-2 text-bark" />
              </div>
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-stone">Who it applies to</label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {children.map((c) => {
                  const selected = selectedKids.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleKid(c.id)}
                      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border transition-colors ${selected ? "bg-white" : "bg-white opacity-50"}`}
                      style={selected ? { borderColor: c.color } : { borderColor: "#d9c9b0" }}
                    >
                      <KidAvatar name={c.name} color={c.color} avatarUrl={c.avatar_url} size={20} />
                      {c.name} {selected && "✓"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={onClose} className="font-mono text-[11px] uppercase tracking-widest px-4 py-2 text-stone hover:text-bark">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={isPending || !title.trim() || selectedKids.length === 0}
                className="font-mono text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-bark text-cream hover:bg-bark/90 disabled:opacity-50"
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
      <div className="absolute inset-0 bg-bark/40" onClick={onClose} />
      <div className="relative bg-cream rounded-2xl shadow-xl w-full max-w-md p-6">
        {body}
      </div>
    </div>
  );
}
