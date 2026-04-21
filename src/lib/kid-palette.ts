/** First letter of the name, uppercased. Falls back to "?". */
export function initialFor(name: string | null | undefined): string {
  if (!name) return "?";
  const trimmed = name.trim();
  return trimmed.length === 0 ? "?" : trimmed[0].toUpperCase();
}
