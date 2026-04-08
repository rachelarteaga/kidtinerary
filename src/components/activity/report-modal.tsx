"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { submitReport } from "@/lib/actions";
import { REPORT_REASONS, type ReportReason } from "@/lib/constants";

interface ReportModalProps {
  activityId: string;
}

const REASON_LABELS: Record<ReportReason, string> = {
  wrong_price: "Price is wrong",
  cancelled: "Camp is cancelled",
  wrong_dates: "Wrong dates",
  other: "Other",
};

export function ReportModal({ activityId }: ReportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleSubmit() {
    if (!reason) {
      toast("Please select a reason", "error");
      return;
    }

    startTransition(async () => {
      const result = await submitReport(activityId, reason, details);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast("Thanks for the report! We'll look into it.", "success");
      setIsOpen(false);
      setReason("");
      setDetails("");
    });
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="font-mono text-[10px] uppercase tracking-wide text-stone hover:text-bark underline underline-offset-2"
      >
        Report an issue
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-bark/40 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="relative bg-cream rounded-2xl border border-driftwood/30 shadow-xl p-6 w-full max-w-md">
        <h3 className="font-serif text-xl mb-4">Report an issue</h3>

        <div className="space-y-3 mb-4">
          {REPORT_REASONS.map((r) => (
            <label
              key={r}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                reason === r
                  ? "border-sunset bg-sunset/5"
                  : "border-driftwood/30 hover:border-stone"
              }`}
            >
              <input
                type="radio"
                name="reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="accent-sunset"
              />
              <span className="text-sm">{REASON_LABELS[r]}</span>
            </label>
          ))}
        </div>

        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Any additional details? (optional)"
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-driftwood/50 bg-white text-bark placeholder:text-driftwood text-sm focus:outline-none focus:border-sunset focus:ring-1 focus:ring-sunset/30 mb-4 resize-none"
        />

        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={() => setIsOpen(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !reason}
            className="flex-1"
          >
            {isPending ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </div>
    </div>
  );
}
