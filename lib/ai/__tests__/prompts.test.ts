import { describe, it, expect } from "vitest";
import { buildTutorSystemPrompt, buildParentSummaryPrompt } from "@/lib/ai/prompts";

describe("buildTutorSystemPrompt", () => {
  const base = {
    classLevel: 9,
    subjectName: "Mathematics",
    chapterTitle: "Polynomials",
    topicTitle: "Zeroes of a Polynomial",
    learningObjectives: ["Find zeroes of linear polynomials"],
    context: [
      { id: "c1", text: "A zero of a polynomial p(x) is a value where p(x) = 0.", source: "NCERT Class 9 Ch.2", page: 32 },
    ],
  };

  it("routes to English by default", () => {
    const p = buildTutorSystemPrompt({ ...base, language: "en" });
    expect(p).toContain("Always reply in English");
    expect(p).toContain("[[1]]");
    expect(p).toContain("NCERT Class 9 Ch.2");
  });

  it("routes to Odia when requested", () => {
    const p = buildTutorSystemPrompt({ ...base, language: "or" });
    expect(p).toContain("Odia");
  });

  it("mentions prompt-injection defence", () => {
    const p = buildTutorSystemPrompt({ ...base, language: "en" });
    expect(p.toLowerCase()).toContain("ignore any instructions");
  });

  it("handles empty context gracefully", () => {
    const p = buildTutorSystemPrompt({ ...base, language: "en", context: [] });
    expect(p).toContain("no context retrieved");
  });
});

describe("buildParentSummaryPrompt", () => {
  it("includes quiz avg when present", () => {
    const p = buildParentSummaryPrompt({
      language: "en",
      studentName: "Riya",
      date: "2026-04-21",
      topics: ["Polynomials"],
      chatCount: 3,
      quizAvg: 80,
      weakAreas: [],
    });
    expect(p).toContain("80%");
    expect(p).toContain("Riya");
  });

  it("says no quiz taken when null", () => {
    const p = buildParentSummaryPrompt({
      language: "hi",
      studentName: "Aman",
      date: "2026-04-21",
      topics: [],
      chatCount: 0,
      quizAvg: null,
      weakAreas: [],
    });
    expect(p).toContain("no quiz taken");
    expect(p).toContain("Hindi");
  });
});
