-- 0006_curriculum_slugs.sql
-- Phase 0 foundation for multi-board SaaS.
--
-- 1. Add stable slug identifiers to chapters and topics so URLs like
--      /b/:board/c/:classNum/s/:subjectCode/ch/:chapterSlug/t/:topicSlug
--    survive re-seeds. UUID primary keys remain authoritative — slugs are a
--    second, human-readable lookup key populated by the seed script.
--
-- 2. Introduce a boards lookup so the BoardClassSwitcher (Phase 1) has a real
--    table to read from. Only BSE_ODISHA is seeded here; adding a new board
--    later becomes a one-row INSERT + content ingest.
--
-- Idempotent: safe to run on a DB that already has this migration.

alter table chapters add column if not exists slug text;
alter table topics   add column if not exists slug text;

-- Slugs are unique per parent scope. Partial indexes allow the column to
-- remain nullable until the seed backfills, and still enforce uniqueness
-- on populated rows.
create unique index if not exists chapters_subject_slug_key
  on chapters(subject_id, slug) where slug is not null;
create unique index if not exists topics_chapter_slug_key
  on topics(chapter_id, slug) where slug is not null;

-- Topic slugs are globally unique in the application source of truth
-- (e.g. "mth-1-1"). Enforce it so getTopicBySlug is a single-column lookup.
create unique index if not exists topics_slug_global_key
  on topics(slug) where slug is not null;

-- Boards lookup. profiles.board / subjects.board remain plain text columns
-- (backward compatible); this table is authoritative for display names.
create table if not exists boards (
  code        text primary key,
  name_en     text not null,
  name_or     text,
  name_hi     text,
  country     text not null default 'IN',
  created_at  timestamptz not null default now()
);

insert into boards (code, name_en, name_or, name_hi) values
  ('BSE_ODISHA',
   'Board of Secondary Education, Odisha',
   'ମାଧ୍ୟମିକ ଶିକ୍ଷା ପରିଷଦ, ଓଡ଼ିଶା',
   'माध्यमिक शिक्षा परिषद, ओडिशा')
on conflict (code) do nothing;

-- RLS: boards is world-readable (curriculum reference data).
alter table boards enable row level security;
drop policy if exists "boards readable" on boards;
create policy "boards readable" on boards for select using (true);
