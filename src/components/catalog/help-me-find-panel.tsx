"use client";

import { useState, useEffect, useTransition } from "react";
import { saveHelpMeFindResult, saveProfileAddress } from "@/lib/actions";
import { SparkleIcon } from "@/components/ui/sparkle-icon";
import { categoryLabel } from "@/lib/format";

export interface KidSummary {
  id: string;
  name: string;
  birth_date: string | null;
  interests: string[] | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  kids: KidSummary[];
  /** profiles.address; null when not set. */
  address: string | null;
  onSaved: () => void;
}

interface MockResult {
  id: string;
  name: string;
  url: string;
  organizationName: string | null;
  description: string | null;
  categories: string[];
  ageMin: number | null;
  ageMax: number | null;
  registrationEndDate: string | null;
  neighborhood: string | null;
  distanceMiles: number | null;
}

// Static mock data for v1. Phase 10 swaps to /api/help-me-find.
const MOCK_RESULTS: MockResult[] = [
  {
    id: "mock-1",
    name: "Brooklyn Open Studio — Outdoor Art Week",
    url: "https://brooklynopenstudio.org/summer",
    organizationName: "Brooklyn Open Studio",
    description: "Half-day outdoor painting and printmaking week in Prospect Park.",
    categories: ["arts"],
    ageMin: 5,
    ageMax: 8,
    registrationEndDate: "2026-05-30",
    neighborhood: "Park Slope",
    distanceMiles: 0.6,
  },
  {
    id: "mock-2",
    name: "Prospect Park Outdoor Painting Camp",
    url: "https://prospectpark.org/kids/painting",
    organizationName: "Prospect Park Alliance",
    description: "Plein air painting camp for elementary-aged kids.",
    categories: ["arts", "nature"],
    ageMin: 5,
    ageMax: 10,
    registrationEndDate: null,
    neighborhood: "Prospect Park",
    distanceMiles: 1.2,
  },
  {
    id: "mock-3",
    name: "Lefferts Historic Art Workshop",
    url: "https://leffertshouse.org/programs",
    organizationName: "Lefferts House",
    description: "Mornings of museum-led art and history activities.",
    categories: ["arts", "academic"],
    ageMin: 6,
    ageMax: null,
    registrationEndDate: "2026-06-15",
    neighborhood: "Crown Heights",
    distanceMiles: 1.8,
  },
  {
    id: "mock-4",
    name: "BAM Kids Art + Music Lab",
    url: "https://bam.org/kids/art-music",
    organizationName: "Brooklyn Academy of Music",
    description: "Combined art and music workshops in two-week sessions.",
    categories: ["arts", "music"],
    ageMin: 4,
    ageMax: 7,
    registrationEndDate: null,
    neighborhood: "Fort Greene",
    distanceMiles: 2.1,
  },
  {
    id: "mock-5",
    name: "Carroll Park Pottery Studio Summer",
    url: "https://carrollparkpottery.com/summer-2026",
    organizationName: "Carroll Park Pottery",
    description: "Half-day pottery sessions in Carroll Gardens.",
    categories: ["arts"],
    ageMin: 7,
    ageMax: 12,
    registrationEndDate: "2026-05-10",
    neighborhood: "Carroll Gardens",
    distanceMiles: 1.5,
  },
];

function kidAgeYears(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const now = new Date();
  const dob = new Date(birthDate);
  const age = now.getUTCFullYear() - dob.getUTCFullYear();
  return age;
}

function deriveSnippet(kids: KidSummary[], address: string | null): string {
  const hasKids = kids.length > 0;
  const hasAddress = !!address;

  const kidParts = hasKids
    ? kids
        .map((k) => {
          const age = kidAgeYears(k.birth_date);
          return age != null ? `${k.name} (${age})` : k.name;
        })
        .join(" · ")
    : null;

  const hasInterests = kids.some((k) => k.interests && k.interests.length > 0);

  // Derive a short location label (first segment of address)
  const locationLabel = address ? address.split(",")[0].trim() : null;

  if (hasKids && hasAddress) {
    const parts = [kidParts, locationLabel];
    if (hasInterests) parts.push("interests on file");
    return parts.filter(Boolean).join(" · ");
  }
  if (hasAddress && !hasKids) {
    return `${locationLabel} · no kid details on file`;
  }
  if (hasKids && !hasAddress) {
    const parts = [kidParts, "location not set"];
    return parts.filter(Boolean).join(" · ");
  }
  // neither — fallback handled by caller
  return "";
}

