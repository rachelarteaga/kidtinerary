import { Tag } from "@/components/ui/tag";
import { formatAgeRange, categoryLabel } from "@/lib/format";
import { CATEGORY_COLORS, type Category } from "@/lib/constants";
import type { ActivityRow } from "@/lib/queries";

interface DetailHeroProps {
  activity: ActivityRow;
}

export function DetailHero({ activity }: DetailHeroProps) {
  const primaryCategory = activity.categories?.[0] as Category | undefined;
  const categoryColor = primaryCategory ? CATEGORY_COLORS[primaryCategory] : null;

  const gradients: Record<string, string> = {
    sports: "from-[#D4A574]/20 to-[#D4A574]/5",
    arts: "from-[#E07845]/20 to-[#E07845]/5",
    stem: "from-[#6B8CBB]/20 to-[#6B8CBB]/5",
    nature: "from-[#5A8F6E]/20 to-[#5A8F6E]/5",
    music: "from-[#D4A574]/20 to-[#D4A574]/5",
    theater: "from-[#E07845]/20 to-[#E07845]/5",
    academic: "from-[#6B8CBB]/20 to-[#6B8CBB]/5",
    special_needs: "from-[#5A8F6E]/20 to-[#5A8F6E]/5",
    religious: "from-[#D4A574]/20 to-[#D4A574]/5",
    swimming: "from-[#6B8CBB]/20 to-[#6B8CBB]/5",
    cooking: "from-[#E07845]/20 to-[#E07845]/5",
    language: "from-[#6B8CBB]/20 to-[#6B8CBB]/5",
  };

  const gradient = primaryCategory
    ? gradients[primaryCategory] ?? "from-driftwood/20 to-driftwood/5"
    : "from-driftwood/20 to-driftwood/5";

  return (
    <div className={`bg-gradient-to-b ${gradient} rounded-2xl p-6 sm:p-10 mb-8`}>
      {/* Breadcrumb */}
      <p className="font-mono text-[10px] uppercase tracking-wide text-stone mb-4">
        <a href="/explore" className="hover:text-bark">Explore</a>
        <span className="mx-2">/</span>
        <span className="text-bark">{activity.name}</span>
      </p>

      {/* Category icon */}
      {primaryCategory && (
        <div
          className={`inline-flex w-12 h-12 rounded-xl items-center justify-center text-xl mb-4 ${categoryColor?.bg ?? ""} ${categoryColor?.text ?? ""}`}
          style={{ transform: "rotate(-3deg)" }}
        >
          {getCategoryEmoji(primaryCategory)}
        </div>
      )}

      <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl mb-2">
        {activity.name}
      </h1>

      {activity.organization && (
        <p className="text-stone text-lg mb-4">
          by{" "}
          {(activity.organization as any).website ? (
            <a
              href={(activity.organization as any).website}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-bark"
            >
              {(activity.organization as any).name}
            </a>
          ) : (
            <span>{(activity.organization as any).name}</span>
          )}
        </p>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        <Tag type="age" label={formatAgeRange(activity.age_min, activity.age_max)} />
        {activity.categories?.map((cat) => (
          <Tag key={cat} type="category" label={categoryLabel(cat)} />
        ))}
        <Tag
          type="schedule"
          label={activity.indoor_outdoor === "both" ? "Indoor/Outdoor" : activity.indoor_outdoor}
        />
      </div>
    </div>
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
