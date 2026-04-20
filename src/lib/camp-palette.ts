export const CAMP_PALETTE = [
  "#f4b76f", // orange
  "#7fa06a", // green
  "#8fa4c8", // blue
  "#d4a1c8", // rose
  "#c8a76a", // sand
  "#9fc8b8", // teal
  "#e89b7a", // terracotta
  "#b5a8d4", // lavender
] as const;

export function paletteColorForCampIndex(index: number): string {
  return CAMP_PALETTE[index % CAMP_PALETTE.length];
}
