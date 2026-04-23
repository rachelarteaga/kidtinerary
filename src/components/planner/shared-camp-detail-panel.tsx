"use client";

interface Props {
  open: boolean;
  onClose: () => void;
  camp: {
    org: string;
    name: string;
    location: string;
    url: string | null;
    about: string;
    weeklyCostCents?: number | null;
  };
}

export function SharedCampDetailPanel({ open, onClose, camp }: Props) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${camp.name} details`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl max-w-sm w-full border border-ink-3 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4">
          <p className="font-sans text-[10px] uppercase tracking-wide text-ink-2 font-semibold">
            {camp.org}
          </p>
          <h3 className="font-display font-extrabold text-lg mt-1">{camp.name}</h3>
          {typeof camp.weeklyCostCents === "number" && (
            <p className="font-sans text-xs text-ink-2 mt-1">
              ${Math.round(camp.weeklyCostCents / 100)} / week
            </p>
          )}
        </div>
        {camp.location && camp.location.trim().length > 0 && (
          <div className="px-5 py-3 border-t border-ink-3">
            <p className="font-sans text-[10px] uppercase tracking-wide text-ink-2 font-semibold">Location</p>
            <p className="font-sans text-sm mt-1 whitespace-pre-line">{camp.location}</p>
          </div>
        )}
        {camp.url && (
          <div className="px-5 py-3 border-t border-ink-3">
            <p className="font-sans text-[10px] uppercase tracking-wide text-ink-2 font-semibold">Link</p>
            <a
              href={camp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-sans text-sm text-[#2a6a9e] hover:underline"
            >
              {camp.url.replace(/^https?:\/\//, "").replace(/\/$/, "")} →
            </a>
          </div>
        )}
        {camp.about && camp.about.trim().length > 0 && (
          <div className="px-5 py-3 border-t border-ink-3">
            <p className="font-sans text-[10px] uppercase tracking-wide text-ink-2 font-semibold">About</p>
            <p className="font-sans text-sm mt-1">{camp.about}</p>
          </div>
        )}
      </div>
    </div>
  );
}
