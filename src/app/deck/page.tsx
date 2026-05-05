import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kidtinerary — what we're building",
  robots: { index: false, follow: false },
};

function Page1Cover() {
  return (
    <section className="deck-page">
      <div className="flex-1 flex flex-col justify-between p-16">
        <div className="flex items-center gap-3">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ background: "var(--color-hero)" }}
          />
          <span className="font-display text-sm tracking-[0.2em] uppercase text-ink-2">
            Kidtinerary
          </span>
        </div>
        <div>
          <h1 className="font-display font-extrabold text-[88px] leading-[0.95] tracking-tight">
            Every activity<br />your kid does,<br />in one place.
          </h1>
          <p className="mt-8 max-w-[560px] text-xl text-ink-2 leading-relaxed">
            A personal catalog of every camp, class, lesson, and sport &mdash; past, present, and considering. With a text when it&rsquo;s time to sign up, pay, or show up.
          </p>
        </div>
        <div className="flex items-baseline justify-between text-sm text-ink-2">
          <span>Building in public &middot; Rachel Arteaga</span>
          <span>kidtinerary-sable.vercel.app</span>
        </div>
      </div>
    </section>
  );
}

function Page2Problem() {
  const pains = [
    {
      title: "Registration windows are unforgiving.",
      body: "Camps and programs open on a Tuesday at 9am, sell out by 9:07am, and there&rsquo;s no calendar that knows about any of them.",
    },
    {
      title: "Information lives in a hundred tabs.",
      body: "PDFs, group texts, school newsletters, half-remembered conversations at pickup. Nothing aggregates.",
    },
    {
      title: "Coordinating across kids and parents is manual.",
      body: "Two kids, two schedules, two adults trying to keep them straight in a shared notes app or a spreadsheet that starts strong and dies in March.",
    },
  ];
  return (
    <section className="deck-page">
      <div className="flex-1 flex flex-col p-16">
        <span className="font-display text-sm tracking-[0.2em] uppercase text-ink-2">
          The problem
        </span>
        <h2 className="mt-4 font-display font-bold text-[56px] leading-[1.05] max-w-[660px]">
          Coordinating a kid&rsquo;s year is a part-time job nobody asked for.
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-8 max-w-[640px]">
          {pains.map((p) => (
            <div key={p.title}>
              <p className="font-display font-semibold text-xl">{p.title}</p>
              <p
                className="mt-2 text-ink-2 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: p.body }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Page3WhatItIs() {
  return (
    <section className="deck-page">
      <div className="flex-1 flex flex-col p-16">
        <span className="font-display text-sm tracking-[0.2em] uppercase text-ink-2">
          What it is
        </span>
        <h2 className="mt-4 font-display font-bold text-[56px] leading-[1.05] max-w-[680px]">
          A planner for everything in a kid&rsquo;s life.
        </h2>
        <p className="mt-8 text-xl text-ink-2 leading-relaxed max-w-[640px]">
          Camps, classes, after-school, weekends, school breaks. One place to hold what your kids are doing, what they&rsquo;re considering, and what&rsquo;s already locked in &mdash; week by week, kid by kid.
        </p>
        <p className="mt-6 text-xl text-ink-2 leading-relaxed max-w-[640px]">
          Summer-camp planning is the most-built example today. The model underneath is broader: every activity in the year your family is choosing, or not choosing, together.
        </p>
      </div>
    </section>
  );
}

function Page4Bets() {
  const bets = [
    {
      n: "01",
      title: "Structure beats chaos.",
      body: "Spreadsheets and group chats fall apart by mid-March. A real data model &mdash; kids, weeks, statuses &mdash; doesn&rsquo;t.",
    },
    {
      n: "02",
      title: "Planning is a social act.",
      body: "Families don&rsquo;t plan alone. Co-parents, friends with shared schedules, agents acting on your behalf &mdash; all should be first-class.",
    },
    {
      n: "03",
      title: "AI-forward, not AI-decorative.",
      body: "&lsquo;Help me find,&rsquo; agent-friendly write APIs, email parsing into structured updates. AI does the busywork; humans make the calls.",
    },
  ];
  return (
    <section className="deck-page">
      <div className="flex-1 flex flex-col p-16">
        <span className="font-display text-sm tracking-[0.2em] uppercase text-ink-2">
          The bets
        </span>
        <h2 className="mt-4 font-display font-bold text-[56px] leading-[1.05]">
          Three things we believe.
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-10">
          {bets.map((b) => (
            <div key={b.n} className="flex gap-8 items-start">
              <span className="font-display font-bold text-4xl text-ink-3 w-16 shrink-0">
                {b.n}
              </span>
              <div>
                <p className="font-display font-semibold text-2xl">{b.title}</p>
                <p
                  className="mt-2 text-ink-2 leading-relaxed max-w-[560px]"
                  dangerouslySetInnerHTML={{ __html: b.body }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ScreenshotPage(props: {
  eyebrow: string;
  title: string;
  caption: string;
  imgSrc: string;
  imgAlt: string;
}) {
  return (
    <section className="deck-page">
      <div className="flex-1 flex flex-col p-12 overflow-hidden">
        <span className="font-display text-sm tracking-[0.2em] uppercase text-ink-2">
          {props.eyebrow}
        </span>
        <h2 className="mt-2 font-display font-bold text-[36px] leading-[1.05] max-w-[680px]">
          {props.title}
        </h2>
        <div className="mt-5 flex-1 flex items-center justify-center min-h-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={props.imgSrc}
            alt={props.imgAlt}
            className="max-w-full max-h-full object-contain rounded-xl shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)] border border-ink-3/30"
          />
        </div>
        <p className="mt-4 text-ink-2 text-[14px] leading-relaxed max-w-[680px]">
          {props.caption}
        </p>
      </div>
    </section>
  );
}

function Page5Planner() {
  return (
    <ScreenshotPage
      eyebrow="Current state · Planner"
      title="Every kid&rsquo;s year on one grid."
      caption={"Drag activities from the rail onto weeks. Statuses (considering, waitlisted, registered) are colored, time-of-day is set per activity, conflicts surface automatically, and overnight camps and vacation blocks live alongside class schedules."}
      imgSrc="/deck/screenshots/schedule.png"
      imgAlt="Kidtinerary planner showing weeks across two kids with mixed activity statuses, time-of-day blocks, and overnight camps"
    />
  );
}

function Page6Catalog() {
  const rows = [
    { name: "Coding Camp", org: "Galileo Learning", status: "Registered", color: "var(--color-camp-periwinkle)" },
    { name: "Soccer Shots", org: "Soccer Shots Bay Area", status: "Registered", color: "var(--color-camp-mint)" },
    { name: "Catalina Sea Camp", org: "Catalina Island Camps", status: "Registered", color: "var(--color-camp-rose)" },
    { name: "Robotics After-School", org: "Code Ninjas", status: "Waitlisted", color: "var(--color-camp-rose)" },
    { name: "Sharon Art Studio Weekday Class", org: "Sharon Art Studio", status: "Considering", color: "var(--color-camp-mint)" },
    { name: "Discovery Summer Camp", org: "Bay Area Discovery Museum", status: "Registered", color: "var(--color-camp-periwinkle)" },
  ];
  const statusBg = (s: string) =>
    s === "Registered" ? "var(--color-status-registered)" :
    s === "Waitlisted" ? "var(--color-status-waitlisted)" :
    "var(--color-status-considering)";
  return (
    <section className="deck-page">
      <div className="flex-1 flex flex-col p-12">
        <span className="font-display text-sm tracking-[0.2em] uppercase text-ink-2">
          Current state &middot; Catalog
        </span>
        <h2 className="mt-3 font-display font-bold text-[40px] leading-[1.05] max-w-[680px]">
          A personal master library, plus an AI scout.
        </h2>
        <div className="mt-8 rounded-2xl border border-ink-3/40 bg-base/30 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-ink-3/40 bg-surface">
            <span className="font-display font-semibold">My catalog</span>
            <div className="flex gap-2">
              <span className="font-sans text-[11px] uppercase tracking-widest font-extrabold text-ink-inverse bg-ink rounded-full px-3 py-1.5">+ Add activity</span>
              <span className="font-sans text-[11px] uppercase tracking-widest font-extrabold text-ink border border-ink rounded-full px-3 py-1.5">Help me find</span>
            </div>
          </div>
          {rows.map((r, i) => (
            <div key={r.name} className={`flex items-center justify-between px-5 py-3 ${i < rows.length - 1 ? "border-b border-ink-3/30" : ""}`}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
                <div className="min-w-0">
                  <p className="font-display font-semibold text-[15px] truncate">{r.name}</p>
                  <p className="text-ink-2 text-[12px] truncate">{r.org}</p>
                </div>
              </div>
              <span
                className="font-sans text-[10px] uppercase tracking-widest font-extrabold rounded-full px-2.5 py-1 shrink-0"
                style={{ background: statusBg(r.status), color: "var(--color-ink)" }}
              >
                {r.status}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-6 text-ink-2 text-base leading-relaxed max-w-[680px]">
          Every camp, class, and lesson you&rsquo;ve ever considered &mdash; in one library you keep year over year. <strong className="text-ink font-semibold">Help me find</strong> runs an LLM-powered web search, returns real options, and drops them straight into your catalog.
        </p>
      </div>
    </section>
  );
}

function Page7Onboarding() {
  const interests = ["Sports", "Arts", "STEM", "Nature", "Music", "Theater", "Academic", "Swimming", "Cooking"];
  return (
    <section className="deck-page">
      <div className="flex-1 flex flex-col p-12">
        <span className="font-display text-sm tracking-[0.2em] uppercase text-ink-2">
          Current state &middot; Kids &amp; onboarding
        </span>
        <h2 className="mt-3 font-display font-bold text-[40px] leading-[1.05] max-w-[680px]">
          The smallest viable picture of each kid.
        </h2>
        <div className="mt-8 grid grid-cols-2 gap-5">
          {[
            { initial: "N", name: "Nico", age: "7 yrs", picks: ["Sports", "STEM", "Nature"] },
            { initial: "L", name: "Luca", age: "5 yrs", picks: ["Music", "Arts", "Cooking"] },
          ].map((k) => (
            <div key={k.name} className="rounded-2xl border border-ink-3/40 bg-surface p-5">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-ink text-ink-inverse font-display font-bold text-base">
                  {k.initial}
                </span>
                <div>
                  <p className="font-display font-bold text-xl leading-tight">{k.name}</p>
                  <p className="text-ink-2 text-sm">{k.age}</p>
                </div>
              </div>
              <p className="mt-5 font-sans text-[10px] uppercase tracking-widest font-extrabold text-ink-2">Loves</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {k.picks.map((p) => (
                  <span key={p} className="font-sans text-[11px] uppercase tracking-wider font-bold text-ink border border-ink-3 rounded-full px-3 py-1">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <p className="font-sans text-[10px] uppercase tracking-widest font-extrabold text-ink-2">All categories</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {interests.map((p) => (
              <span key={p} className="font-sans text-[11px] uppercase tracking-wider font-semibold text-ink-2 border border-ink-3/60 rounded-full px-3 py-1">
                {p}
              </span>
            ))}
          </div>
        </div>
        <p className="mt-7 text-ink-2 text-base leading-relaxed max-w-[680px]">
          Onboarding asks for name, age, and the kinds of things each kid loves &mdash; nothing more &mdash; and lands you on an empty planner ready to fill.
        </p>
      </div>
    </section>
  );
}

function Page8Schedule() {
  return (
    <ScreenshotPage
      eyebrow="Current state · Sharing"
      title="A read-only link anyone can open."
      caption={"One tap turns a planner into a public, anon-friendly URL: text it to a co-parent, a grandparent, or a babysitter. The recipient sees the same grid in view-only mode &mdash; no account required, revocable any time."}
      imgSrc="/deck/screenshots/schedule.png"
      imgAlt="Public schedule view shown to an anonymous viewer"
    />
  );
}

function Page9WhatsNext() {
  const items = [
    {
      title: "Collections",
      body: "A staging layer between catalog and planner: &lsquo;Thinking about for Nico, Fall 2026.&rsquo; Pinterest-board adjacent. Catalog &rarr; Collections &rarr; Planner.",
    },
    {
      title: "Bring your agent",
      body: "An MCP server and write API so a parent&rsquo;s AI agent can flip a status, set a registration date, or parse a confirmation email straight into the planner.",
    },
    {
      title: "Planning with friends",
      body: "Linked planners across families &mdash; when kids share a camp, the activity lights up on each parent&rsquo;s grid. Coordinate carpools, sign up together.",
    },
    {
      title: "Calendar view",
      body: "An alternative to the weekly grid for users who think in calendar layouts &mdash; visualizes single-day events, dropoff times, conflicts at a glance.",
    },
    {
      title: "Predictive address everywhere",
      body: "One shared autocomplete component for every address input &mdash; kid home, camp location, organization &mdash; instead of free-text.",
    },
    {
      title: "Rich link previews on share",
      body: "When a planner link gets texted, the preview shows a branded card: &lsquo;Rachel shared {planner name} with you&rsquo; instead of a bare URL that reads as spam.",
    },
  ];
  return (
    <section className="deck-page">
      <div className="flex-1 flex flex-col p-12">
        <span className="font-display text-sm tracking-[0.2em] uppercase text-ink-2">
          What&rsquo;s next
        </span>
        <h2 className="mt-3 font-display font-bold text-[40px] leading-[1.05] max-w-[680px]">
          The roadmap, in plain English.
        </h2>
        <div className="mt-10 grid grid-cols-2 gap-x-10 gap-y-7">
          {items.map((it) => (
            <div key={it.title}>
              <p className="font-display font-semibold text-lg">{it.title}</p>
              <p
                className="mt-1 text-ink-2 text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: it.body }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Page10Closing() {
  return (
    <section className="deck-page">
      <div className="flex-1 flex flex-col justify-between p-16">
        <span className="font-display text-sm tracking-[0.2em] uppercase text-ink-2">
          The bigger picture
        </span>
        <div>
          <h2 className="font-display font-bold text-[64px] leading-[1.0] max-w-[660px]">
            Every activity, every kid, every week of the year.
          </h2>
          <p className="mt-8 text-xl text-ink-2 leading-relaxed max-w-[600px]">
            Summer camps got us started. The product underneath is built for the rest of the year too &mdash; school-year classes, after-school, weekends, breaks &mdash; all in the same grid.
          </p>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="font-display text-sm tracking-[0.2em] uppercase text-ink-2">
              Try it
            </p>
            <p className="mt-1 font-display text-xl">
              kidtinerary-sable.vercel.app
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-sm tracking-[0.2em] uppercase text-ink-2">
              Reach out
            </p>
            <p className="mt-1 font-display text-xl">
              rachelressner@gmail.com
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function DeckPage() {
  return (
    <>
      <Page1Cover />
      <Page2Problem />
      <Page3WhatItIs />
      <Page4Bets />
      <Page5Planner />
      <Page6Catalog />
      <Page7Onboarding />
      <Page8Schedule />
      <Page9WhatsNext />
      <Page10Closing />
    </>
  );
}
