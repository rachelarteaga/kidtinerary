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
      }
    })();
  }, [router, toast]);

  return null;
}
