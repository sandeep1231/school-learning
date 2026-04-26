/**
 * Practice-items data access.
 *
 * Reader uses the service role (admin client) so it respects application-level
 * visibility rules (published + flag_count < FLAG_HIDE_THRESHOLD) rather than
 * DB RLS. Callers that mutate attempts/flags must use the auth'd server client
 * in the route handler — that path is in lib/practice/attempts.ts.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppLanguage } from "@/lib/types";

export const FLAG_HIDE_THRESHOLD = 3;

export type PracticeKind = "mcq" | "short" | "long";
export type PracticeDifficulty = "easy" | "medium" | "hard";

export type McqPayload = {
  options: string[];
  correct_index: number;
  /**
   * Phase 9.7 — optional per-option misconception tags aligned with options[].
   * Correct option should be null. Example: ["off_by_one", null, "sign_error", "order_of_ops"].
   */
  misconceptions?: (string | null)[];
};
export type FreeTextPayload = {
  model_answer: string;
  keywords: string[];
  /**
   * Phase 9.11 — optional weighted rubric for long-answer grading.
   * When present, scoreItem will compute a weighted fraction by matching
   * per-criterion keywords rather than a single flat keyword list.
   * `weight` values are summed; any non-negative number is OK.
   */
  rubric?: RubricCriterion[];
};

export type RubricCriterion = {
  criterion: string;
  weight: number;
  keywords: string[];
};

export type PracticeItem = {
  id: string;
  scopeType: "topic" | "chapter" | "subject";
  scopeId: string;
  kind: PracticeKind;
  difficulty: PracticeDifficulty;
  language: AppLanguage;
  questionMd: string;
  payload: McqPayload | FreeTextPayload | Record<string, unknown>;
  explanationMd: string | null;
  sourceChunkIds: string[];
  citationPage: number | null;
  citationTitle: string | null;
};

type Row = {
  id: string;
  scope_type: "topic" | "chapter" | "subject";
  scope_id: string;
  kind: PracticeKind;
  difficulty: PracticeDifficulty;
  language: AppLanguage;
  question_md: string;
  payload: Record<string, unknown>;
  explanation_md: string | null;
  source_chunk_ids: string[] | null;
  citation_page: number | null;
  citation_title: string | null;
};

function rowToItem(r: Row): PracticeItem {
  return {
    id: r.id,
    scopeType: r.scope_type,
    scopeId: r.scope_id,
    kind: r.kind,
    difficulty: r.difficulty,
    language: r.language,
    questionMd: r.question_md,
    payload: r.payload as PracticeItem["payload"],
    explanationMd: r.explanation_md,
    sourceChunkIds: r.source_chunk_ids ?? [],
    citationPage: r.citation_page,
    citationTitle: r.citation_title,
  };
}

/**
 * Load published practice items for a topic, excluding items that the
 * community has flagged past the auto-hide threshold.
 */
export async function listTopicPracticeItems(
  topicId: string,
  opts: { kinds?: PracticeKind[]; difficulty?: PracticeDifficulty } = {},
): Promise<PracticeItem[]> {
  const supabase = createAdminClient();

  let q = supabase
    .from("practice_items")
    .select(
      "id, scope_type, scope_id, kind, difficulty, language, question_md, payload, explanation_md, source_chunk_ids, citation_page, citation_title",
    )
    .eq("scope_type", "topic")
    .eq("scope_id", topicId)
    .eq("status", "published");
  if (opts.kinds && opts.kinds.length > 0) q = q.in("kind", opts.kinds);
  if (opts.difficulty) q = q.eq("difficulty", opts.difficulty);

  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return [];

  // Filter out auto-hidden items. Single follow-up query for flag counts.
  const { data: flagRows } = await supabase
    .from("v_item_flag_counts")
    .select("item_id, flag_count")
    .in("item_id", rows.map((r) => r.id));
  const hidden = new Set(
    (flagRows ?? [])
      .filter((f: { flag_count: number }) => f.flag_count >= FLAG_HIDE_THRESHOLD)
      .map((f: { item_id: string }) => f.item_id),
  );
  return rows.filter((r) => !hidden.has(r.id)).map(rowToItem);
}

export function isMcq(item: PracticeItem): item is PracticeItem & {
  kind: "mcq";
  payload: McqPayload;
} {
  return item.kind === "mcq";
}
