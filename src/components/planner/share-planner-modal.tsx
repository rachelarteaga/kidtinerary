"use client";

import { useRef, useState, useTransition } from "react";
import { KidAvatar } from "./kid-avatar";
import { SharedPlannerView, type KidRow as SharedKidRow, type EntryRow as SharedEntryRow, type BlockRow as SharedBlockRow } from "./shared-planner-view";
import { createPlannerShare } from "@/lib/actions";
import { sharePlannerImage, buildShareFilename } from "@/lib/share/render-image";
import { useToast } from "@/components/ui/toast";

function CameraIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
      aria-hidden
    >
      <path d="M9 2 L7 4 H4 C2.9 4 2 4.9 2 6 V18 C2 19.1 2.9 20 4 20 H20 C21.1 20 22 19.1 22 18 V6 C22 4.9 21.1 4 20 4 H17 L15 2 H9 Z M12 17 C9.24 17 7 14.76 7 12 C7 9.24 9.24 7 12 7 C14.76 7 17 9.24 17 12 C17 14.76 14.76 17 12 17 Z M12 15 C13.66 15 15 13.66 15 12 C15 10.34 13.66 9 12 9 C10.34 9 9 10.34 9 12 C9 13.66 10.34 15 12 15 Z" />
    </svg>
  );
}

function LinkIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
      aria-hidden
    >
      <path d="M3.9 12 C3.9 10.29 5.29 8.9 7 8.9 H11 V7 H7 C4.24 7 2 9.24 2 12 C2 14.76 4.24 17 7 17 H11 V15.1 H7 C5.29 15.1 3.9 13.71 3.9 12 Z M8 13 H16 V11 H8 V13 Z M17 7 H13 V8.9 H17 C18.71 8.9 20.1 10.29 20.1 12 C20.1 13.71 18.71 15.1 17 15.1 H13 V17 H17 C19.76 17 22 14.76 22 12 C22 9.24 19.76 7 17 7 Z" />
    </svg>
  );
}

interface KidOption {
  id: string;
  name: string;
  avatar_url: string | null;
  index: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  plannerId: string;
  plannerName: string;
  plannerStart: string;
  plannerEnd: string;
  ownerDisplayName: string | null;
  kids: KidOption[];
  sharedKids: SharedKidRow[];
  sharedEntries: SharedEntryRow[];
  sharedBlocks: SharedBlockRow[];
  colorByActivityId: Record<string, string>;
  isShared: boolean;
  isUnsharing: boolean;
  onStopSharing: () => void;
}

