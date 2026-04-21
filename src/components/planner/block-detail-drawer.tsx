"use client";

import { useEffect, useState, useTransition } from "react";
import { KidAvatar } from "./kid-avatar";
import { updateBlockDetails, removePlannerBlock } from "@/lib/actions";
import type { PlannerBlockType } from "@/lib/supabase/types";

interface Kid {
  id: string;
  name: string;
  color: string;
  avatar_url: string | null;
}

interface Block {
  id: string;
  type: PlannerBlockType;
  title: string;
  emoji: string | null;
  startDate: string;
  endDate: string;
  childIds: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  block: Block | null;
  kids: Kid[];
  onChanged: () => void;
}

const TYPES: { id: PlannerBlockType; label: string; emoji: string }[] = [
  { id: "school", label: "School", emoji: "🏫" },
  { id: "travel", label: "Travel", emoji: "✈" },
  { id: "at_home", label: "At home", emoji: "🏡" },
  { id: "other", label: "Other", emoji: "⭐" },
];

export function BlockDetailDrawer({ open, onClose, block, kids, onChanged }: Props) {
  const [local, setLocal] = useState<Block | null>(block);
  const [isPending, startTransition] = useTransition();

  useEffect(() => { setLocal(block); }, [block]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !local) return null;

  function save(patch: Partial<Block>) {
    if (!local) return;
    const merged = { ...local, ...patch };
    setLocal(merged);
    startTransition(async () => {
      await updateBlockDetails({
        blockId: merged.id,
        type: merged.type,
        title: merged.title,
        emoji: merged.type === "other" ? merged.emoji : null,
        startDate: merged.startDate,
        endDate: merged.endDate,
        childIds: merged.childIds,
      });
      onChanged();
    });
  }

  async function handleRemove() {
    if (!local) return;
    if (!confirm("Remove this block?")) return;
    startTransition(async () => {
      await removePlannerBlock(local.id);
      onChanged();
      onClose();
    });
  }

  function toggleKid(kid: string) {
    if (!local) return;
    const next = local.childIds.includes(kid)
      ? local.childIds.filter((k) => k !== kid)
      : [...local.childIds, kid];
    save({ childIds: next });
  }

  const currentType = TYPES.find((t) => t.id === local.type) ?? TYPES[0];

  return (
    <>
      <div className="fixed inset-0 bg-bark/25 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-cream shadow-2xl z-50 overflow-y-auto">
        <header className="bg-white px-5 py-4 border-b border-driftwood/30 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-widest text-stone">Block</div>
            <h2 className="font-serif text-2xl text-bark leading-tight">
              {(local.type === "other" ? local.emoji : currentType.emoji) ?? "⭐"} {local.title || "Untitled"}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-stone hover:text-bark text-lg">✕</button>
        </header>

        <div className="p-5 space-y-5">
          <section>
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-stone mb-2">Type</h3>
            <div className="grid grid-cols-4 gap-1.5">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => save({ type: t.id, emoji: t.id === "other" ? (local!.emoji ?? "⭐") : null })}
                  className={`rounded-lg border px-2 py-2 text-xs ${
                    local.type === t.id
                      ? "border-campfire bg-campfire/10 text-bark font-medium"
                      : "border-driftwood/40 bg-white text-stone hover:text-bark"
                  }`}
                >
                  <div className="text-lg">{t.emoji}</div>
                  {t.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-stone mb-2">Title</h3>
            <input
              value={local.title}
              onChange={(e) => save({ title: e.target.value })}
              className="w-full rounded-md border border-driftwood/40 bg-white px-3 py-2 text-sm"
            />
            {local.type === "other" && (
              <input
                value={local.emoji ?? ""}
                onChange={(e) => save({ emoji: e.target.value })}
                className="mt-2 w-20 rounded-md border border-driftwood/40 bg-white px-3 py-2 text-sm text-center"
                placeholder="⭐"
                maxLength={4}
              />
            )}
          </section>

          <section>
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-stone mb-2">Dates</h3>
            <div className="flex gap-2">
              <input
                type="date"
                value={local.startDate}
                onChange={(e) => save({ startDate: e.target.value })}
                className="flex-1 rounded-md border border-driftwood/40 bg-white px-2 py-1.5 text-sm"
              />
              <input
                type="date"
                value={local.endDate}
                onChange={(e) => save({ endDate: e.target.value })}
                className="flex-1 rounded-md border border-driftwood/40 bg-white px-2 py-1.5 text-sm"
              />
            </div>
          </section>

          <section>
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-stone mb-2">Who</h3>
            <div className="flex gap-1.5 flex-wrap">
              {kids.map((k) => {
                const on = local.childIds.includes(k.id);
                return (
                  <button
                    key={k.id}
                    onClick={() => toggleKid(k.id)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
                      on ? "border-campfire bg-campfire/10" : "border-driftwood/40 bg-white opacity-60"
                    }`}
                  >
                    <KidAvatar name={k.name} color={k.color} index={0} avatarUrl={k.avatar_url} size={18} />{/* TODO: wire real index */}
                    {k.name} {on && <span className="text-meadow">✓</span>}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="pt-2 border-t border-driftwood/30">
            <button
              onClick={handleRemove}
              disabled={isPending}
              className="text-xs text-red-600 hover:text-red-800"
            >
              Remove this block
            </button>
          </section>
        </div>
      </aside>
    </>
  );
}
