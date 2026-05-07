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

export type FallbackScope = "topic" | "chapter" | "subject" | "class" | "none";

/**
 * Progressive-fallback retrieval. Tries the most-specific scope first,
 * widening one level at a time until at least `minChunks` chunks come back
 * (or the broadest scope is exhausted).
 *
 * Why: topic-scoped chunks can be sparse (a topic may have 0–4 chunks if
 * the ingestion didn't tag everything to it perfectly). Without a fallback
 * the tutor refuses with "I don't have material on that yet" even when the
 * student is asking something the chapter or subject definitely covers.
 *
 * The widest scope used is returned alongside the chunks so callers can
 * tell the model "this is from a wider scope" if they want to adjust tone.
 */
export async function retrieveWithFallback(opts: {
  query: string;
  board?: string;
  classLevel?: number;
  subjectCode?: string;
  chapterId?: string;
  topicId?: string;
  k?: number;
  language?: AppLanguage;
  chapterHint?: string;
  /** Below this many chunks, widen the scope and try again. Default 3. */
  minChunks?: number;
}): Promise<{ chunks: RetrievedChunk[]; scopeUsed: FallbackScope }> {
  const { minChunks = 3, ...base } = opts;

  // 1. Most specific: topic.
  if (base.topicId) {
    const chunks = await retrieveForScope(base);
    if (chunks.length >= minChunks) return { chunks, scopeUsed: "topic" };
    // Hold onto the partial result; we'll fall back but keep it available.
    if (chunks.length > 0) {
      // Topic hits are still relevant; merge them with chapter-level later.
      const chapterRes = base.chapterId
        ? await retrieveForScope({ ...base, topicId: undefined })
        : [];
      const merged = dedupe([...chunks, ...chapterRes]).slice(0, base.k ?? 6);
      if (merged.length >= minChunks)
        return { chunks: merged, scopeUsed: "chapter" };
    }
  }

  // 2. Chapter-level (drop topic).
  if (base.chapterId) {
    const chunks = await retrieveForScope({ ...base, topicId: undefined });
    if (chunks.length >= minChunks) return { chunks, scopeUsed: "chapter" };
  }

  // 3. Subject-level (drop chapter + topic).
  if (base.subjectCode) {
    const chunks = await retrieveForScope({
      ...base,
      topicId: undefined,
      chapterId: undefined,
    });
    if (chunks.length >= minChunks) return { chunks, scopeUsed: "subject" };
  }

  // 4. Class-level (drop subject too) — last resort.
  if (base.classLevel) {
    const chunks = await retrieveForScope({
      ...base,
      topicId: undefined,
      chapterId: undefined,
      subjectCode: undefined,
    });
    if (chunks.length > 0) return { chunks, scopeUsed: "class" };
  }

  return { chunks: [], scopeUsed: "none" };
}

function dedupe(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const seen = new Set<string>();
  const out: RetrievedChunk[] = [];
  for (const c of chunks) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}