function formatAgeRange(min: number | null, max: number | null): string | null {
  if (min != null && max != null) return `Ages ${min}–${max}`;
  if (min != null) return `Ages ${min}+`;
  if (max != null) return `Up to age ${max}`;
  return null;
}

export function HelpMeFindPanel({ open, onClose, kids, address: initialAddress, onSaved }: Props) {
  const [prompt, setPrompt] = useState("");
  const [useContext, setUseContext] = useState(true);
  const [results, setResults] = useState<MockResult[] | null>(null);
  const [isFinding, setIsFinding] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [addressDraft, setAddressDraft] = useState("");
  const [currentAddress, setCurrentAddress] = useState<string | null>(initialAddress);
  const [savingAddress, startAddressTransition] = useTransition();

  // Sync address if parent re-renders with new value
  useEffect(() => {
    setCurrentAddress(initialAddress);
  }, [initialAddress]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const snippet = deriveSnippet(kids, currentAddress);
  const hasNoContext = !currentAddress && kids.length === 0;
  const showAddressForm = useContext && !currentAddress;

  function handleFind() {
    if (!prompt.trim() || isFinding) return;
    setIsFinding(true);
    setResults(null);
    setSavedIds(new Set());
    setTimeout(() => {
      setResults(MOCK_RESULTS);
      setIsFinding(false);
    }, 600);
  }

  async function handleSave(result: MockResult) {
    if (savedIds.has(result.id) || savingIds.has(result.id)) return;
    setSavingIds((prev) => new Set(prev).add(result.id));
    const res = await saveHelpMeFindResult({
      name: result.name,
      url: result.url,
      organizationName: result.organizationName,
      description: result.description,
      categories: result.categories,
      ageMin: result.ageMin,
      ageMax: result.ageMax,
      registrationEndDate: result.registrationEndDate,
      discoveryQuery: prompt,
    });
    setSavingIds((prev) => {
      const next = new Set(prev);
      next.delete(result.id);
      return next;
    });
    if (!res.error) {
      setSavedIds((prev) => new Set(prev).add(result.id));
      onSaved();
    }
  }

  function handleSaveAddress() {
    if (!addressDraft.trim()) return;
    startAddressTransition(async () => {
      const res = await saveProfileAddress(addressDraft.trim());
      if (!res.error) {
        setCurrentAddress(addressDraft.trim());
        setAddressDraft("");
      }
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-ink/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Help me find"
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[600px] max-w-full bg-surface border-l border-ink overflow-y-auto flex flex-col"
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-3 px-6 pt-6 pb-2">
          <div>
            <h2 className="font-display font-extrabold text-2xl text-ink tracking-tight flex items-center gap-2">
              <SparkleIcon size={18} fill="#151515" />
              Looking for ideas?
            </h2>
            <p className="font-sans text-sm text-ink-2 mt-1">
              Tell us what you&apos;re hoping to find — we&apos;ll pull some options.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-2 hover:text-ink text-2xl leading-none p-1"
          >
            ✕
          </button>
        </header>

        {/* Prompt input */}
        <section className="px-6 pt-4 mb-4">
          <label className="font-sans text-[10px] uppercase tracking-widest text-ink-2 block mb-1">
            What are you looking for?
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Outdoor art camps for the summer, half-day, easy to get to from Park Slope"
            className="w-full bg-surface border border-ink rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-ink resize-y min-h-[80px] font-sans text-sm"
          />
        </section>

        {/* Context opt-in box */}
        <section className="px-6 mb-4">
          <div className="bg-[#fff5d4] border border-ink-3 rounded-lg p-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useContext}
                onChange={(e) => setUseContext(e.target.checked)}
                className="mt-0.5 flex-shrink-0 accent-ink"
              />
              <span className="font-sans text-sm text-ink leading-snug">
                Use what we know about your{" "}
                <strong>location</strong>, <strong>kids</strong>, and{" "}
                <strong>their interests</strong>?
              </span>
            </label>

            {useContext && !hasNoContext && snippet && (
              <p className="font-sans text-xs text-ink-2 mt-2 ml-5">
                {snippet}
              </p>
            )}

            {showAddressForm && (
              <div className="mt-3 pt-3 border-t border-ink-3/40">
                <p className="font-sans text-xs text-ink mb-2">
                  We need a starting point. Where should we look around?
                </p>
                <div className="flex gap-2">
                  <input
                    value={addressDraft}
                    onChange={(e) => setAddressDraft(e.target.value)}
                    placeholder="123 Main St, Brooklyn NY"
                    className="flex-1 bg-surface border border-ink rounded-lg px-3 py-2 text-sm text-ink focus:outline-none font-sans"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSaveAddress();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveAddress}
                    disabled={savingAddress || !addressDraft.trim()}
                    className="font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full bg-ink text-ink-inverse border border-ink disabled:opacity-50 whitespace-nowrap"
                  >
                    {savingAddress ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            )}

            {useContext && hasNoContext && !showAddressForm && (
              <p className="font-sans text-xs text-ink-2 mt-2 ml-5">
                No location or kid details on file yet.
              </p>
            )}
          </div>
        </section>

        {/* Find button */}
        <section className="px-6 mb-4">
          <button
            type="button"
            onClick={handleFind}
            disabled={!prompt.trim() || isFinding}
            className="w-full inline-flex items-center justify-center gap-2 font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-3 rounded-full bg-ink text-ink-inverse border border-ink disabled:opacity-50"
          >
            <SparkleIcon size={11} fill="#ffffff" />
            {isFinding ? "Looking…" : "Help me find"}
          </button>
        </section>

        {/* Results list */}
        {results !== null && (
          <section className="px-6 mb-4">
            <p className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-3">
              Options · {results.length} found
            </p>
            <div className="space-y-3">
              {results.map((result) => {
                const isSaved = savedIds.has(result.id);
                const isSaving = savingIds.has(result.id);
                const ageRange = formatAgeRange(result.ageMin, result.ageMax);
                const catLabels = result.categories.map(categoryLabel).join(" · ");
                const metaParts = [
                  result.organizationName,
                  catLabels || null,
                  ageRange,
                  result.neighborhood && result.distanceMiles != null
                    ? `${result.neighborhood} (${result.distanceMiles} mi)`
                    : result.neighborhood,
                ].filter(Boolean);

                return (
                  <div
                    key={result.id}
                    className="bg-surface border border-ink-3 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display font-extrabold text-sm text-ink leading-snug">
                        {result.name}
                      </h3>
                      <button
                        type="button"
                        onClick={() => handleSave(result)}
                        disabled={isSaved || isSaving}
                        className={[
                          "flex-shrink-0 font-sans text-[10px] font-semibold tracking-wide px-2.5 py-1 rounded-full border border-ink whitespace-nowrap",
                          isSaved
                            ? "bg-status-registered text-ink"
                            : "bg-surface text-ink",
                          isSaving ? "opacity-50" : "",
                        ].join(" ")}
                      >
                        {isSaved ? "✓ Saved" : isSaving ? "Saving…" : "+ Save"}
                      </button>
                    </div>

                    {metaParts.length > 0 && (
                      <p className="font-sans text-xs text-ink-2 mt-1">
                        {metaParts.join(" · ")}
                      </p>
                    )}

                    {result.description && (
                      <p className="font-sans text-xs text-ink-2 mt-1">
                        {result.description}
                      </p>
                    )}

                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-sans text-[10px] text-ink underline underline-offset-2 mt-1.5 block truncate"
                    >
                      {result.url}
                    </a>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Spacer to push footer to bottom when results are short */}
        <div className="flex-1" />

        {/* Footer caveat */}
        <footer className="px-6 pb-6 pt-4">
          <p className="font-sans text-xs text-ink-2 italic text-center inline-flex items-center justify-center gap-2 w-full">
            <SparkleIcon size={9} fill="#666666" />
            These come from the web — double-check dates and registration before signing up.
          </p>
        </footer>
      </div>
    </>
  );
}
