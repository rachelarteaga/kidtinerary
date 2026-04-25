import type { UserActivityWithDetails } from "@/lib/queries";

interface Props {
  activity: UserActivityWithDetails;
}

export function CatalogRow({ activity }: Props) {
  const showOrg =
    activity.activity.organization &&
    activity.activity.organization.name &&
    activity.activity.organization.name !== activity.activity.name &&
    activity.activity.organization.name !== "User-submitted";

  return (
    <div className="rounded-lg border border-ink-3 bg-surface p-4 hover:border-ink transition-colors cursor-pointer">
      <div className="flex items-start gap-3">
        <span
          className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
          style={{ background: activity.color }}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-extrabold text-base text-ink leading-tight break-words">
            {activity.activity.name}
          </h2>
          {showOrg && activity.activity.organization && (
            <p className="font-sans text-xs text-ink-2 mt-1">
              {activity.activity.organization.name}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
