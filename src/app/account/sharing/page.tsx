import Link from "next/link";

export const metadata = {
  title: "Share preferences — Kidtinerary",
};

export default function SharingPreferencesPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-display font-extrabold text-4xl text-ink tracking-tight mb-2">
        Share preferences
      </h1>
      <p className="text-ink-2 mb-8">
        Control who can see the camps you&apos;ve added and the planners you share.
      </p>

      <div className="rounded-lg border border-ink-3 bg-surface p-6">
        <p className="font-sans text-sm text-ink-2 leading-relaxed">
          Share preferences are coming soon. For now, each shared planner gets its own
          public link from the <strong className="text-ink">Share</strong> button on
          the planner page. Anyone with the link can view — nobody else.
        </p>
      </div>

      <div className="mt-8">
        <Link
          href="/planner"
          className="font-sans font-bold text-[11px] uppercase tracking-widest text-ink hover:underline"
        >
          ← Back to planner
        </Link>
      </div>
    </main>
  );
}
