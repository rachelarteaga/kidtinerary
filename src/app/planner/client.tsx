"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlannerMatrix, type WeekRow, type CellEntry } from "@/components/planner/matrix";
import { MyCampsRow } from "@/components/planner/my-camps-row";
import { AddCampModal } from "@/components/planner/add-camp-modal";
import { AddBlockModal } from "@/components/planner/add-block-modal";
import { useScrapeJob } from "@/lib/use-scrape-job";
import { generateWeeks, getWeekKey, formatTimeSlot, formatPrice, formatPriceUnit } from "@/lib/format";
import { detectSharedEntries } from "@/lib/planner-matrix";
import type { PlannerEntryRow, UserCampWithActivity, PlannerBlockWithKids } from "@/lib/queries";

interface Kid {
  id: string;
  name: string;
  birth_date: string;
  color: string;
  avatar_url: string | null;
  sort_order: number;
  interests: string[];
}

interface Props {
  kids: Kid[];
  entries: PlannerEntryRow[];
  userCamps: UserCampWithActivity[];
  blocks: PlannerBlockWithKids[];
  shareCampsDefault: boolean;
}

export function PlannerClient({ kids, entries, userCamps, blocks, shareCampsDefault }: Props) {
  const router = useRouter();
  const [campModal, setCampModal] = useState<{ childId: string | null; weekStart: string | null } | null>(null);
  const [blockModal, setBlockModal] = useState<{ childId: string | null; weekStart: string | null } | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const { done } = useScrapeJob(activeJobId);
  useMemo(() => {
    if (done && activeJobId) {
      setActiveJobId(null);
      router.refresh();
    }
  }, [done, activeJobId, router]);

  const dateRange = useMemo(() => {
    const from = new Date();
    const to = new Date();
    to.setMonth(to.getMonth() + 3);
    return { from, to };
  }, []);

  const weekStarts = useMemo(() => generateWeeks(dateRange.from, dateRange.to), [dateRange]);

  const sharingInput = entries.map((e) => ({
    entryId: e.id,
    childId: e.child_id,
    activityId: e.session.activity.id,
    weekKey: getWeekKey(new Date(e.session.starts_at + "T00:00:00")),
  }));
  const sharedMap = detectSharedEntries(sharingInput, kids.map((k) => ({ id: k.id, name: k.name })));

  const weeks: WeekRow[] = weekStarts.map((weekStart) => {
    const weekKey = getWeekKey(weekStart);

    const cells = kids.map((kid) => {
      const kidEntries = entries.filter((e) => {
        if (e.child_id !== kid.id) return false;
        const ws = new Date(e.session.starts_at + "T00:00:00");
        return getWeekKey(ws) === weekKey;
      });
      const cellEntries: CellEntry[] = kidEntries.map((e) => {
        const act = e.session.activity as any;
        const lowest = act.price_options?.[0];
        return {
          kind: "camp" as const,
          entryId: e.id,
          activityName: act.name,
          activitySlug: act.slug,
          status: e.status as any,
          timeLabel: e.session.time_slot ? formatTimeSlot(e.session.time_slot as any) : null,
          priceLabel: lowest ? `${formatPrice(lowest.price_cents)}${formatPriceUnit(lowest.price_unit as any)}` : null,
          sharedWith: sharedMap.get(e.id) ?? [],
          isLoading: !act.verified && (act.price_options?.length ?? 0) === 0,
        };
      });
      return { childId: kid.id, entries: cellEntries };
    });

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const overlaps = blocks.filter(
      (b) => new Date(b.start_date) <= weekEnd && new Date(b.end_date) >= weekStart
    );

    let fullRowBlock: WeekRow["fullRowBlock"] = null;
    const partialBlocksByChild: WeekRow["partialBlocksByChild"] = {};
    for (const b of overlaps) {
      const coversAll = kids.every((k) => b.child_ids.includes(k.id));
      if (coversAll) {
        fullRowBlock = { blockId: b.id, type: b.type, title: b.title, emoji: b.emoji, subtitle: `${b.child_ids.length} kids` };
      } else {
        for (const cid of b.child_ids) partialBlocksByChild[cid] = { blockId: b.id, type: b.type, title: b.title, emoji: b.emoji };
      }
    }

    return { weekStart, cells, fullRowBlock, partialBlocksByChild };
  });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-4xl mb-1">Planner</h1>
          <p className="text-stone">{kids.length} kid{kids.length === 1 ? "" : "s"} · {weeks.length} weeks</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCampModal({ childId: null, weekStart: null })}
            className="font-mono text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-bark text-cream hover:bg-bark/90"
          >
            + Add camp
          </button>
          <button
            onClick={() => setBlockModal({ childId: null, weekStart: null })}
            className="font-mono text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-white border border-driftwood text-bark hover:border-bark"
          >
            + Add block
          </button>
        </div>
      </header>

      <MyCampsRow
        camps={userCamps}
        onChipClick={(c) => router.push(`/activity/${c.activity.slug}`)}
        onAddClick={() => setCampModal({ childId: null, weekStart: null })}
      />

      <PlannerMatrix
        children={kids}
        weeks={weeks}
        onAddCampClick={(childId, weekStart) => setCampModal({ childId, weekStart })}
        onAddBlockClick={(childId, weekStart) => setBlockModal({ childId, weekStart })}
        onChanged={() => router.refresh()}
      />

      <AddCampModal
        open={campModal !== null}
        onClose={() => setCampModal(null)}
        scope={campModal ?? { childId: null, weekStart: null }}
        shareCampsDefault={shareCampsDefault}
        onSubmitted={(result) => {
          if (result.jobId) setActiveJobId(result.jobId);
          router.refresh();
        }}
      />
      <AddBlockModal
        open={blockModal !== null}
        onClose={() => setBlockModal(null)}
        children={kids}
        scope={blockModal ?? { childId: null, weekStart: null }}
        onSubmitted={() => router.refresh()}
      />
    </main>
  );
}
