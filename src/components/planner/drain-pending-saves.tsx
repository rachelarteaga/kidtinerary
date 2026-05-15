"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { takePendingSaveTokens } from "@/lib/saved-shares-pending";
import { drainPendingShareSaves } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";

/**
 * Runs once on mount for authenticated viewers. Reads any tokens stashed by
 * the anonymous banner and calls the server action to save each. The current
 * token does NOT need special-casing — it lives in the pending list too.
 */
export function DrainPendingSaves() {
  const router = useRouter();
  const { toast } = useToast();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (typeof window === "undefined") return;
    const tokens = takePendingSaveTokens(window.localStorage);
    if (tokens.length === 0) return;
    (async () => {
      const r = await drainPendingShareSaves(tokens);
      if (r.saved > 0) {
        toast(
          r.saved === 1
            ? "Saved to your planners."
            : `Saved ${r.saved} planners to your account.`,
          "success",
        );
        router.refresh();
      } else if (r.skipped > 0) {
        // Tokens drained from localStorage but nothing could be saved (e.g., shares
        // revoked between stash and signup, or all tokens were the user's own).
        toast(
          "These planners are no longer being shared.",
          "info",
        );
      }
    })();
    // ran.current ensures this effect runs only once per mount; refs not in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
