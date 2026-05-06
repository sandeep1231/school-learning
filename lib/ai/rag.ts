import { embed } from "@/lib/ai/gemini";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppLanguage } from "@/lib/types";

export type RetrievedChunk = {
  id: string;
  content: string;
  page: number | null;
  topicId: string | null;
  chapterId: string | null;
  documentTitle: string;
  sourceUrl: string | null;
  language: AppLanguage;
  score: number;
};

const VECTOR_WEIGHT = 0.7;
const KEYWORD_WEIGHT = 0.3;

/**
 * Fuse ranked vector + FTS results via weighted reciprocal-rank.
 */
function fuse(
  vectorHits: any[] | null | undefined,
  ftsHits: any[] | null | undefined,
  k: number,
): RetrievedChunk[] {
  const scoreMap = new Map<string, number>();
  const rowMap = new Map<string, RetrievedChunk>();
  const normalize = (
    rows: any[] | null | undefined,
    weight: number,
    scoreKey: string,
  ) => {
    if (!rows) return;
    rows.forEach((r, idx) => {
      const rrf = 1 / (60 + idx);
      scoreMap.set(r.id, (scoreMap.get(r.id) ?? 0) + weight * rrf);
      if (!rowMap.has(r.id)) {
        rowMap.set(r.id, {
          id: r.id,
          content: r.content,
          page: r.page,
          topicId: r.topic_id,
          chapterId: r.chapter_id,
          documentTitle: r.document_title ?? "BSE Odisha source",
          sourceUrl: r.source_url ?? null,
          language: r.language,
          score: r[scoreKey] ?? 0,
        });
      }
    });
  };
  normalize(vectorHits ?? [], VECTOR_WEIGHT, "similarity");
  normalize(ftsHits ?? [], KEYWORD_WEIGHT, "rank");
  return Array.from(scoreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([id, score]) => ({ ...(rowMap.get(id) as RetrievedChunk), score }));
}

/**
 * Scope-based retrieval (Phase 5). Accepts the full Board → Class → Subject
 * → Chapter → Topic hierarchy as optional filters. Any level can be omitted.
 *
 * A `chapterHint` is prepended to the query before embedding + FTS so
 * chapter-specific terms weigh more. Keep it short (title-length).
 */
export async function retrieveForScope(opts: {
  query: string;
  board?: string;
  classLevel?: number;
  subjectCode?: string;
  chapterId?: string;
  topicId?: string;
  includeNeighbours?: boolean;
  k?: number;
  language?: AppLanguage;
  chapterHint?: string;
}): Promise<RetrievedChunk[]> {
  const {
    query,
    board,
    classLevel,
    subjectCode,
    chapterId,
    topicId,
    includeNeighbours = true,
    k = 6,
    language,
    chapterHint,
  } = opts;
  const supabase = createAdminClient();

  const boostedQuery = chapterHint ? `${chapterHint}\n\n${query}` : query;
  const embedding = await embed(boostedQuery);

  const args = {
    query_embedding: embedding as unknown as string,
    target_board: board ?? null,
    target_class_level: classLevel ?? null,
    target_subject_code: subjectCode ?? null,
    target_chapter_id: chapterId ?? null,
    target_topic_id: topicId ?? null,
    include_neighbours: includeNeighbours,
    match_count: k * 2,
    filter_language: language ?? null,
  };
  const ftsArgs = {
    query_text: boostedQuery,
    target_board: board ?? null,
    target_class_level: classLevel ?? null,
    target_subject_code: subjectCode ?? null,
    target_chapter_id: chapterId ?? null,
    target_topic_id: topicId ?? null,
    include_neighbours: includeNeighbours,
    match_count: k * 2,
    filter_language: language ?? null,
  };

  const [{ data: vectorHits, error: vErr }, { data: ftsHits, error: fErr }] =
    await Promise.all([
      supabase.rpc("match_chunks_by_scope", args),
      supabase.rpc("match_chunks_fts_by_scope", ftsArgs),
    ]);
  if (vErr) throw vErr;
  if (fErr) throw fErr;

  return fuse(vectorHits as any[], ftsHits as any[], k);
}
