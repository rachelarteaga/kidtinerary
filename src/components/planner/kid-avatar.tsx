import { initialFor } from "@/lib/kid-palette";
import { KidShape } from "@/components/ui/kid-shape";

interface KidAvatarProps {
  name: string;
  /** Sort-order index within the planner (0-based). Drives shape assignment. */
  index: number;
  /** @deprecated Kept for backwards compat; ignored under the new shape-based identity. */
  color?: string;
  avatarUrl?: string | null;
  size?: number;
}

export function KidAvatar({ name, index, avatarUrl, size = 48 }: KidAvatarProps) {
  if (avatarUrl) {
    // Photo avatars render as circle for now; a future pass can crop to assigned shape.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover border border-ink"
      />
    );
  }
  return <KidShape index={index} size={size} initial={initialFor(name)} />;
}
