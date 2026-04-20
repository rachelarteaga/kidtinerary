import { initialFor } from "@/lib/kid-palette";

interface KidAvatarProps {
  name: string;
  color: string;
  avatarUrl?: string | null;
  size?: number;
}

export function KidAvatar({ name, color, avatarUrl, size = 48 }: KidAvatarProps) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        style={style}
        className="rounded-full object-cover"
      />
    );
  }
  return (
    <div
      style={{ ...style, background: color }}
      className="rounded-full flex items-center justify-center text-white font-bold select-none"
    >
      {initialFor(name)}
    </div>
  );
}
