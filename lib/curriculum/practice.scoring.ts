/**
 * Scoring helpers for DB-backed practice items. Mirrors the legacy
 * `lib/ai/quizzes.scoreAttempt` shape so the UI can share rendering, but
 * operates on per-item records (not a fixed Quiz object) so generated item
 * banks of any size work.
 */
import type {
  PracticeItem,
  McqPayload,
  FreeTextPayload,
  RubricCriterion,
} from "@/lib/curriculum/practice";

export type ClientAnswer =
  | { itemId: string; kind: "mcq"; choiceIndex: number }
  | { itemId: string; kind: "short" | "long"; text: string };

export type RubricResult = {
  criterion: string;
  weight: number;
  matched: string[];
  score: number; // 0..1 for this criterion
};

export type ItemResult = {
  itemId: string;
  kind: PracticeItem["kind"];
  /** 0..1 fractional score used to compute overall percent. */
  fraction: number;
  /** True iff the student got full credit. */
  correct: boolean;
  /** For MCQ: the correct option index. */
  correctIndex?: number;
  /** For free text: matched keywords. */
  matchedKeywords?: string[];
  modelAnswer?: string;
  explanationMd?: string | null;
  /** Phase 9.7 — misconception slug if the wrong MCQ option had one. */
  misconceptionTag?: string | null;
  /** Phase 9.11 — per-criterion breakdown when a rubric was used. */
  rubricBreakdown?: RubricResult[];
};

const FREE_TEXT_MAX_KEYWORDS = 8;
const RUBRIC_MAX_KEYWORDS_PER_CRITERION = 6;

function scoreRubric(
  rubric: RubricCriterion[],
  given: string,
): { fraction: number; breakdown: RubricResult[] } {
  const lower = given.toLowerCase();
  const breakdown: RubricResult[] = [];
  let totalWeight = 0;
  let weightedScore = 0;
  for (const c of rubric) {
    const weight = Number.isFinite(c.weight) && c.weight > 0 ? c.weight : 0;
    if (weight === 0) continue;
    const kws = (c.keywords ?? []).slice(0, RUBRIC_MAX_KEYWORDS_PER_CRITERION);
    const matched = kws.filter((k) => k && lower.includes(k.toLowerCase()));
    const score = kws.length === 0 ? 0 : matched.length / kws.length;
    totalWeight += weight;
    weightedScore += weight * score;
    breakdown.push({ criterion: c.criterion, weight, matched, score });
  }
  const fraction = totalWeight === 0 ? 0 : weightedScore / totalWeight;
  return { fraction, breakdown };
}

export function scoreItem(item: PracticeItem, answer: ClientAnswer): ItemResult {
  if (item.kind === "mcq" && answer.kind === "mcq") {
    const p = item.payload as McqPayload;
    const correctIndex = p.correct_index;
    const correct = answer.choiceIndex === correctIndex;
    const misconceptionTag =
      !correct && Array.isArray(p.misconceptions)
        ? (p.misconceptions[answer.choiceIndex] ?? null)
        : null;
    return {
      itemId: item.id,
      kind: "mcq",
      fraction: correct ? 1 : 0,
      correct,
      correctIndex,
      explanationMd: item.explanationMd,
      misconceptionTag,
    };
  }
  if ((item.kind === "short" || item.kind === "long") && answer.kind !== "mcq") {
    const p = item.payload as FreeTextPayload;
    const given = (answer.text ?? "").toLowerCase();
    // Phase 9.11 — prefer rubric when present (long-answer grading).
    if (Array.isArray(p.rubric) && p.rubric.length > 0) {
      const { fraction, breakdown } = scoreRubric(p.rubric, given);
      const matched = breakdown.flatMap((b) => b.matched);
      return {
        itemId: item.id,
        kind: item.kind,
        fraction,
        correct: fraction >= 0.7,
        matchedKeywords: matched,
        modelAnswer: p.model_answer,
        explanationMd: item.explanationMd,
        rubricBreakdown: breakdown,
      };
    }
    const kws = (p.keywords ?? []).slice(0, FREE_TEXT_MAX_KEYWORDS);
    const matched = kws.filter((k) => given.includes(k.toLowerCase()));
    const fraction = kws.length === 0 ? 0 : matched.length / kws.length;
    return {
      itemId: item.id,
      kind: item.kind,
      fraction,
      correct: fraction >= 0.7,
      matchedKeywords: matched,
      modelAnswer: p.model_answer,
      explanationMd: item.explanationMd,
    };
  }
  // Kind/answer mismatch — treat as wrong.
  return {
    itemId: item.id,
    kind: item.kind,
    fraction: 0,
    correct: false,
    explanationMd: item.explanationMd,
  };
}

export function scoreAttempt(
  items: PracticeItem[],
  answers: ClientAnswer[],
): { percent: number; results: ItemResult[] } {
  const byId = new Map(items.map((i) => [i.id, i]));
  const results: ItemResult[] = [];
  for (const ans of answers) {
    const item = byId.get(ans.itemId);
    if (!item) continue;
    results.push(scoreItem(item, ans));
  }
  if (results.length === 0) return { percent: 0, results: [] };
  const avg =
    results.reduce((s, r) => s + r.fraction, 0) / results.length;
  return { percent: Math.round(avg * 100), results };
}
