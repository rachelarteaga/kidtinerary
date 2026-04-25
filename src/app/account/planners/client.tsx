"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import type { PlannerSummary } from "@/lib/queries";
import {
  createPlanner,
  deletePlanner,
  duplicatePlanner,
  updatePlannerName,
  createPlannerShare,
  revokePlannerShareByPlanner,
} from "@/lib/actions";

interface Props {
  initialPlanners: PlannerSummary[];
  allKids: { id: string; name: string }[];
}

function formatDateRange(startDate: string, endDate: string): string {
  const s = new Date(startDate + "T00:00:00");
  const e = new Date(endDate + "T00:00:00");
  const sameYear = s.getFullYear() === e.getFullYear();
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
    });
  return `${fmt(s, false)} – ${fmt(e, true)}${sameYear ? "" : ""}`;
}

function nextMonday(from: Date = new Date()): Date {
  const d = new Date(from);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const daysToAdd = day === 1 ? 7 : (8 - day) % 7;
  d.setDate(d.getDate() + daysToAdd);
  return d;
}

function formatLastEdited(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function MyPlannersClient({ initialPlanners, allKids }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [planners, setPlanners] = useState(initialPlanners);
  // Keep local state in sync with server data whenever router.refresh() delivers
  // fresh initialPlanners (e.g., after createPlannerShare / duplicatePlanner).
  // Without this, toggling share off + on again leaves the client stuck at the
  // stale "off" state even though the server wrote a new share row.
  useEffect(() => {
    setPlanners(initialPlanners);
  }, [initialPlanners]);
  const [, startTransition] = useTransition();
  const [shareDrawer, setShareDrawer] = useState<PlannerSummary | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PlannerSummary | null>(null);
  // Auto-open the new-planner modal when arrived via `?new=1` (first-time users
  // bounced here by the /planner smart redirect). Strip the query param so a
  // refresh doesn't re-trigger the modal after they cancel out.
  const [newPlannerOpen, setNewPlannerOpen] = useState(() => searchParams.get("new") === "1");
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      router.replace("/account/planners");
    }
  }, [searchParams, router]);

  function copyLink(token: string) {
    const url = `${window.location.origin}/schedule/${token}`;
    navigator.clipboard.writeText(url).then(
      () => toast("Link copied to clipboard.", "success"),
      () => toast("Could not copy link.", "error"),
    );
  }

  async function handleRename(plannerId: string, newName: string) {
    const original = planners.find((p) => p.id === plannerId);
    if (!original || original.name === newName.trim()) return;
    setPlanners((prev) => prev.map((p) => (p.id === plannerId ? { ...p, name: newName.trim() } : p)));
    const result = await updatePlannerName(plannerId, newName);
    if (result.error) {
      toast(result.error, "error");
      setPlanners((prev) => prev.map((p) => (p.id === plannerId ? original : p)));
    }
  }

  function handleDuplicate(p: PlannerSummary) {
    startTransition(async () => {
      const result = await duplicatePlanner(p.id);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast("Planner duplicated.", "success");
      router.refresh();
    });
  }

  function handleDelete(p: PlannerSummary) {
    startTransition(async () => {
      const result = await deletePlanner(p.id);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      setPlanners((prev) => prev.filter((x) => x.id !== p.id));
      setDeleteConfirm(null);
      toast("Planner deleted.", "success");
      router.refresh();
    });
  }

  function handleToggleOff(p: PlannerSummary) {
    startTransition(async () => {
      const result = await revokePlannerShareByPlanner(p.id);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      setPlanners((prev) =>
        prev.map((x) =>
          x.id === p.id
            ? { ...x, shareToken: null, shareId: null, shareKidIds: [], shareIncludeCost: false, shareIncludePersonalBlockDetails: false }
            : x,
        ),
      );
      toast("Sharing stopped.", "success");
      router.refresh();
    });
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-ink tracking-tight">My planners</h1>
        <button
          type="button"
          onClick={() => setNewPlannerOpen(true)}
          className="font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-ink text-ink-inverse border border-ink hover:bg-[#333] flex-shrink-0"
        >
          + New planner
        </button>
      </div>
      <p className="text-ink-2 mb-8">
        Manage every planner you own — open, duplicate, delete, or share.
      </p>

      {planners.length === 0 ? (
        <div className="rounded-lg border border-ink-3 bg-surface p-6">
          <p className="font-sans text-sm text-ink-2">
            You don&apos;t have any planners yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {planners.map((p) => (
            <PlannerRow
              key={p.id}
              planner={p}
              onRename={(name) => handleRename(p.id, name)}
              onToggleOn={() => setShareDrawer(p)}
              onToggleOff={() => handleToggleOff(p)}
              onEditSettings={() => setShareDrawer(p)}
              onCopyLink={() => p.shareToken && copyLink(p.shareToken)}
              onDuplicate={() => handleDuplicate(p)}
              onDelete={() => setDeleteConfirm(p)}
            />
          ))}
        </div>
      )}

      <div className="mt-10">
        <Link
          href="/planner"
          className="font-sans font-bold text-[11px] uppercase tracking-widest text-ink hover:underline"
        >
          ← Back to planner
        </Link>
      </div>

      {shareDrawer && (
        <ShareSettingsDrawer
          planner={shareDrawer}
          allKids={allKids}
          onClose={() => setShareDrawer(null)}
          onSaved={() => {
            setShareDrawer(null);
            router.refresh();
          }}
        />
      )}

      {deleteConfirm && (
        <DeletePlannerConfirm
          planner={deleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={() => handleDelete(deleteConfirm)}
        />
      )}

      {newPlannerOpen && (
        <NewPlannerModal
          onClose={() => setNewPlannerOpen(false)}
          onCreated={(plannerId) => {
            setNewPlannerOpen(false);
            toast("Planner created.", "success");
            router.push(`/planner?id=${plannerId}`);
          }}
        />
      )}
    </main>
  );
}

