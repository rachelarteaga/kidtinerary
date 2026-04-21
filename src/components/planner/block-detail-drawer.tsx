"use client";

import { useEffect, useState, useTransition } from "react";
import { KidAvatar } from "./kid-avatar";
import { BlockIcon } from "./block-icon";
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

const TYPES: { id: PlannerBlockType; label: string }[] = [
  { id: "school", label: "School" },
  { id: "travel", label: "Travel" },
  { id: "at_home", label: "At home" },
  { id: "other", label: "Other" },
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

  return (
    <>
      <div className="fixed inset-0 bg-ink/25 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-base shadow-2xl z-50 overflow-y-auto">
        <header className="bg-surface px-5 py-4 border-b border-ink-3 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-sans text-[10px] uppercase tracking-widest text-ink-2">Block</div>
            <h2 className="font-display font-extrabold text-2xl text-ink leading-tight flex items-center gap-2">
              <BlockIcon type={local.type} size={22} />
              <span className="truncate">{local.title || "Untitled"}</span>
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-2 hover:text-ink text-lg">✕</button>
        </header>

        <div className="p-5 space-y-5">
          <section>
            <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">Type</h3>
            <div className="grid grid-cols-4 gap-1.5">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => save({ type: t.id, emoji: null })}
                  className={`rounded-lg border px-2 py-2 text-xs ${
                    local.type === t.id
                      ? "border-ink bg-ink/10 text-ink font-medium"
                      : "border-ink-3 bg-surface text-ink-2 hover:text-ink"
                  }`}
                >
                  <div className="mb-0.5 flex justify-center"><BlockIcon type={t.id} size={18} /></div>
                  {t.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">Title</h3>
            <input
              value={local.title}
              onChange={(e) => save({ title: e.target.value })}
              className="w-full rounded-md border border-ink-3 bg-surface px-3 py-2 text-sm"
            />
          </section>

          <section>
            <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">Dates</h3>
            <div className="flex gap-2">
              <input
                type="date"
                value={local.startDate}
                onChange={(e) => save({ startDate: e.target.value })}
                className="flex-1 rounded-md border border-ink-3 bg-surface px-2 py-1.5 text-sm"
              />
              <input
                type="date"
                value={local.endDate}
                onChange={(e) => save({ endDate: e.target.value })}
                className="flex-1 rounded-md border border-ink-3 bg-surface px-2 py-1.5 text-sm"
              />
            </div>
          </section>

          <section>
            <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">Who</h3>
            <div className="flex gap-1.5 flex-wrap">
              {kids.map((k, i) => {
                const on = local.childIds.includes(k.id);
                return (
                  <button
                    key={k.id}
                    onClick={() => toggleKid(k.id)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
                      on ? "border-ink bg-ink/10" : "border-ink-3 bg-surface opacity-60"
                    }`}
                  >
                    <KidAvatar name={k.name} color={k.color} index={i} avatarUrl={k.avatar_url} size={18} />
                    {k.name} {on && <span className="text-[#5fc39c]">✓</span>}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="pt-2 border-t border-ink-3">
            <button
              onClick={handleRemove}
              disabled={isPending}
              className="text-xs text-[#ef8c8f] hover:text-[#ef8c8f]/80"
            >
              Remove this block
            </button>
          </section>
        </div>
      </aside>
    </>
  );
}
