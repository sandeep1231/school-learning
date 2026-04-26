-- 0007_practice.sql
-- Phase 2: DB-backed practice engine.
--
-- Replaces the demo quiz bank (lib/ai/quizzes.ts) with AI-generated practice
-- items persisted in Postgres. Items are scoped to a topic (MVP), but the
-- schema supports chapter/subject-scoped items too so Phase 4's "Practice
-- chapter" button can reuse the same table.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type practice_scope as enum ('topic','chapter','subject');
exception when duplicate_object then null; end $$;

do $$ begin
  create type practice_kind as enum ('mcq','short','long');
exception when duplicate_object then null; end $$;

do $$ begin
  create type practice_difficulty as enum ('easy','medium','hard');
exception when duplicate_object then null; end $$;

do $$ begin
  create type practice_status as enum ('draft','published','hidden');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- practice_items — the question bank.
-- ---------------------------------------------------------------------------
-- scope_id is a loose FK (we don't enforce via fk because the target table
-- depends on scope_type). The generator + API always supply the right id.
-- For MCQ items, `payload` carries options + correct index. For short/long,
-- `payload` carries model_answer + keywords.
create table if not exists practice_items (
  id                uuid primary key default gen_random_uuid(),
  scope_type        practice_scope not null,
  scope_id          uuid not null,
  kind              practice_kind not null,
  difficulty        practice_difficulty not null default 'medium',
  language          app_language not null default 'or',
  question_md       text not null,
  payload           jsonb not null default '{}'::jsonb,
  explanation_md    text,
  source_chunk_ids  uuid[] not null default '{}',
  citation_page     int,
  citation_title    text,
  status            practice_status not null default 'published',
  created_by        uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists practice_items_scope_idx
  on practice_items(scope_type, scope_id, status);
create index if not exists practice_items_kind_idx
  on practice_items(scope_type, scope_id, kind, difficulty);

-- ---------------------------------------------------------------------------
-- attempts — each time a student answers an item.
-- ---------------------------------------------------------------------------
create table if not exists attempts (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references profiles(id) on delete cascade,
  item_id        uuid not null references practice_items(id) on delete cascade,
  topic_id       uuid references topics(id) on delete set null,
  given_answer   jsonb not null default '{}'::jsonb,
  is_correct     boolean,
  score          numeric,
  time_ms        int,
  created_at     timestamptz not null default now()
);
create index if not exists attempts_student_idx
  on attempts(student_id, created_at desc);
create index if not exists attempts_item_idx
  on attempts(item_id, created_at desc);
create index if not exists attempts_topic_idx
  on attempts(student_id, topic_id, created_at desc);

-- ---------------------------------------------------------------------------
-- item_flags — "Report this item" button. When count >= 3 the item is
-- auto-hidden (enforced at application read time). Admin can unhide.
-- ---------------------------------------------------------------------------
create table if not exists item_flags (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references practice_items(id) on delete cascade,
  student_id  uuid not null references profiles(id) on delete cascade,
  reason      text not null check (char_length(reason) between 1 and 500),
  created_at  timestamptz not null default now(),
  unique (item_id, student_id)
);
create index if not exists item_flags_item_idx on item_flags(item_id);

-- Convenience view: flag count per item. Used by the reader path to auto-hide
-- heavily flagged items without requiring admin action.
create or replace view v_item_flag_counts as
  select item_id, count(*)::int as flag_count
  from item_flags
  group by item_id;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table practice_items enable row level security;
alter table attempts       enable row level security;
alter table item_flags     enable row level security;

-- practice_items: published items are world-readable (guest flow needs them).
-- Drafts/hidden only visible to owner (content authors) + service role.
drop policy if exists "practice_items published readable" on practice_items;
create policy "practice_items published readable"
  on practice_items for select
  using (status = 'published');

drop policy if exists "practice_items owner read drafts" on practice_items;
create policy "practice_items owner read drafts"
  on practice_items for select
  using (auth.uid() = created_by);

-- Content generation runs with the service role, so no insert/update policies
-- are needed for normal users. (Service role bypasses RLS.)

-- attempts: owner-only.
drop policy if exists "attempts owner read" on attempts;
create policy "attempts owner read"
  on attempts for select using (auth.uid() = student_id);
drop policy if exists "attempts owner write" on attempts;
create policy "attempts owner write"
  on attempts for insert with check (auth.uid() = student_id);

-- Parents can read linked children's attempts (consistent with topic_progress).
drop policy if exists "attempts parent read" on attempts;
create policy "attempts parent read"
  on attempts for select
  using (student_id = any (linked_student_ids(auth.uid())));

-- item_flags: owner-only write, anyone can count (count happens via the view
-- with aggregate; grant select on the view below).
drop policy if exists "item_flags owner read" on item_flags;
create policy "item_flags owner read"
  on item_flags for select using (auth.uid() = student_id);
drop policy if exists "item_flags owner write" on item_flags;
create policy "item_flags owner write"
  on item_flags for insert with check (auth.uid() = student_id);

-- The view bypasses the flags RLS because it aggregates without exposing
-- student_id. Grant read to the anon role so the public reader can compute
-- auto-hide.
grant select on v_item_flag_counts to anon, authenticated;
