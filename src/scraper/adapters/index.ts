import { RaleighParksAdapter } from "@/scraper/adapters/raleigh-parks";
import { YMCATriangleAdapter } from "@/scraper/adapters/ymca-triangle";
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
