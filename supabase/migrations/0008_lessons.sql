-- 0008_lessons.sql
-- Phase 3: 3-level lesson variants + Parent mode.
--
-- For each topic we store up to 3 variants of the explanation:
--   - textbook : full formal treatment mirroring the textbook
--   - simpler  : friendlier, shorter, more examples
--   - parent   : coaching script for a parent reading with the child
-- All variants are AI-generated from the same RAG context, then stored
-- per (topic_id, variant, language) so we can render instantly.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type lesson_variant as enum ('textbook','simpler','parent');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- lesson_variants
-- ---------------------------------------------------------------------------
create table if not exists lesson_variants (
  id              uuid primary key default gen_random_uuid(),
  topic_id        uuid not null references topics(id) on delete cascade,
  variant         lesson_variant not null,
  language        app_language not null default 'or',
  body_md         text not null,
  -- optional "Questions to ask your child" panel, only set for variant=parent
  parent_prompts  jsonb,
  citations       jsonb not null default '[]'::jsonb,
  source_chunk_ids uuid[] not null default '{}',
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (topic_id, variant, language)
);

create index if not exists lesson_variants_topic_idx
  on lesson_variants(topic_id, language);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table lesson_variants enable row level security;

-- Lesson variants are world-readable (guest flow needs them).
drop policy if exists "lesson_variants public read" on lesson_variants;
create policy "lesson_variants public read"
  on lesson_variants for select using (true);

-- Content generation runs with the service role (bypasses RLS); no
-- insert/update policies needed for normal users.
