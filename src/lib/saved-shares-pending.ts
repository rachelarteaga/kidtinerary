const KEY = "kt:pendingSaveTokens";

/** Read pending tokens stashed for post-signup auto-save. Tolerant of malformed storage. */
export function readPendingSaveTokens(storage: Storage): string[] {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string" && v.length > 0);
  } catch {
    return [];
  }
}

/** Push a token onto the pending list; deduplicates. */
export function addPendingSaveToken(storage: Storage, token: string): void {
  const current = readPendingSaveTokens(storage);
  if (current.includes(token)) return;
  current.push(token);
  storage.setItem(KEY, JSON.stringify(current));
}

/** Atomically read + clear the pending list (used during drain). */
export function takePendingSaveTokens(storage: Storage): string[] {
  const tokens = readPendingSaveTokens(storage);
  storage.removeItem(KEY);
  return tokens;
}
