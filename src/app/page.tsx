import Link from "next/link";

export default function Home() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
      <section className="text-center">
        <h1 className="font-display font-extrabold text-ink leading-[1.05] tracking-tight text-5xl sm:text-6xl md:text-7xl mb-6 text-balance">
          Plan your kids&apos; time off, together.
        </h1>

        <p className="text-ink-2 text-lg sm:text-xl max-w-xl mx-auto mb-10">
          Lay out every camp, class, and off-school week on one timeline —
          then share it live with co-parents, sitters, and the friends
          coordinating alongside you.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <Link
            href="/planner"
            className="inline-flex items-center justify-center rounded-full bg-ink text-ink-inverse border border-ink font-sans text-xs uppercase tracking-widest font-bold px-7 py-3 transition-all hover:bg-[#333]"
          >
            Build a planner
          </Link>

          <span className="relative inline-block">
            <button
              type="button"
              disabled
              aria-disabled="true"
              title="Coming soon"
              className="inline-flex items-center justify-center rounded-full bg-disabled text-disabled-accent border border-disabled-accent font-sans text-xs uppercase tracking-widest font-bold px-7 py-3 cursor-not-allowed"
            >
              Explore camps
            </button>
            <span
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-[calc(100%+6px)] px-1.5 py-0.5 rounded-[3px] border font-sans text-[8px] font-extrabold uppercase tracking-wider whitespace-nowrap"
              style={{
                color: "rgba(21,21,21,0.55)",
                borderColor: "rgba(21,21,21,0.35)",
                background: "rgba(255,255,255,0.6)",
                letterSpacing: "0.1em",
              }}
            >
              Coming soon!
            </span>
          </span>
        </div>
      </section>

      <section className="mt-28 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 text-center">
        <div>
          <p className="font-sans text-[11px] uppercase tracking-widest text-ink-2 mb-2">
            Save
          </p>
          <p className="font-display font-semibold text-ink text-lg">
            Catalog the camps you love or want to try.
          </p>
        </div>
        <div>
          <p className="font-sans text-[11px] uppercase tracking-widest text-ink-2 mb-2">
            Plan
          </p>
          <p className="font-display font-semibold text-ink text-lg">
            Every kid&apos;s camps, classes, and off-weeks on one timeline.
          </p>
        </div>
        <div>
          <p className="font-sans text-[11px] uppercase tracking-widest text-ink-2 mb-2">
            Share
          </p>
          <p className="font-display font-semibold text-ink text-lg">
            Send a live link to co-parents, sitters, and grandparents.
          </p>
        </div>
        <div>
          <p className="font-sans text-[11px] uppercase tracking-widest text-ink-2 mb-2">
            Coordinate
          </p>
          <p className="font-display font-semibold text-ink text-lg">
            Line up weeks with the friends planning the same summer.
          </p>
        </div>
      </section>
    </main>
  );
}
