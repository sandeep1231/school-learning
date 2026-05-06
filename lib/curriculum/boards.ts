/**
 * Board slug helpers.
 *
 * DB stores boards in SCREAMING_SNAKE_CASE (e.g. `BSE_ODISHA`). URLs use
 * lowercase, hyphenated slugs (`bse-od`). These helpers are the single
 * source of truth for converting between the two.
 *
 * Adding a new board = append a row here AND insert into the `boards` table
 * via a migration (see 0006_curriculum_slugs.sql).
 */

export type BoardInfo = {
  slug: string;
  code: string;
  shortLabel: string;
  name: { en: string; or?: string; hi?: string };
};

export const BOARDS: BoardInfo[] = [
  {
    slug: "bse-od",
    code: "BSE_ODISHA",
    shortLabel: "BSE Odisha",
    name: {
      en: "Board of Secondary Education, Odisha",
      or: "ମାଧ୍ୟମିକ ଶିକ୍ଷା ପରିଷଦ, ଓଡ଼ିଶା",
      hi: "माध्यमिक शिक्षा परिषद, ओडिशा",
    },
  },
];

export const DEFAULT_BOARD_SLUG = "bse-od";
export const DEFAULT_BOARD_CODE = "BSE_ODISHA";
export const DEFAULT_CLASS_LEVEL = 9;

/** Supported class levels in v1. Grow as content is added per board. */
export const SUPPORTED_CLASSES: Record<string, number[]> = {
  BSE_ODISHA: [6, 7, 8, 9],
};

export function boardSlugToCode(slug: string): string | null {
  const hit = BOARDS.find((b) => b.slug === slug.toLowerCase());
  return hit?.code ?? null;
}

export function boardCodeToSlug(code: string): string {
  const hit = BOARDS.find((b) => b.code === code);
  return hit?.slug ?? DEFAULT_BOARD_SLUG;
}

export function getBoardInfo(slugOrCode: string): BoardInfo | null {
  const s = slugOrCode.toLowerCase();
  return (
    BOARDS.find((b) => b.slug === s || b.code === slugOrCode.toUpperCase()) ??
    null
  );
}

export function isClassSupported(boardCode: string, classLevel: number): boolean {
  const list = SUPPORTED_CLASSES[boardCode];
  return !!list && list.includes(classLevel);
}

/**
 * Combinations whose chapters/topics are fully seeded in the DB. UI uses
 * this to decide whether to show the structured-curriculum experience or
 * fall back to "documents-ready, lessons coming soon" with subject-level
 * chat. Update when the seed script ships content for a new class.
 */
// Only Class 9 BSE Odisha currently has the curated structured /today
// experience (static curriculum module + per-topic stages). Classes 6/7/8
// have DB-seeded chapters & topics but the /today rendering imports
// hardcoded Class-9 ALL_TOPICS / CURRICULUM, so listing 6/7/8 here would
// show Class-9 content for the wrong class. They go through TodayUnseeded
// instead, which queries the DB by class and renders correctly.
//
// When /today is refactored to read DB-backed subjects for non-C9 classes,
// re-add 6/7/8 here.
export const SEEDED_CLASS_COMBOS: Array<{ boardCode: string; classLevel: number }> = [
  { boardCode: "BSE_ODISHA", classLevel: 9 },
];

export function isCurriculumSeeded(boardCode: string, classLevel: number): boolean {
  return SEEDED_CLASS_COMBOS.some(
    (c) => c.boardCode === boardCode && c.classLevel === classLevel,
  );
}

/**
 * DB-aware seeded check. Returns true if either (a) the combo is in the
 * static SEEDED_CLASS_COMBOS list (curated curriculum like Class 9) or
 * (b) the seeder has populated at least one chapter with at least one
 * topic for that (board, class) in the database. Page components should
 * prefer this over the sync version so the structured experience flips on
 * automatically once `npm run seed:topics -- --class N` succeeds.
 *
 * Cached for 60s in-process to avoid hitting Supabase on every render.
 */
const dbSeededCache = new Map<string, { value: boolean; at: number }>();
const DB_SEEDED_TTL_MS = 60_000;

export async function isCurriculumSeededAsync(
  boardCode: string,
  classLevel: number,
): Promise<boolean> {
  if (isCurriculumSeeded(boardCode, classLevel)) return true;
  const key = `${boardCode}:${classLevel}`;
  const cached = dbSeededCache.get(key);
  if (cached && Date.now() - cached.at < DB_SEEDED_TTL_MS) return cached.value;

  // Lazy import so client bundles don't pull in supabase admin.
  const { ensureCurriculum } = await import("./db");
  const c = await ensureCurriculum();
  const subjectIds = c.subjects
    .filter((s) => s.board === boardCode && s.classLevel === classLevel)
    .map((s) => s.id);
  let seeded = false;
  for (const sid of subjectIds) {
    const chapters = c.chaptersBySubject.get(sid) ?? [];
    for (const ch of chapters) {
      const topics = c.topicsByChapter.get(ch.id) ?? [];
      if (topics.length > 0) {
        seeded = true;
        break;
      }
    }
    if (seeded) break;
  }
  dbSeededCache.set(key, { value: seeded, at: Date.now() });
  return seeded;
}

/** Short label like "BSE Odisha". Falls back to the code if unknown. */
export function formatBoardLabel(boardCode: string): string {
  const hit = BOARDS.find((b) => b.code === boardCode);
  return hit?.shortLabel ?? boardCode;
}

/** "Class 7" — kept short so it composes well with the board label. */
export function formatClassLabel(classLevel: number): string {
  return `Class ${classLevel}`;
}

/** "BSE Odisha · Class 7" — the canonical context label used across the UI. */
export function formatBoardClassLabel(
  boardCode: string,
  classLevel: number,
): string {
  return `${formatBoardLabel(boardCode)} · ${formatClassLabel(classLevel)}`;
}
