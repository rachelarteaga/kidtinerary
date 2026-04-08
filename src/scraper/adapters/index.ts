import { RaleighParksAdapter } from "@/scraper/adapters/raleigh-parks";
import { YMCATriangleAdapter } from "@/scraper/adapters/ymca-triangle";
import { createLLMAdapter } from "@/scraper/adapters/llm-extractor";
import type { Adapter } from "@/scraper/types";

// Registry: map adapter name → Adapter instance
export const ADAPTER_REGISTRY: Record<string, Adapter> = {
  "raleigh-parks": RaleighParksAdapter,
  "ymca-triangle": YMCATriangleAdapter,
};

/**
 * Returns all registered adapters.
 */
export function getAllAdapters(): Adapter[] {
  return Object.values(ADAPTER_REGISTRY);
}

/**
 * Returns adapter by name, or null if not found.
 */
export function getAdapter(name: string): Adapter | null {
  return ADAPTER_REGISTRY[name] ?? null;
}

/**
 * Resolves an adapter by adapter_type + URL (used by the pipeline).
 * - "dedicated": looks up by URL in ADAPTER_REGISTRY
 * - "generic_llm": creates an LLM adapter for the given URL
 * Returns null if no adapter can be resolved.
 */
export function resolveAdapter(adapterType: string, url: string): Adapter | null {
  if (adapterType === "dedicated") {
    // Find by sourceUrl
    const found = Object.values(ADAPTER_REGISTRY).find((a) => a.sourceUrl === url);
    return found ?? null;
  }
  if (adapterType === "generic_llm") {
    return createLLMAdapter(url);
  }
  return null;
}
