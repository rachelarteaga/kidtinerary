"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { unsaveSharedPlanner } from "@/lib/actions";

export interface FriendForRail {
  savedShareId: string;
  shareId: string;
  /** Null when the share was revoked (tombstone). */
  token: string | null;
  isTombstone: boolean;
  plannerName: string;
  ownerDisplayName: string | null;
  kids: { id: string; name: string; color: string }[];
}

interface Props {
  friends: FriendForRail[];
  onRemoved?: (shareId: string) => void;
}

export function FriendsPlansPanel({ friends, onRemoved }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  function handleRemove(shareId: string) {
    startTransition(async () => {
      const r = await unsaveSharedPlanner(shareId);
      if (r.error) {
        toast(r.error, "error");
        return;
      }
      onRemoved?.(shareId);
      toast("Removed from your planners.", "success");
      router.refresh();
    });
  }

  if (friends.length === 0) {
    return (
      <p className="font-sans text-sm text-ink-2 italic leading-relaxed">
        Save a friend&apos;s shared planner to see overlaps with your own
        planner. Open a shared link they sent you and tap &ldquo;+ Save to my
        planners.&rdquo;
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {friends.map((f) => (
        <div
          key={f.savedShareId}
          className="rounded-lg border border-ink-3 bg-surface p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {f.isTombstone || !f.token ? (
                <p className="font-display font-extrabold text-sm text-ink-2 line-through truncate">
                  {f.plannerName}
                </p>
              ) : (
                <Link
                  href={`/schedule/${f.token}`}
                  className="block font-display font-extrabold text-sm text-ink hover:underline truncate"
                >
                  {f.plannerName}
                </Link>
              )}
              <p className="font-sans text-[11px] text-ink-2 mt-0.5">
                Shared by{" "}
                <span className="font-semibold text-ink">
                  {f.ownerDisplayName ?? "a friend"}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleRemove(f.shareId)}
              className="font-sans font-bold text-[10px] uppercase tracking-widest text-ink-2 hover:text-ink flex-shrink-0"
              aria-label={`Remove ${f.plannerName}`}
            >
              Remove
            </button>
          </div>
          {f.kids.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {f.kids.map((k) => (
                <span
                  key={k.id}
                  className="inline-flex items-center gap-1 font-sans text-[11px] text-ink bg-base px-1.5 py-0.5 rounded-full"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: k.color }}
                    aria-hidden
                  />
                  {k.name}
                </span>
              ))}
            </div>
          )}
          {f.isTombstone && (
            <p className="font-sans text-[11px] text-ink-2 italic mt-2">
              This planner is no longer being shared.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
