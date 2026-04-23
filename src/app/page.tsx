import Link from "next/link";

export default function Home() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
      <section className="text-center">
        <p className="font-sans text-[11px] uppercase tracking-widest text-ink-2 mb-6">
          For parents in the Triangle
        </p>

        <h1 className="font-display font-extrabold text-ink leading-[1.05] tracking-tight text-5xl sm:text-6xl md:text-7xl mb-6">
          Camps and activities
          <br />
          your kids will love.
        </h1>

        <p className="text-ink-2 text-lg sm:text-xl max-w-xl mx-auto mb-10">
          Kidtinerary helps you discover local camps, classes, and extracurriculars
          for kids ages 3–12 — then plan the whole year on one schedule so no
          registration deadline slips by.
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

      <section className="mt-28 grid gap-10 sm:grid-cols-3 text-center">
        <div>
          <p className="font-sans text-[11px] uppercase tracking-widest text-ink-2 mb-2">
            Discover
          </p>
          <p className="font-display font-semibold text-ink text-lg">
            A verified directory of camps and classes near you.
          </p>
        </div>
        <div>
          <p className="font-sans text-[11px] uppercase tracking-widest text-ink-2 mb-2">
            Plan
          </p>
          <p className="font-display font-semibold text-ink text-lg">
            See every kid&apos;s summer on one timeline — catch conflicts early.
          </p>
        </div>
        <div>
          <p className="font-sans text-[11px] uppercase tracking-widest text-ink-2 mb-2">
            Register
          </p>
          <p className="font-display font-semibold text-ink text-lg">
            Track deadlines and status so nothing slips through the cracks.
          </p>
        </div>
      </section>
    </main>
  );
}
