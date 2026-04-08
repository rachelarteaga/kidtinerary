"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ShareButtonProps {
  title: string;
  url: string;
}

export function ShareButton({ title, url }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // User cancelled or share failed — do nothing
      }
      return;
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. non-secure context) — silent fail
    }
  }

  return (
    <Button variant="outline" onClick={handleShare}>
      {copied ? "Copied!" : "Share"}
    </Button>
  );
}
