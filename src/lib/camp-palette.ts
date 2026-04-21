export const CAMP_PALETTE = [
  "#8fa8d4", // periwinkle
  "#8ec4ad", // mint
  "#b095d4", // lilac
  "#d49bbe", // rose
] as const;

export function paletteColorForCampIndex(index: number): string {
  return CAMP_PALETTE[index % CAMP_PALETTE.length];
}