export function SharePlannerModal({
  open,
  onClose,
  plannerId,
  plannerName,
  plannerStart,
  plannerEnd,
  ownerDisplayName,
  kids,
  sharedKids,
  sharedEntries,
  sharedBlocks,
  colorByActivityId,
  isShared,
  isUnsharing,
  onStopSharing,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(kids.map((k) => k.id))
  );
  const [includeCost, setIncludeCost] = useState(false);
  const [includeBlocks, setIncludeBlocks] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const hiddenViewRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  const none = selected.size === 0;

  function toggleKid(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleImage() {
    const el = hiddenViewRef.current;
    if (!el) {
      toast("Image view not ready.", "error");
      return;
    }
    startTransition(async () => {
      const namePart = ownerDisplayName ? `${ownerDisplayName}'s` : "my";
      const result = await sharePlannerImage({
        element: el,
        filename: buildShareFilename(plannerName),
        shareTitle: plannerName,
        shareText: `Here's ${namePart} planner — ${plannerName}`,
      });
      if (result.error) toast(result.error, "error");
      else onClose();
    });
  }

  function handleLink() {
    startTransition(async () => {
      const result = await createPlannerShare({
        plannerId,
        kidIds: Array.from(selected),
        includeCost,
        includePersonalBlockDetails: includeBlocks,
      });
      if (result.error || !result.token) {
        toast(result.error ?? "Could not create share link.", "error");
        return;
      }
      const url = `${window.location.origin}/schedule/${result.token}`;
      await navigator.clipboard.writeText(url);
      toast("Link copied to clipboard.", "success");
      onClose();
    });
  }

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${plannerName}`}
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
        onClick={onClose}
      >
        <div
          className="bg-surface rounded-2xl max-w-md w-full border border-ink-3 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="px-6 py-4 border-b border-ink-3">
            <div className="flex items-center gap-2">
              <h2 className="font-display font-extrabold text-lg">
                Share &quot;{plannerName}&quot;
              </h2>
              {isShared && (
                <span
                  aria-label="Planner is currently shared"
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[#eef9f0] text-[#147a30]"
                >
                  <span className="relative inline-flex w-1.5 h-1.5 items-center justify-center" aria-hidden>
                    <span className="absolute inset-0 rounded-full bg-[#2cb14a] animate-ping opacity-75" />
                    <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-[#2cb14a]" />
                  </span>
                  Live
                </span>
              )}
            </div>
            <p className="font-sans text-xs text-ink-2 mt-1">
              Send an image snapshot or a live link.
            </p>
          </header>

          <section className="px-6 py-4 border-b border-ink-3">
            <p className="font-sans text-[10px] uppercase tracking-wide text-ink-2 mb-2">
              Which kids?
            </p>
            <div className="space-y-1">
              {kids.map((k) => (
                <label
                  key={k.id}
                  className="flex items-center gap-2 py-1 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(k.id)}
                    onChange={() => toggleKid(k.id)}
                  />
                  <KidAvatar
                    name={k.name}
                    index={k.index}
                    avatarUrl={k.avatar_url}
                    size={24}
                  />
                  <span className="font-sans text-sm">{k.name}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="px-6 py-4 border-b border-ink-3">
            <p className="font-sans text-[10px] uppercase tracking-wide text-ink-2 mb-2">
              Include
            </p>
            <label className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                checked={includeCost}
                onChange={(e) => setIncludeCost(e.target.checked)}
              />
              <span className="font-sans text-sm">Cost paid</span>
            </label>
            <label className="flex items-start gap-2 py-1">
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

          <footer className="px-6 py-4 bg-base/50 space-y-3">
            <div>
              <button
                type="button"
                onClick={handleImage}
                disabled={isPending}
                className="w-full px-4 py-2 rounded-lg border border-ink font-sans font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <CameraIcon />
                Share image view
              </button>
              <p className="text-xs text-ink-2 mt-1">
                Always shows detailed view. Sent via text, email, or AirDrop.
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={handleLink}
                disabled={isPending || none}
                className="w-full px-4 py-2 rounded-lg bg-ink text-white font-sans font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <LinkIcon />
                {isShared ? "Copy live link" : "Share a live link"}
              </button>
              <p className="text-xs text-ink-2 mt-1">
                Read-only for recipient. Revocable anytime.
              </p>
            </div>
            {isShared && (
              <div className="pt-2 border-t border-ink-3">
                <button
                  type="button"
                  onClick={onStopSharing}
                  disabled={isUnsharing || isPending}
                  className="w-full font-sans font-semibold text-[11px] uppercase tracking-widest px-4 py-2 text-[#c96164] hover:text-[#9e3f42] disabled:opacity-50"
                >
                  {isUnsharing ? "Stopping…" : "Stop sharing"}
                </button>
                <p className="text-xs text-ink-2 mt-1 text-center">
                  Revokes the current link. You can start a new one any time.
                </p>
              </div>
            )}
          </footer>
        </div>
      </div>

      {/* Hidden off-screen capture tree — snapshot source for "Share image view".
          Mirrors the public SharedPlannerView with the same filters, so the
          image reflects the exact same redactions as the live link. */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          left: "-100000px",
          top: 0,
          width: "1400px",
          pointerEvents: "none",
          zIndex: -1,
          backgroundColor: "#ffffff",
        }}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
              .image-capture-root .truncate {
                text-overflow: clip !important;
                white-space: normal !important;
                overflow: visible !important;
              }
            `,
          }}
        />
        <div ref={hiddenViewRef} className="image-capture-root">
          <SharedPlannerView
            token="image-preview"
            plannerName={plannerName}
            plannerStart={plannerStart}
            plannerEnd={plannerEnd}
            ownerDisplayName={ownerDisplayName}
            kids={sharedKids}
            entries={sharedEntries}
            blocks={sharedBlocks}
            filters={{
              kidIds: Array.from(selected),
              includeCost,
              includePersonalBlockDetails: includeBlocks,
            }}
            colorByActivityId={colorByActivityId}
            forceViewMode="detail"
          />
        </div>
      </div>
    </>
  );
}
