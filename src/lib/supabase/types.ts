// Generated types will replace this file when Supabase is running locally.
// Run: npx supabase gen types typescript --local > src/lib/supabase/types.ts
export type Database = {
  public: {
    Tables: Record<string, unknown>;
    Views: Record<string, unknown>;
    Functions: Record<string, unknown>;
    Enums: Record<string, unknown>;
  };
};

// Planner Hero Redesign additions
export type PlannerEntryStatus = "considering" | "waitlisted" | "registered";
export type PlannerBlockType = "school" | "travel" | "at_home" | "other";
export type ScrapeJobStatus = "queued" | "running" | "resolved" | "failed";
export type ScrapeConfidence = "high" | "partial" | "ambiguous" | "none";

export interface UserCampRow {
  id: string;
  user_id: string;
  activity_id: string;
  created_at: string;
}

export interface PlannerBlockRow {
  id: string;
  user_id: string;
  type: PlannerBlockType;
  title: string;
  emoji: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
  planner_id: string;
}

export interface PlannerBlockKidRow {
  block_id: string;
  child_id: string;
}

export interface ScrapeJobRow {
  id: string;
  user_id: string;
  input: string;
  context: Record<string, unknown>;
  status: ScrapeJobStatus;
  activity_id: string | null;
  confidence: ScrapeConfidence | null;
  candidates: Array<{ activity_id: string; name: string; score: number }> | null;
  consent_share: boolean;
  created_at: string;
  resolved_at: string | null;
}

// Planner v2 additions
export type SessionPart = "full" | "am" | "pm" | "overnight";
export type PriceUnit = "per_week" | "per_day";
export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface PlannerRow {
  id: string;
  user_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_default: boolean;
  created_at: string;
}

export interface ExtraItem {
  label: string;
  cost_cents: number;
  unit: PriceUnit;
}
