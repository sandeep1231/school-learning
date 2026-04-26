import { describe, expect, it } from "vitest";
import { scoreAttempt, scoreItem } from "@/lib/curriculum/practice.scoring";
import type { PracticeItem } from "@/lib/curriculum/practice";

const mcq: PracticeItem = {
  id: "00000000-0000-0000-0000-00000000aaaa",
  scopeType: "topic",
  scopeId: "t1",
  kind: "mcq",
  difficulty: "medium",
  language: "or",
  questionMd: "What is 2+2?",
  payload: { options: ["3", "4", "5", "6"], correct_index: 1 },
  explanationMd: "Basic arithmetic.",
  sourceChunkIds: [],
  citationPage: null,
  citationTitle: null,
};

const short: PracticeItem = {
  id: "00000000-0000-0000-0000-00000000bbbb",
  scopeType: "topic",
  scopeId: "t1",
  kind: "short",
  difficulty: "medium",
  language: "or",
  questionMd: "Define a set.",
  payload: {
    model_answer: "A collection of well-defined distinct objects.",
    keywords: ["collection", "well-defined", "distinct"],
  },
  explanationMd: null,
  sourceChunkIds: [],
  citationPage: null,
  citationTitle: null,
};

describe("practice scoring", () => {
  it("marks correct MCQ as full credit", () => {
    const r = scoreItem(mcq, {
      itemId: mcq.id,
      kind: "mcq",
      choiceIndex: 1,
    });
    expect(r.correct).toBe(true);
    expect(r.fraction).toBe(1);
    expect(r.correctIndex).toBe(1);
  });

  it("marks wrong MCQ as zero credit but returns the correct index", () => {
    const r = scoreItem(mcq, {
      itemId: mcq.id,
      kind: "mcq",
      choiceIndex: 2,
    });
    expect(r.correct).toBe(false);
    expect(r.fraction).toBe(0);
    expect(r.correctIndex).toBe(1);
  });

  it("keyword-matches short answers", () => {
    const r = scoreItem(short, {
      itemId: short.id,
      kind: "short",
      text: "A set is a collection of distinct things.",
    });
    // matched: collection, distinct (2/3)
    expect(r.fraction).toBeCloseTo(2 / 3, 5);
    expect(r.matchedKeywords).toEqual(["collection", "distinct"]);
  });

  it("averages percent across items", () => {
    const { percent } = scoreAttempt(
      [mcq, short],
      [
        { itemId: mcq.id, kind: "mcq", choiceIndex: 1 },
        { itemId: short.id, kind: "short", text: "no relevant words here" },
      ],
    );
    // MCQ 1.0 + short 0.0 → 50%
    expect(percent).toBe(50);
  });

  it("rejects kind/answer mismatch as zero", () => {
    const r = scoreItem(mcq, {
      itemId: mcq.id,
      kind: "short",
      text: "hello",
    });
    expect(r.correct).toBe(false);
    expect(r.fraction).toBe(0);
  });

  it("returns the misconception tag when a tagged distractor is picked", () => {
    const mcqWithTags: PracticeItem = {
      ...mcq,
      payload: {
        options: ["3", "4", "5", "6"],
        correct_index: 1,
        misconceptions: ["off_by_one", null, "off_by_one", "sign_error"],
      },
    };
    const wrong = scoreItem(mcqWithTags, {
      itemId: mcq.id,
      kind: "mcq",
      choiceIndex: 3,
    });
    expect(wrong.correct).toBe(false);
    expect(wrong.misconceptionTag).toBe("sign_error");

    const correct = scoreItem(mcqWithTags, {
      itemId: mcq.id,
      kind: "mcq",
      choiceIndex: 1,
    });
    expect(correct.correct).toBe(true);
    expect(correct.misconceptionTag).toBeNull();
  });

  it("returns null misconception tag when payload has no tags", () => {
    const r = scoreItem(mcq, {
      itemId: mcq.id,
      kind: "mcq",
      choiceIndex: 0,
    });
    expect(r.misconceptionTag ?? null).toBeNull();
  });

  it("uses weighted rubric when present on long-answer payload", () => {
    const longItem: PracticeItem = {
      id: "00000000-0000-0000-0000-00000000cccc",
      scopeType: "topic",
      scopeId: "t1",
      kind: "long",
      difficulty: "hard",
      language: "or",
      questionMd: "Explain sets with an example.",
      payload: {
        model_answer: "A set is a well-defined collection...",
        keywords: ["collection", "well-defined"],
        rubric: [
          {
            criterion: "Definition",
            weight: 2,
            keywords: ["collection", "well-defined", "distinct"],
          },
          {
            criterion: "Example",
            weight: 1,
            keywords: ["vowels", "natural numbers"],
          },
          {
            criterion: "Notation",
            weight: 1,
            keywords: ["braces", "comma"],
          },
        ],
      },
      explanationMd: null,
      sourceChunkIds: [],
      citationPage: null,
      citationTitle: null,
    };
    const r = scoreItem(longItem, {
      itemId: longItem.id,
      kind: "long",
      // Hits 2/3 Definition keywords + 1/2 Example + 0/2 Notation.
      text: "A set is a well-defined collection like the set of vowels.",
    });
    // Definition score = 2/3, Example = 1/2, Notation = 0.
    // Weighted = (2/3 * 2 + 1/2 * 1 + 0 * 1) / (2+1+1) = (4/3 + 1/2) / 4
    //         = (8/6 + 3/6) / 4 = 11/24 ≈ 0.4583
    expect(r.fraction).toBeCloseTo(11 / 24, 5);
    expect(r.rubricBreakdown).toBeDefined();
    expect(r.rubricBreakdown).toHaveLength(3);
    expect(r.rubricBreakdown?.[0]?.score).toBeCloseTo(2 / 3, 5);
    expect(r.rubricBreakdown?.[1]?.score).toBeCloseTo(1 / 2, 5);
    expect(r.rubricBreakdown?.[2]?.score).toBe(0);
  });

  it("falls back to flat keywords when rubric array is empty", () => {
    const longItem: PracticeItem = {
      id: "00000000-0000-0000-0000-00000000dddd",
      scopeType: "topic",
      scopeId: "t1",
      kind: "long",
      difficulty: "hard",
      language: "or",
      questionMd: "Q",
      payload: {
        model_answer: "x",
        keywords: ["alpha", "beta"],
        rubric: [],
      },
      explanationMd: null,
      sourceChunkIds: [],
      citationPage: null,
      citationTitle: null,
    };
    const r = scoreItem(longItem, {
      itemId: longItem.id,
      kind: "long",
      text: "alpha only",
    });
    expect(r.fraction).toBeCloseTo(1 / 2, 5);
    expect(r.rubricBreakdown).toBeUndefined();
  });
});
