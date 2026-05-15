import { describe, it, expect, beforeEach } from "vitest";
import {
  readPendingSaveTokens,
  addPendingSaveToken,
  takePendingSaveTokens,
} from "@/lib/saved-shares-pending";

function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, v); },
  };
}

describe("saved-shares-pending", () => {
  let storage: Storage;
  beforeEach(() => { storage = makeStorage(); });

  it("reads empty when nothing stored", () => {
    expect(readPendingSaveTokens(storage)).toEqual([]);
  });

  it("addPendingSaveToken stores a token", () => {
    addPendingSaveToken(storage, "abc");
    expect(readPendingSaveTokens(storage)).toEqual(["abc"]);
  });

  it("dedupes tokens", () => {
    addPendingSaveToken(storage, "abc");
    addPendingSaveToken(storage, "abc");
    expect(readPendingSaveTokens(storage)).toEqual(["abc"]);
  });

  it("preserves order across multiple adds", () => {
    addPendingSaveToken(storage, "a");
    addPendingSaveToken(storage, "b");
    addPendingSaveToken(storage, "c");
    expect(readPendingSaveTokens(storage)).toEqual(["a", "b", "c"]);
  });

  it("takePendingSaveTokens drains the list", () => {
    addPendingSaveToken(storage, "a");
    addPendingSaveToken(storage, "b");
    expect(takePendingSaveTokens(storage)).toEqual(["a", "b"]);
    expect(readPendingSaveTokens(storage)).toEqual([]);
  });

  it("tolerates corrupted JSON", () => {
    storage.setItem("kt:pendingSaveTokens", "{not json");
    expect(readPendingSaveTokens(storage)).toEqual([]);
  });

  it("tolerates a non-array stored value", () => {
    storage.setItem("kt:pendingSaveTokens", JSON.stringify({ a: 1 }));
    expect(readPendingSaveTokens(storage)).toEqual([]);
  });
});
