/**
 * DB-backed curriculum reader.
 *
 * Phase 0 deliverable for the multi-board SaaS pivot. Nothing in the app
 * consumes this module yet — Phase 1 migrates the `/subject`, `/topic`, and
 * `/today` routes over to `getSubjectByCode` / `getTopicBySlug` etc.
 *
 * Design notes
 *  - Module-level cache with a 5 minute TTL. Curriculum data is small
 *    (~hundreds of rows) and changes only when the seed script runs.
 *  - All lookups are synchronous once the cache is warm, so callers can
 *    `await ensureCurriculum()` once per request and then use the pure
 *    helpers below.
 *  - UUID primary keys are internal; callers should prefer slugs so URLs
 *    survive re-seeds and cross-board installs.
 */
import { createAdminClient } from "@/lib/supabase/admin";

export type Locale = "en" | "or" | "hi";
export type I18nText = { en: string; or: string | null; hi: string | null };

export type DbSubject = {
  id: string;
  code: string;
  name: I18nText;
  classLevel: number;
  board: string;
};

export type DbChapter = {
  id: string;
  subjectId: string;
  order: number;
  slug: string | null;
  title: I18nText;
};

export type DbTopic = {
  id: string;
  chapterId: string;
  order: number;
  slug: string | null;
  title: I18nText;
  objectives: string[];
  durationMin: number;
};

type Cache = {
  subjects: DbSubject[];
  chapters: DbChapter[];
  topics: DbTopic[];
  subjectByCode: Map<string, DbSubject>;
  subjectById: Map<string, DbSubject>;
  chapterById: Map<string, DbChapter>;
  chaptersBySubject: Map<string, DbChapter[]>;
  topicById: Map<string, DbTopic>;
  topicBySlug: Map<string, DbTopic>;
  topicsByChapter: Map<string, DbTopic[]>;
  loadedAt: number;
};

let cache: Cache | null = null;
let inflight: Promise<Cache> | null = null;
const TTL_MS = 5 * 60 * 1000;

function rowToSubject(r: {
  id: string;
  code: string;
  name_en: string;
  name_or: string | null;
  name_hi: string | null;
  class_level: number;
  board: string;
}): DbSubject {
  return {
    id: r.id,
    code: r.code,
    name: { en: r.name_en, or: r.name_or, hi: r.name_hi },
    classLevel: r.class_level,
    board: r.board,
  };
}

function rowToChapter(r: {
  id: string;
  subject_id: string;
  order_index: number;
  slug: string | null;
  title_en: string;
  title_or: string | null;
  title_hi: string | null;
}): DbChapter {
  return {
    id: r.id,
    subjectId: r.subject_id,
    order: r.order_index,
    slug: r.slug,
    title: { en: r.title_en, or: r.title_or, hi: r.title_hi },
  };
}

