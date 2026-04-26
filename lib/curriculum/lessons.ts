import { createAdminClient } from "@/lib/supabase/admin";

export type LessonVariantKind = "textbook" | "simpler" | "parent" | "exam";
export type LessonLanguage = "or" | "en" | "hi";

export type LessonCitation = {
  title: string;
  page?: number | null;
  url?: string | null;
};

export type ParentPrompts = {
  questions: string[];
  tips?: string[];
};

export type LessonVariant = {
  id: string;
  topicId: string;
  variant: LessonVariantKind;
  language: LessonLanguage;
  bodyMd: string;
  citations: LessonCitation[];
  parentPrompts: ParentPrompts | null;
  sourceChunkIds: string[];
  updatedAt: string;
};

type Row = {
  id: string;
  topic_id: string;
  variant: LessonVariantKind;
  language: LessonLanguage;
  body_md: string;
  citations: unknown;
  parent_prompts: unknown;
  source_chunk_ids: string[] | null;
  updated_at: string;
};

function rowToVariant(row: Row): LessonVariant {
  return {
    id: row.id,
    topicId: row.topic_id,
    variant: row.variant,
    language: row.language,
    bodyMd: row.body_md,
    citations: Array.isArray(row.citations)
      ? (row.citations as LessonCitation[])
      : [],
    parentPrompts:
      row.parent_prompts && typeof row.parent_prompts === "object"
        ? (row.parent_prompts as ParentPrompts)
        : null,
    sourceChunkIds: row.source_chunk_ids ?? [],
    updatedAt: row.updated_at,
  };
}

/**
 * Load all lesson variants for a topic in a given language. Returns a map
 * keyed by variant so the page can pick whichever the audience toggle asks
 * for, falling back to 'textbook' if the requested variant is missing.
 */
export async function getLessonVariantsForTopic(
  topicId: string,
  language: LessonLanguage = "or",
): Promise<Partial<Record<LessonVariantKind, LessonVariant>>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("lesson_variants")
    .select(
      "id, topic_id, variant, language, body_md, citations, parent_prompts, source_chunk_ids, updated_at",
    )
    .eq("topic_id", topicId)
    .eq("language", language);
  if (error) {
    console.error("getLessonVariantsForTopic error", error);
    return {};
  }
  const out: Partial<Record<LessonVariantKind, LessonVariant>> = {};
  for (const row of (data ?? []) as Row[]) {
    out[row.variant] = rowToVariant(row);
  }
  return out;
}

export function pickLessonVariant<T extends { variant: LessonVariantKind }>(
  variants: Partial<Record<LessonVariantKind, T>>,
  requested: LessonVariantKind,
): T | null {
  return (
    variants[requested] ??
    variants.textbook ??
    variants.simpler ??
    variants.exam ??
    variants.parent ??
    null
  );
}
