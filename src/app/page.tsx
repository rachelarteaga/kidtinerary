import Link from "next/link";

export default function Home() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
      <section className="text-center">
        <h1 className="font-display font-extrabold text-ink leading-[1.05] tracking-tight text-5xl sm:text-6xl md:text-7xl mb-6 text-balance">
          Every activity your kid does, in one place.
        </h1>

        <p className="text-ink-2 text-lg sm:text-xl max-w-xl mx-auto mb-10">
          A personal catalog of every camp, class, lesson, and sport —
          past, present, and considering. With a text when it&apos;s time
          to sign up, pay, or show up.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <Link
            href="/catalog"
            className="inline-flex items-center justify-center rounded-full bg-ink text-ink-inverse border border-ink font-sans text-xs uppercase tracking-widest font-bold px-7 py-3 transition-all hover:bg-[#333]"
          >
            Start your Catalog
          </Link>

          <Link
            href="/planner"
            className="inline-flex items-center justify-center rounded-full bg-transparent text-ink border border-ink font-sans text-xs uppercase tracking-widest font-bold px-7 py-3 transition-all hover:bg-ink hover:text-ink-inverse"
          >
            Build a planner
          </Link>
        </div>
      </section>

      <section className="mt-28 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 text-center">
        <div>
          <p className="font-sans text-[11px] uppercase tracking-widest text-ink-2 mb-2">
            Capture
          </p>
          <p className="font-display font-semibold text-ink text-lg">
            Paste a link, forward an email, or type it in — any activity
            lands in your Catalog in seconds. Kept year over year.
          </p>
        </div>
        <div>
          <p className="font-sans text-[11px] uppercase tracking-widest text-ink-2 mb-2">
            Plan
          </p>
          <p className="font-display font-semibold text-ink text-lg">
            Arrange every kid&apos;s camps, classes, and lessons on one
            timeline — from one summer to the full school year.
          </p>
        </div>
        <div>
          <p className="font-sans text-[11px] uppercase tracking-widest text-ink-2 mb-2">
            Remind
          </p>
          <p className="font-display font-semibold text-ink text-lg">
            SMS reminders when registration opens, payment is due, or the
            first day approaches. Never miss a window.
          </p>
        </div>
        <div>
          <p className="font-sans text-[11px] uppercase tracking-widest text-ink-2 mb-2">
            Share
          </p>
          <p className="font-display font-semibold text-ink text-lg">
            Text any activity to a friend with one tap. They save it with
            one more.
          </p>
        </div>
      </section>
    </main>
  );
}
