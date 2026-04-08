import { Tag } from "@/components/ui/tag";
import { formatDateRange, formatTime, formatTimeSlot } from "@/lib/format";

interface Session {
  id: string;
  starts_at: string;
  ends_at: string;
  time_slot: string;
  hours_start: string | null;
  hours_end: string | null;
  is_sold_out: boolean;
  spots_available: number | null;
}

interface SessionTableProps {
  sessions: Session[];
}

export function SessionTable({ sessions }: SessionTableProps) {
  if (!sessions || sessions.length === 0) {
    return (
      <div className="text-center py-6 text-stone">
        <p>No sessions listed yet. Check the camp website for details.</p>
      </div>
    );
  }

  // Sort by start date
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-driftwood/30">
            <th className="text-left font-mono text-[10px] uppercase tracking-wide text-stone pb-2 pr-4">
              Dates
            </th>
            <th className="text-left font-mono text-[10px] uppercase tracking-wide text-stone pb-2 pr-4">
              Schedule
            </th>
            <th className="text-left font-mono text-[10px] uppercase tracking-wide text-stone pb-2 pr-4">
              Hours
            </th>
            <th className="text-right font-mono text-[10px] uppercase tracking-wide text-stone pb-2">
              Availability
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-driftwood/15">
          {sorted.map((session) => (
            <tr key={session.id} className={session.is_sold_out ? "opacity-50" : ""}>
              <td className="py-3 pr-4">
                <span className="font-medium">
                  {formatDateRange(session.starts_at, session.ends_at)}
                </span>
              </td>
              <td className="py-3 pr-4">
                <Tag type="schedule" label={formatTimeSlot(session.time_slot as any)} />
              </td>
              <td className="py-3 pr-4 font-mono text-xs text-stone">
                {session.hours_start && session.hours_end
                  ? `${formatTime(session.hours_start)} – ${formatTime(session.hours_end)}`
                  : "TBD"}
              </td>
              <td className="py-3 text-right">
                {session.is_sold_out ? (
                  <span className="font-mono text-[10px] uppercase tracking-wide text-red-500 bg-red-50 px-2 py-1 rounded-md">
                    Sold Out
                  </span>
                ) : session.spots_available != null ? (
                  <span className="font-mono text-[10px] uppercase tracking-wide text-meadow">
                    {session.spots_available} spots left
                  </span>
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-wide text-stone">
                    Available
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
