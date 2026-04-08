import type { Category } from "@/lib/constants";
import { CATEGORIES } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Slug
// ---------------------------------------------------------------------------

export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, "-")   // en dash, em dash → hyphen
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// Price
// ---------------------------------------------------------------------------

export function priceToCents(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return Math.round(num * 100);
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  sports:        ["sport", "soccer", "baseball", "basketball", "football", "lacrosse", "tennis", "volleyball", "athletic", "athletics"],
  arts:          ["art", "craft", "paint", "draw", "creative", "design", "sculpture", "ceramics", "pottery"],
  stem:          ["stem", "science", "coding", "code", "robot", "engineer", "math", "technology", "computer", "programming"],
  nature:        ["nature", "outdoor", "environment", "ecology", "hiking", "garden", "wildlife", "forest", "conservation"],
  music:         ["music", "band", "orchestra", "choir", "sing", "instrument", "guitar", "piano", "drum", "vocal"],
  theater:       ["theater", "theatre", "drama", "acting", "improv", "stage", "perform", "musical"],
  academic:      ["academic", "tutoring", "reading", "writing", "literacy", "math", "language arts", "homework"],
  special_needs: ["special needs", "adaptive", "inclusion", "disability", "sensory"],
  religious:     ["church", "faith", "bible", "vacation bible", "vbs", "jewish", "christian", "catholic", "religious"],
  swimming:      ["swim", "pool", "aquatic", "water polo", "diving"],
  cooking:       ["cook", "culinary", "baking", "kitchen", "chef", "food"],
  language:      ["spanish", "french", "mandarin", "chinese", "language", "bilingual", "immersion"],
};

export function assignCategories(name: string, description: string): Category[] {
  const text = `${name} ${description}`.toLowerCase();
  const found: Category[] = [];

  for (const category of CATEGORIES) {
    const keywords = CATEGORY_KEYWORDS[category];
    if (keywords.some((kw) => text.includes(kw))) {
      found.push(category);
    }
  }

  // Fallback: if nothing matched, label as "sports" (most common camp type)
  if (found.length === 0) {
    found.push("sports");
  }

  return found;
}

// ---------------------------------------------------------------------------
// Age range
// ---------------------------------------------------------------------------

// Kindergarten counts as age 5; grade N maps to roughly age N+5
const GRADE_TO_AGE: Record<string, number> = {
  k: 5, K: 5,
  "1": 6, "2": 7, "3": 8, "4": 9, "5": 10,
  "6": 11, "7": 12, "8": 13, "9": 14, "10": 15,
  "11": 16, "12": 17,
};

export function extractAgeRange(
  text: string
): { min: number; max: number } | null {
  // "ages 6-12" or "ages 6 to 12"
  const ageRange = text.match(/ages?\s+(\d+)\s*(?:-|to)\s*(\d+)/i);
  if (ageRange) {
    return { min: parseInt(ageRange[1], 10), max: parseInt(ageRange[2], 10) };
  }

  // "ages 8+" or "ages 8 and up"
  const ageUp = text.match(/ages?\s+(\d+)\s*(?:\+|and up)/i);
  if (ageUp) {
    return { min: parseInt(ageUp[1], 10), max: 12 };
  }

  // "grades K-5" or "grades 1-6"
  const gradeRange = text.match(/grades?\s+(K|\d+)\s*(?:-|to)\s*(K|\d+)/i);
  if (gradeRange) {
    const minGrade = gradeRange[1];
    const maxGrade = gradeRange[2];
    const minAge = GRADE_TO_AGE[minGrade] ?? 5;
    const maxAge = (GRADE_TO_AGE[maxGrade] ?? 12) + 1; // grade max → end-of-year age
    return { min: minAge, max: maxAge };
  }

  return null;
}
