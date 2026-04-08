import { describe, it, expect } from "vitest";
import {
  toSlug,
  priceToCents,
  assignCategories,
  extractAgeRange,
} from "@/scraper/normalize";

describe("toSlug", () => {
  it("lowercases and hyphenates", () => {
    expect(toSlug("Raleigh Summer Camp 2025")).toBe("raleigh-summer-camp-2025");
  });

  it("strips special characters", () => {
    expect(toSlug("Art & Drama: Ages 6–10!")).toBe("art-drama-ages-6-10");
  });

  it("collapses multiple hyphens", () => {
    expect(toSlug("swim  camp---raleigh")).toBe("swim-camp-raleigh");
  });

  it("trims leading/trailing hyphens", () => {
    expect(toSlug("  -Camp Fun- ")).toBe("camp-fun");
  });
});

describe("priceToCents", () => {
  it("parses dollar amounts", () => {
    expect(priceToCents("$250")).toBe(25000);
  });

  it("parses amounts with decimals", () => {
    expect(priceToCents("$49.99")).toBe(4999);
  });

  it("parses amounts without dollar sign", () => {
    expect(priceToCents("150")).toBe(15000);
  });

  it("strips commas from large amounts", () => {
    expect(priceToCents("$1,200.00")).toBe(120000);
  });

  it("returns null for non-numeric strings", () => {
    expect(priceToCents("Free")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(priceToCents("")).toBeNull();
  });
});

describe("assignCategories", () => {
  it("detects sports from name", () => {
    const cats = assignCategories("Soccer Skills Camp", "");
    expect(cats).toContain("sports");
  });

  it("detects stem from description", () => {
    const cats = assignCategories("Summer Fun", "Coding, robotics, and engineering challenges");
    expect(cats).toContain("stem");
  });

  it("detects swimming from name", () => {
    const cats = assignCategories("Swim & Splash Camp", "");
    expect(cats).toContain("swimming");
  });

  it("detects arts from name", () => {
    const cats = assignCategories("Creative Arts Studio", "Painting, drawing, crafts");
    expect(cats).toContain("arts");
  });

  it("detects music from name", () => {
    const cats = assignCategories("Rock Band Music Camp", "");
    expect(cats).toContain("music");
  });

  it("detects nature from description", () => {
    const cats = assignCategories("Outdoor Adventure", "Hiking, nature exploration, ecology");
    expect(cats).toContain("nature");
  });

  it("returns at least one category for unrecognized input", () => {
    const cats = assignCategories("General Fun Camp", "Various activities for kids");
    expect(cats.length).toBeGreaterThan(0);
  });

  it("does not return duplicates", () => {
    const cats = assignCategories("Swimming Sports Camp", "water sports swim");
    const unique = [...new Set(cats)];
    expect(cats).toEqual(unique);
  });
});

describe("extractAgeRange", () => {
  it("parses 'ages 6-12'", () => {
    expect(extractAgeRange("Fun camp for ages 6-12")).toEqual({ min: 6, max: 12 });
  });

  it("parses 'ages 6 to 12'", () => {
    expect(extractAgeRange("Kids ages 6 to 12 welcome")).toEqual({ min: 6, max: 12 });
  });

  it("parses 'grades K-5'", () => {
    const result = extractAgeRange("Open to grades K-5");
    expect(result?.min).toBe(5);
    expect(result?.max).toBe(11);
  });

  it("parses 'grades 1-6'", () => {
    const result = extractAgeRange("For grades 1-6");
    expect(result?.min).toBe(6);
    expect(result?.max).toBe(12);
  });

  it("parses 'ages 8+'", () => {
    expect(extractAgeRange("For ages 8 and up")).toEqual({ min: 8, max: 12 });
  });

  it("returns null for no age info", () => {
    expect(extractAgeRange("Summer camp, all welcome")).toBeNull();
  });
});