function PlannerRow({
  planner,
  onRename,
  onToggleOn,
  onToggleOff,
  onEditSettings,
  onCopyLink,
  onDuplicate,
  onDelete,
}: {
  planner: PlannerSummary;
  onRename: (name: string) => void;
  onToggleOn: () => void;
  onToggleOff: () => void;
  onEditSettings: () => void;
  onCopyLink: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(planner.name);
  const isShared = !!planner.shareToken;

  function commit() {
    setEditing(false);
    if (draft.trim() && draft.trim() !== planner.name) onRename(draft);
    else setDraft(planner.name);
  }

  return (
    <div className="rounded-lg border border-ink-3 bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="group flex items-center gap-2 min-w-0">
            {editing ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") {
                    setDraft(planner.name);
                    setEditing(false);
                  }
                }}
                className="font-display font-extrabold text-lg bg-transparent border-b border-ink text-ink focus:outline-none min-w-0 flex-1"
              />
            ) : (
              <>
                <Link
                  href={`/planner?id=${planner.id}`}
                  className="font-display font-extrabold text-lg text-ink hover:underline truncate cursor-pointer"
                >
                  {planner.name}
                </Link>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  aria-label="Rename planner"
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-ink-2 hover:text-ink transition-opacity cursor-pointer flex-shrink-0"
                >
                  <PencilIcon />
                </button>
              </>
            )}
          </div>
          <p className="font-sans text-xs text-ink-2 mt-1">
            {formatDateRange(planner.startDate, planner.endDate)} · {planner.kidCount}{" "}
            kid{planner.kidCount === 1 ? "" : "s"} · Last edited {formatLastEdited(planner.lastEditedAt)}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-ink-3 flex items-center justify-between gap-2 sm:flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          {isShared ? (
            <>
              <ShareStatusBadge />
              <button
                type="button"
                onClick={onCopyLink}
                className="font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full border border-ink hover:bg-base"
              >
                Copy link
              </button>
              <button
                type="button"
                onClick={onEditSettings}
                className="hidden sm:inline font-sans font-semibold text-[11px] uppercase tracking-widest text-ink-2 hover:text-ink"
              >
                Edit settings
              </button>
              <button
                type="button"
                onClick={onToggleOff}
                className="hidden sm:inline font-sans font-semibold text-[11px] uppercase tracking-widest text-[#c96164] hover:text-[#9e3f42]"
              >
                Stop sharing
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onToggleOn}
              className="inline-flex items-center gap-2 font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full bg-surface border-2 border-[#ef8c8f] text-[#c96164] hover:bg-[#ef8c8f]/10"
            >
              <span className="inline-block w-2 h-2 rounded-full bg-[#ef8c8f]" aria-hidden />
              Share planner
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/planner?id=${planner.id}`}
            className="font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full border border-ink hover:bg-base"
          >
            Open
          </Link>
          <button
            type="button"
            onClick={onDuplicate}
            className="hidden sm:inline font-sans font-semibold text-[11px] uppercase tracking-widest text-ink-2 hover:text-ink"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="hidden sm:inline font-sans font-semibold text-[11px] uppercase tracking-widest text-[#ef8c8f] hover:text-[#e87073]"
          >
            Delete
          </button>
          <PlannerRowOverflowMenu
            isShared={isShared}
            onEditSettings={onEditSettings}
            onStopSharing={onToggleOff}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
}

function PlannerRowOverflowMenu({
  isShared,
  onEditSettings,
  onStopSharing,
  onDuplicate,
  onDelete,
}: {
  isShared: boolean;
  onEditSettings: () => void;
  onStopSharing: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-planner-overflow]")) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative sm:hidden" data-planner-overflow>
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-ink text-ink hover:bg-base"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-20 min-w-[180px] bg-surface border border-ink-3 rounded-xl shadow-[3px_3px_0_0_rgba(0,0,0,0.15)] overflow-hidden"
        >
          {isShared && (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); onEditSettings(); }}
                className="block w-full text-left min-h-[44px] px-4 py-2 font-sans text-[13px] font-medium text-ink hover:bg-base"
              >
                Edit share settings
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); onStopSharing(); }}
                className="block w-full text-left min-h-[44px] px-4 py-2 font-sans text-[13px] font-medium text-[#c96164] hover:bg-[#fdebec]"
              >
                Stop sharing
              </button>
              <hr className="border-t border-disabled mx-2" />
            </>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onDuplicate(); }}
            className="block w-full text-left min-h-[44px] px-4 py-2 font-sans text-[13px] font-medium text-ink hover:bg-base"
          >
            Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onDelete(); }}
            className="block w-full text-left min-h-[44px] px-4 py-2 font-sans text-[13px] font-medium text-[#ef8c8f] hover:bg-[#fdebec]"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Read-only badge shown when a planner is actively shared. Pulsing green dot
 * signals "live link out there right now." This is NOT a button — actions
 * (Copy link, Edit settings, Stop sharing) are explicit adjacent buttons so
 * users never accidentally turn sharing off by clicking the status.
 */
function PencilIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  );
}

function ShareStatusBadge() {
  return (
    <span
      aria-label="Sharing is on"
      className="inline-flex items-center gap-2 font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full bg-surface border-2 border-[#5ac195] text-[#2a8e63]"
    >
      <span className="relative inline-flex w-2 h-2 items-center justify-center" aria-hidden>
        <span className="absolute inset-0 rounded-full bg-[#5ac195] animate-ping opacity-75" />
        <span className="relative inline-block w-2 h-2 rounded-full bg-[#5ac195]" />
      </span>
      Sharing on
    </span>
  );
}

function ShareSettingsDrawer({
  planner,
  allKids,
  onClose,
  onSaved,
}: {
  planner: PlannerSummary;
  allKids: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  // Seed from existing share settings if present, else default-on for all kids.
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (planner.shareToken && planner.shareKidIds.length > 0) {
      return new Set(planner.shareKidIds);
    }
    return new Set(allKids.map((k) => k.id));
  });
  const [includeCost, setIncludeCost] = useState(planner.shareIncludeCost);
  const [includeBlocks, setIncludeBlocks] = useState(planner.shareIncludePersonalBlockDetails);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function toggleKid(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    if (selected.size === 0) {
      toast("Pick at least one kid.", "error");
      return;
    }
    startTransition(async () => {
      const result = await createPlannerShare({
        plannerId: planner.id,
        kidIds: Array.from(selected),
        includeCost,
        includePersonalBlockDetails: includeBlocks,
      });
      if (result.error || !result.token) {
        toast(result.error ?? "Could not save share settings.", "error");
        return;
      }
      toast(planner.shareToken ? "Share settings updated." : "Planner shared.", "success");
      onSaved();
    });
  }

  const title = planner.shareToken ? "Edit share settings" : `Share "${planner.name}"`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl max-w-md w-full border border-ink-3 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-6 py-4 border-b border-ink-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display font-extrabold text-lg">{title}</h2>
            <p className="font-sans text-xs text-ink-2 mt-1">
              Read-only live link for recipients. Revocable anytime.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-2 hover:text-ink text-xl leading-none cursor-pointer"
          >
            ✕
          </button>
        </header>

        <section className="px-6 py-4 border-b border-ink-3">
          <p className="font-sans text-[10px] uppercase tracking-wide text-ink-2 mb-2">Which kids?</p>
          <div className="space-y-1">
            {allKids.length === 0 && (
              <p className="font-sans text-sm text-ink-2 italic">No kids in your profile yet.</p>
            )}
            {allKids.map((k) => (
              <label key={k.id} className="flex items-center gap-2 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(k.id)}
                  onChange={() => toggleKid(k.id)}
                />
                <span className="font-sans text-sm">{k.name}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="px-6 py-4 border-b border-ink-3">
          <p className="font-sans text-[10px] uppercase tracking-wide text-ink-2 mb-2">Include</p>
          <label className="flex items-center gap-2 py-1 cursor-pointer">
            <input
              type="checkbox"
              checked={includeCost}
              onChange={(e) => setIncludeCost(e.target.checked)}
            />
            <span className="font-sans text-sm">Cost paid</span>
          </label>
          <label className="flex items-start gap-2 py-1 cursor-pointer">
            <input
              type="checkbox"
              checked={includeBlocks}
              onChange={(e) => setIncludeBlocks(e.target.checked)}
              className="mt-1"
            />
            <span className="font-sans text-sm">
              Non-activity block details
              <span className="block text-xs text-ink-2">
                Off: shows as &quot;Nothing scheduled.&quot; On: shows titles.
              </span>
            </span>
          </label>
        </section>

        <footer className="px-6 py-4 bg-base/50 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="font-sans font-semibold text-[11px] uppercase tracking-widest px-4 py-2 text-ink-2 hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || selected.size === 0}
            className="font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-ink text-ink-inverse hover:bg-[#333] border border-ink disabled:opacity-50"
          >
            {isPending ? "Saving…" : planner.shareToken ? "Save changes" : "Share planner"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function DeletePlannerConfirm({
  planner,
  onCancel,
  onConfirm,
}: {
  planner: PlannerSummary;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-surface rounded-2xl max-w-sm w-full border border-ink-3 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display font-extrabold text-xl text-ink mb-2">
          Delete &quot;{planner.name}&quot;?
        </h3>
        <p className="font-sans text-sm text-ink-2 leading-relaxed mb-4">
          This removes the planner and every activity placement, block, kid assignment, and
          share link on it. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="font-sans font-semibold text-[11px] uppercase tracking-widest px-3 py-1.5 text-ink-2 hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full bg-[#ef8c8f] text-ink border border-ink hover:brightness-95"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function NewPlannerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (plannerId: string) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  // Default to next-week's Monday → 8 weeks later (Sunday). Users can adjust
  // before creating. Handles today-is-Monday by skipping to NEXT Monday
  // rather than using today.
  const [startDate, setStartDate] = useState(() => nextMonday().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => {
    const d = nextMonday();
    d.setDate(d.getDate() + 8 * 7 - 1); // 8 weeks minus 1 day = end Sunday
    return d.toISOString().slice(0, 10);
  });
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    if (!name.trim()) {
      toast("Name required.", "error");
      return;
    }
    startTransition(async () => {
      const result = await createPlanner({ name, startDate, endDate });
      if (result.error || !result.plannerId) {
        toast(result.error ?? "Could not create planner.", "error");
        return;
      }
      onCreated(result.plannerId);
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl max-w-md w-full border border-ink-3 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display font-extrabold text-xl text-ink mb-1">New planner</h3>
        <p className="font-sans text-xs text-ink-2 mb-4">
          All your kids will be included by default — you can adjust on the planner page.
        </p>

        <div className="space-y-3">
          <div>
            <label className="font-sans text-[10px] uppercase tracking-widest text-ink-2 block mb-1">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Summer 2026"
              maxLength={50}
              className="w-full bg-surface border border-ink rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-ink"
            />
          </div>
          <div>
            <label className="font-sans text-[10px] uppercase tracking-widest text-ink-2 block mb-1">Dates</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="date"
                aria-label="Start date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full sm:flex-1 min-w-0 bg-surface border border-ink rounded-lg px-3 py-2 text-ink"
              />
              <input
                type="date"
                aria-label="End date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full sm:flex-1 min-w-0 bg-surface border border-ink rounded-lg px-3 py-2 text-ink"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="font-sans font-semibold text-[11px] uppercase tracking-widest px-3 py-1.5 text-ink-2 hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending || !name.trim()}
            className="font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-ink text-ink-inverse hover:bg-[#333] border border-ink disabled:opacity-50"
          >
            {isPending ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
