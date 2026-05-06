/**
 * Document-as-chapter helpers for board/class combinations whose
 * curriculum hasn't been curated yet (Class 6/7/8 in Phase 1). The
 * ingestion pipeline drops one `documents` row per source PDF — typically
 * one PDF per chapter for BSE Odisha textbooks. Until a proper TOC is
 * seeded into `chapters` + `topics`, we render those documents as a
 * lightweight chapter list so learners can scope their chat to a single
 * unit instead of the whole subject.
 *
 * The `[C<n>]` title prefix is set by `scripts/ingest/ingest-class.ts` so
 * the same chapter PDF reused across classes doesn't collide.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { getSubjectByCode } from "@/lib/curriculum/db";

export type DocChapter = {
  id: string;
  title: string;
  rawTitle: string;
  slug: string;
  order: number;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function stripClassPrefix(title: string, classLevel: number): string {
  return title.replace(new RegExp(`^\\[C${classLevel}\\]\\s*`), "").trim();
}

/** Best-effort chapter-number extraction so we can sort and label cards. */
function extractChapterNumber(title: string): number | null {
  const m =
    title.match(/(?:chapter|ch|unit|lesson)\s*[-_.]*\s*(\d+)/i) ??
    title.match(/^\s*(\d+)[._\-)\s]/);
  return m ? Number.parseInt(m[1], 10) : null;
}

export async function listDocumentChapters(
  boardCode: string,
  classLevel: number,
  subjectCode: string,
): Promise<DocChapter[]> {
  const subject = await getSubjectByCode(
    subjectCode.toUpperCase(),
    boardCode,
    classLevel,
  );
  if (!subject) return [];
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("documents")
    .select("id, title, created_at")
    .eq("subject_id", subject.id);
  if (error || !data) return [];
  const seenSlugs = new Set<string>();
  const out: DocChapter[] = data.map((d, idx) => {
    const raw = String(d.title ?? "");
    const stripped = stripClassPrefix(raw, classLevel) || raw;
    let slug = slugify(stripped) || `doc-${idx + 1}`;
    while (seenSlugs.has(slug)) slug = `${slug}-${idx + 1}`;
    seenSlugs.add(slug);
    const num = extractChapterNumber(stripped);
    return {
      id: String(d.id),
      title: stripped,
      rawTitle: raw,
      slug,
      order: num ?? Number.MAX_SAFE_INTEGER,
    };
  });
  out.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title);
  });
  return out;
}

export async function findDocumentChapter(
  boardCode: string,
  classLevel: number,
  subjectCode: string,
  slug: string,
): Promise<DocChapter | null> {
  const list = await listDocumentChapters(boardCode, classLevel, subjectCode);
  return list.find((d) => d.slug === slug) ?? null;
}

/**
 * Bulk doc-count per subject for a given (board, class). Used by the
 * TodayUnseeded dashboard to show "N chapters" on each subject card.
 * Returned map keys are subject codes (uppercase).
 */
export async function countDocumentsBySubject(
  subjectIds: string[],
): Promise<Map<string, number>> {
  if (subjectIds.length === 0) return new Map();
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("documents")
    .select("subject_id")
    .in("subject_id", subjectIds);
  if (error || !data) return new Map();
  const out = new Map<string, number>();
  for (const row of data) {
    const k = String(row.subject_id);
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}
