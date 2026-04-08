import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractWithLLM, buildExtractionPrompt } from "@/scraper/adapters/llm-extractor";

// Mock the Anthropic SDK so tests don't make real API calls
vi.mock("@anthropic-ai/sdk", () => {
  const MockAnthropic = vi.fn().mockImplementation(function () {
    this.messages = { create: vi.fn() };
  });
  return { default: MockAnthropic };
});

const MOCK_VALID_RESPONSE = JSON.stringify({
  activities: [
    {
      name: "Summer Splash Camp",
      description: "A week of swimming and water games",
      organizationName: "Happy Swimmers LLC",
      organizationWebsite: "https://happyswimmers.com",
      registrationUrl: "https://happyswimmers.com/register",
      sourceUrl: "https://happyswimmers.com/camps",
      address: "123 Pool Ln, Raleigh, NC 27601",
      indoorOutdoor: "outdoor",
      ageText: "Ages 6-12",
      sessions: [
        {
          startsAt: "2025-06-16",
          endsAt: "2025-06-20",
          timeSlot: "full_day",
          hoursStart: "09:00",
          hoursEnd: "15:00",
          isSoldOut: false,
        },
      ],
      prices: [
        {
          label: "Standard",
          priceString: "$250",
          priceUnit: "per_week",
        },
      ],
    },
  ],
});

describe("buildExtractionPrompt", () => {
  it("includes the source URL in the prompt", () => {
    const prompt = buildExtractionPrompt("https://example.com/camps", "<html>content</html>");
    expect(prompt).toContain("https://example.com/camps");
  });

  it("includes the HTML content in the prompt", () => {
    const prompt = buildExtractionPrompt("https://example.com/camps", "Summer Camp 2025");
    expect(prompt).toContain("Summer Camp 2025");
  });

  it("asks for JSON output", () => {
    const prompt = buildExtractionPrompt("https://example.com", "content");
    expect(prompt.toLowerCase()).toContain("json");
  });
});

describe("extractWithLLM", () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default as any;
    mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: MOCK_VALID_RESPONSE }],
    });
    Anthropic.mockImplementation(function (this: any) {
      this.messages = { create: mockCreate };
    });
  });

  it("returns parsed activities from valid LLM response", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const result = await extractWithLLM(
      "https://happyswimmers.com/camps",
      "<html><body>Summer Splash Camp, $250/week, June 16-20</body></html>"
    );
    expect(result.activities).toHaveLength(1);
    expect(result.activities[0].name).toBe("Summer Splash Camp");
    expect(result.activities[0].prices[0].priceString).toBe("$250");
  });

  it("tags all activities with confidence source", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const result = await extractWithLLM(
      "https://happyswimmers.com/camps",
      "<html>Some camp content</html>"
    );
    expect(result.activities.every((a) => a._confidence === "llm_extracted")).toBe(true);
  });

  it("returns error when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const result = await extractWithLLM("https://example.com", "<html></html>");
    expect(result.errors).toContain("ANTHROPIC_API_KEY not set");
    expect(result.activities).toHaveLength(0);
  });

  it("returns error on malformed JSON response", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const Anthropic = (await import("@anthropic-ai/sdk")).default as any;
    Anthropic.mockImplementation(function (this: any) {
      this.messages = {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "not valid json {{{" }],
        }),
      };
    });
    const result = await extractWithLLM("https://example.com", "<html>content</html>");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/parse/i);
  });
});
