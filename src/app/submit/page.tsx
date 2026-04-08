"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { submitCampUrl } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default function SubmitCampPage() {
  const [url, setUrl] = useState("");
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleSubmit() {
    const trimmed = url.trim();
    if (!trimmed) {
      toast("Please enter a URL", "error");
      return;
    }

    // Basic URL validation
    try {
      new URL(trimmed);
    } catch {
      toast("Please enter a valid URL (e.g., https://example.com)", "error");
      return;
    }

    startTransition(async () => {
      const result = await submitCampUrl(trimmed);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(
        "Thanks! We'll review this camp and add it to Kidtinerary.",
        "success"
      );
      setUrl("");
    });
  }

  return (
    <main className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-serif text-4xl mb-2">Submit a Camp</h1>
      <p className="text-stone text-lg mb-8">
        Know about a camp or activity that&apos;s not in Kidtinerary yet? Paste the
        link below and we&apos;ll work on adding it.
      </p>

      <div className="bg-white rounded-2xl border border-driftwood/30 p-6">
        <label className="block font-mono text-[10px] uppercase tracking-wide text-stone mb-1.5">
          Camp or Activity URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="https://example.com/summer-camp"
          className="w-full px-3 py-2 rounded-lg border border-driftwood/50 bg-cream/50 text-bark placeholder:text-driftwood text-sm focus:outline-none focus:border-sunset focus:ring-1 focus:ring-sunset/30 mb-4"
        />
        <Button onClick={handleSubmit} disabled={isPending} className="w-full">
          {isPending ? "Submitting..." : "Submit Camp"}
        </Button>

        <p className="text-xs text-stone mt-4">
          We&apos;ll review the link and extract camp details. You&apos;ll see it on
          Kidtinerary once it&apos;s been processed. This usually takes a few days.
        </p>
      </div>
    </main>
  );
}
