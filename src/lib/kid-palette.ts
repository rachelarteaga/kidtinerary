export const KID_PALETTE = [
  "#f4b76f", // orange
  "#7fa06a", // green
  "#8fa4c8", // blue
  "#d4a1c8", // rose
  "#c8a76a", // sand
  "#9fc8b8", // teal
] as const;

/** Pick a palette color based on index; wraps. */
export function paletteColorForIndex(index: number): string {
  return KID_PALETTE[index % KID_PALETTE.length];
}

/** First letter of the name, uppercased. Falls back to "?". */
export function initialFor(name: string | null | undefined): string {
  if (!name) return "?";
  const trimmed = name.trim();
  return trimmed.length === 0 ? "?" : trimmed[0].toUpperCase();
}
