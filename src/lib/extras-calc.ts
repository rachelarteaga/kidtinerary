import type { ExtraItem } from "@/lib/supabase/types";

export function extrasTotalCents(extras: ExtraItem[], daysPerWeek: number): number {
  return extras.reduce((sum, e) => {
    if (e.unit === "per_week") return sum + e.cost_cents;
    return sum + e.cost_cents * daysPerWeek;
  }, 0);
}
