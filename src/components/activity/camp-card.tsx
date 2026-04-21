import Link from "next/link";
import { Tag } from "@/components/ui/tag";
import { formatPrice, formatPriceUnit, formatAgeRange, formatTimeSlot, categoryLabel } from "@/lib/format";
import { CATEGORY_COLORS, type Category } from "@/lib/constants";
import type { ActivityRow } from "@/lib/queries";

interface CampCardProps {
  activity: ActivityRow;
  distance?: number;
}

export function CampCard({ activity, distance }: CampCardProps) {
  const lowestPrice = activity.price_options?.length
    ? activity.price_options.reduce((min, p) => (p.price_cents < min.price_cents ? p : min), activity.price_options[0])
    : null;

  const primaryCategory = activity.categories?.[0] as Category | undefined;
  const categoryColor = primaryCategory ? CATEGORY_COLORS[primaryCategory] : null;

  const firstSession = activity.sessions?.[0];
  const sessionCount = activity.sessions?.length ?? 0;

  const location = activity.activity_locations?.[0];

  return (
    <Link
      href={`/activity/${activity.slug}`}
      className="group block bg-surface rounded-2xl border border-ink-3 shadow-sm hover:shadow-md transition-all overflow-hidden"
    >
      {/* Category color bar */}
      <div
        className={`h-1.5 w-full ${categoryColor?.bg ?? "bg-ink-3"}`}
        style={{
          backgroundColor: primaryCategory
            ? `color-mix(in srgb, ${getHex(primaryCategory)} 30%, transparent)`
            : undefined,
        }}
      />

      <div className="p-5">
        {/* Top row: category icon */}
        <div className="flex items-start justify-between mb-3">
          {/* Category icon */}
          {primaryCategory && (
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm ${categoryColor?.bg ?? ""} ${categoryColor?.text ?? ""}`}
              style={{ transform: "rotate(-3deg)" }}
            >
              {getCategoryEmoji(primaryCategory)}
            </div>
          )}
        </div>

        {/* Org and activity name — visually separate, nearly equal prominence */}
        {activity.organization && (
          <p className="font-sans text-sm font-semibold text-ink/70 mb-0.5">
            {(activity.organization as any).name}
          </p>
        )}
        <h3 className="font-display font-extrabold text-lg leading-tight mb-3 group-hover:text-ink transition-colors">
          {activity.name}
        </h3>

        {/* Tags row */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Tag type="age" label={formatAgeRange(activity.age_min, activity.age_max)} />
          {activity.categories?.slice(0, 2).map((cat) => (
            <Tag key={cat} type="category" label={categoryLabel(cat)} />
          ))}
          {firstSession && (
            <Tag type="schedule" label={formatTimeSlot(firstSession.time_slot as any)} />
          )}
        </div>

        {/* Location */}
        {(location || distance != null) && (
          <p className="text-xs text-ink-2 mb-3 flex items-center gap-1.5 overflow-hidden">
            {location && (
              <span className="truncate min-w-0">
                {(location as any).location_name ?? (location as any).address}
              </span>
            )}
            {distance != null && (
              <span className="font-sans text-[10px] text-ink-3 whitespace-nowrap shrink-0">
                {distance.toFixed(1)} mi
              </span>
            )}
          </p>
        )}

        {/* Bottom row: price + sessions */}
        <div className="flex items-end justify-between pt-2 border-t border-ink-3">
          {lowestPrice ? (
            <div>
              <span className="font-sans text-base font-medium text-ink">
                {formatPrice(lowestPrice.price_cents)}
              </span>
              <span className="font-sans text-[10px] text-ink-2 uppercase tracking-wide ml-0.5">
                {formatPriceUnit(lowestPrice.price_unit as any)}
              </span>
            </div>
          ) : (
            <span className="font-sans text-xs text-ink-2 uppercase">Price TBD</span>
          )}
          {sessionCount > 0 && (
            <span className="font-sans text-[10px] text-ink-2 uppercase tracking-wide">
              {sessionCount} {sessionCount === 1 ? "session" : "sessions"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function getCategoryEmoji(cat: string): string {
  const emojis: Record<string, string> = {
    sports: "⚽",
    arts: "🎨",
    stem: "🔬",
    nature: "🌿",
    music: "🎵",
    theater: "🎭",
    academic: "📚",
    special_needs: "💛",
    religious: "⛪",
    swimming: "🏊",
    cooking: "🍳",
    language: "🗣️",
  };
  return emojis[cat] ?? "📌";
}

function getHex(cat: string): string {
  const hexes: Record<string, string> = {
    sports: "#D4A574",
    arts: "#E07845",
    stem: "#6B8CBB",
    nature: "#5A8F6E",
    music: "#D4A574",
    theater: "#E07845",
    academic: "#6B8CBB",
    special_needs: "#5A8F6E",
    religious: "#D4A574",
    swimming: "#6B8CBB",
    cooking: "#E07845",
    language: "#6B8CBB",
  };
  return hexes[cat] ?? "#C4BFB4";
}
