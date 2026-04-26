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
  BSE_ODISHA: [9],
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
