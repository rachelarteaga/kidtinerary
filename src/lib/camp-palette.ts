export const CAMP_PALETTE = [
  "#8fa8d4", // 0  periwinkle
  "#8ec4ad", // 1  mint
  "#b095d4", // 2  lilac
  "#d49bbe", // 3  rose
  "#d4a898", // 4  peach
  "#d4c39b", // 5  sand
  "#c4d49b", // 6  celery
  "#9ed49b", // 7  spring green
  "#9bd4c3", // 8  seafoam
  "#9bc1d4", // 9  sky
  "#9b9ed4", // 10 iris
  "#c39bd4", // 11 amethyst
  "#d49ba8", // 12 coral pink
  "#d4b79b", // 13 apricot
  "#bcd49b", // 14 chartreuse
  "#9bd4ad", // 15 jade
  "#9bcfd4", // 16 teal
  "#a69bd4", // 17 violet
  "#cd9bd4", // 18 magenta
  "#d49b9b", // 19 salmon
] as const;

export function paletteColorForCampIndex(index: number): string {
  return CAMP_PALETTE[index % CAMP_PALETTE.length];
}