function rowToTopic(r: {
  id: string;
  chapter_id: string;
  order_index: number;
  slug: string | null;
  title_en: string;
  title_or: string | null;
  title_hi: string | null;
  learning_objectives: unknown;
  approx_duration_min: number | null;
}): DbTopic {
  const obj = Array.isArray(r.learning_objectives)
    ? (r.learning_objectives as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  return {
    id: r.id,
    chapterId: r.chapter_id,
    order: r.order_index,
    slug: r.slug,
    title: { en: r.title_en, or: r.title_or, hi: r.title_hi },
    objectives: obj,
    durationMin: r.approx_duration_min ?? 45,
  };
}

async function load(): Promise<Cache> {
  const sb = createAdminClient();
  const [sr, cr, tr] = await Promise.all([
    sb.from("subjects").select("id, code, name_en, name_or, name_hi, class_level, board"),
    sb.from("chapters").select("id, subject_id, order_index, slug, title_en, title_or, title_hi"),
    sb
      .from("topics")
      .select(
        "id, chapter_id, order_index, slug, title_en, title_or, title_hi, learning_objectives, approx_duration_min",
      ),
  ]);
  if (sr.error) throw new Error(`load subjects: ${sr.error.message}`);
  if (cr.error) throw new Error(`load chapters: ${cr.error.message}`);
  if (tr.error) throw new Error(`load topics: ${tr.error.message}`);

  const subjects = (sr.data ?? []).map(rowToSubject);
  const chapters = (cr.data ?? []).map(rowToChapter);
  const topics = (tr.data ?? []).map(rowToTopic);

  const subjectByCode = new Map<string, DbSubject>();
  const subjectById = new Map<string, DbSubject>();
  for (const s of subjects) {
    subjectByCode.set(`${s.board}:${s.classLevel}:${s.code}`, s);
    subjectById.set(s.id, s);
  }

  const chapterById = new Map<string, DbChapter>();
  const chaptersBySubject = new Map<string, DbChapter[]>();
  for (const c of chapters) {
    chapterById.set(c.id, c);
    const list = chaptersBySubject.get(c.subjectId) ?? [];
    list.push(c);
    chaptersBySubject.set(c.subjectId, list);
  }
  for (const list of chaptersBySubject.values()) list.sort((a, b) => a.order - b.order);

  const topicById = new Map<string, DbTopic>();
  const topicBySlug = new Map<string, DbTopic>();
  const topicsByChapter = new Map<string, DbTopic[]>();
  for (const t of topics) {
    topicById.set(t.id, t);
    if (t.slug) topicBySlug.set(t.slug, t);
    const list = topicsByChapter.get(t.chapterId) ?? [];
    list.push(t);
    topicsByChapter.set(t.chapterId, list);
  }
  for (const list of topicsByChapter.values()) list.sort((a, b) => a.order - b.order);

  return {
    subjects,
    chapters,
    topics,
    subjectByCode,
    subjectById,
    chapterById,
    chaptersBySubject,
    topicById,
    topicBySlug,
    topicsByChapter,
    loadedAt: Date.now(),
  };
}

export async function ensureCurriculum(): Promise<Cache> {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache;
  if (inflight) return inflight;
  inflight = load()
    .then((c) => {
      cache = c;
      return c;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Force a reload; useful after the seed script runs in the same process. */
export function invalidateCurriculumCache() {
  cache = null;
}

// ---------------------------------------------------------------------------
// Read API — all async so callers can rely on a warm cache per request.
// ---------------------------------------------------------------------------

export async function listSubjects(
  board = "BSE_ODISHA",
  classLevel = 9,
): Promise<DbSubject[]> {
  const c = await ensureCurriculum();
  return c.subjects
    .filter((s) => s.board === board && s.classLevel === classLevel)
    .sort((a, b) => a.code.localeCompare(b.code));
}

export async function getSubjectByCode(
  code: string,
  board = "BSE_ODISHA",
  classLevel = 9,
): Promise<DbSubject | null> {
  const c = await ensureCurriculum();
  return c.subjectByCode.get(`${board}:${classLevel}:${code}`) ?? null;
}

export async function getSubjectById(id: string): Promise<DbSubject | null> {
  const c = await ensureCurriculum();
  return c.subjectById.get(id) ?? null;
}

export async function listChaptersBySubject(subjectId: string): Promise<DbChapter[]> {
  const c = await ensureCurriculum();
  return c.chaptersBySubject.get(subjectId) ?? [];
}

export async function getChapterBySlug(
  subjectId: string,
  slug: string,
): Promise<DbChapter | null> {
  const c = await ensureCurriculum();
  return (
    (c.chaptersBySubject.get(subjectId) ?? []).find((ch) => ch.slug === slug) ?? null
  );
}

export async function getChapterById(id: string): Promise<DbChapter | null> {
  const c = await ensureCurriculum();
  return c.chapterById.get(id) ?? null;
}

export async function listTopicsByChapter(chapterId: string): Promise<DbTopic[]> {
  const c = await ensureCurriculum();
  return c.topicsByChapter.get(chapterId) ?? [];
}

export async function getTopicBySlug(slug: string): Promise<DbTopic | null> {
  const c = await ensureCurriculum();
  return c.topicBySlug.get(slug) ?? null;
}

export async function getTopicById(id: string): Promise<DbTopic | null> {
  const c = await ensureCurriculum();
  return c.topicById.get(id) ?? null;
}

/**
 * Convenience — resolve a topic slug all the way to (subject, chapter, topic).
 * Returns null if any lookup fails. Phase 1 route handlers for
 * /b/:board/c/:class/s/:subject/ch/:chapterSlug/t/:topicSlug use this.
 */
export async function resolveTopicPath(
  topicSlug: string,
): Promise<{ subject: DbSubject; chapter: DbChapter; topic: DbTopic } | null> {
  const c = await ensureCurriculum();
  const topic = c.topicBySlug.get(topicSlug);
  if (!topic) return null;
  const chapter = c.chapterById.get(topic.chapterId);
  if (!chapter) return null;
  const subject = c.subjectById.get(chapter.subjectId);
  if (!subject) return null;
  return { subject, chapter, topic };
}
