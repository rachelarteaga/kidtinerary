"use client";

import type { UserCampWithActivity } from "@/lib/queries";

interface Props {
  activities: UserCampWithActivity[];
  onPick: (userCampId: string) => void;
}

function renderName(name: string): React.ReactNode {
  const lower = name.toLowerCase();
  const idx = lower.indexOf("verified");
  if (idx === -1) return name;
  return (
    <>
      <span>{name.slice(0, idx + 4)}</span>
      <span>{name.slice(idx + 4)}</span>
    </>
  );
}

export function ActivityPickerSection({ activities, onPick }: Props) {
  if (activities.length === 0) return null;

  return (
    <div className="mb-4">
      <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">
        From my activities
      </h3>
      <div
        className="space-y-2 overflow-y-auto pr-1"
        style={{ maxHeight: 240 }}
      >
        {activities.map((a) => {
          const orgName = a.activity.organization?.name ?? null;
          const showOrg =
            !!orgName && orgName !== a.activity.name && orgName !== "User-submitted";
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onPick(a.id)}
              className="w-full text-left rounded-lg border border-ink-3 bg-white p-2.5 hover:border-ink transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-1.5">
                <span
                  className="w-2 h-2 mt-1.5 rounded-full flex-shrink-0"
                  style={{ background: a.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-ink break-words">
                    {renderName(a.activity.name)}
                  </div>
                  {showOrg && (
                    <div className="mt-0.5 font-sans text-[11px] text-ink-2 break-words">
                      {orgName}
                    </div>
                  )}
                  <div className="mt-1 flex items-center gap-2 font-sans text-[10px] uppercase tracking-wide text-ink-2">
                    {a.plannerEntryCount > 0 && <span>{a.plannerEntryCount}x</span>}
                    {a.activity.verified && (
                      <span className="text-[#5fc39c]">verified</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
