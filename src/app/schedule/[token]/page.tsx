import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchSharedSchedule } from "@/lib/queries";
import { generateWeeks, getWeekKey, formatWeekRange, formatDateRange } from "@/lib/format";

export const dynamic = "force-dynamic";

interface SharedSchedulePageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedSchedulePage({ params }: SharedSchedulePageProps) {
  const { token } = await params;
  const schedule = await fetchSharedSchedule(token);

  if (!schedule) {
    notFound();
  }

  const from = new Date(schedule.date_from + "T00:00:00");
  const to = new Date(schedule.date_to + "T00:00:00");
  const weeks = generateWeeks(from, to);

  // Group entries by week key
  const entriesByWeek: Record<string, typeof schedule.entries> = {};
  for (const entry of schedule.entries) {
    const startDate = new Date(entry.session.starts_at + "T00:00:00");
    const key = getWeekKey(startDate);
    if (!entriesByWeek[key]) entriesByWeek[key] = [];
    entriesByWeek[key].push(entry);
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <p className="font-mono text-xs uppercase tracking-widest text-stone mb-2">
          Shared Schedule
        </p>
        <h1 className="font-serif text-4xl mb-2">{schedule.child_name}&apos;s Plan</h1>
        <p className="text-stone">
          {formatDateRange(schedule.date_from, schedule.date_to)}
        </p>
      </div>

      {/* Week grid */}
      <div className="space-y-3 mb-12">
        {weeks.map((weekStart) => {
          const key = getWeekKey(weekStart);
          const weekEntries = entriesByWeek[key] ?? [];
          const hasRegistered = weekEntries.some((e) => e.status === "registered");

          return (
            <div
              key={key}
              className={`rounded-xl border p-4 bg-white ${
                hasRegistered ? "border-meadow/40" : "border-driftwood/30"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs uppercase tracking-widest text-stone">
                  {formatWeekRange(weekStart)}
                </span>
                {hasRegistered && (
                  <span className="font-mono text-[10px] uppercase tracking-widest text-meadow bg-meadow/10 rounded-full px-2 py-0.5">
                    Registered
                  </span>
                )}
              </div>

              {weekEntries.length === 0 ? (
                <p className="text-sm text-stone/60 italic">Nothing planned this week</p>
              ) : (
                <ul className="space-y-2">
                  {weekEntries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-start justify-between gap-3"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${
                            entry.status === "registered"
                              ? "bg-meadow"
                              : entry.status === "waitlisted"
                                ? "bg-sunset"
                                : "bg-driftwood/50"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {entry.session.activity.name}
                          </p>
                          <p className="text-xs text-stone">
                            {formatDateRange(
                              entry.session.starts_at,
                              entry.session.ends_at
                            )}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 font-mono text-[10px] uppercase tracking-widest rounded-full px-2 py-0.5 ${
                          entry.status === "registered"
                            ? "text-meadow bg-meadow/10"
                            : entry.status === "waitlisted"
                              ? "text-sunset bg-sunset/10"
                              : "text-stone bg-bark/5"
                        }`}
                      >
                        {entry.status === "registered"
                          ? "Registered"
                          : entry.status === "waitlisted"
                            ? "Waitlisted"
                            : "Considering"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="rounded-2xl bg-cream border border-driftwood/30 p-8 text-center">
        <h2 className="font-serif text-2xl mb-2">Plan your own summer</h2>
        <p className="text-stone mb-6">
          Kidtinerary helps you discover camps, build a schedule, and stay organized —
          all in one place.
        </p>
        <Link
          href="/"
          className="inline-block rounded-full font-mono text-xs uppercase tracking-widest px-6 py-2.5 bg-sunset text-white hover:bg-sunset/90 transition-colors"
        >
          Start Planning Free
        </Link>
      </div>
    </main>
  );
}
