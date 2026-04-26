-- ---------------------------------------------------------------------------
-- Phase 9.1 — Spaced-repetition cards (SM-2 scheduler)
-- ---------------------------------------------------------------------------
-- One card per (student, practice_item). Scheduler updates ease, interval and
-- due_at after every attempt based on the learner's self-reported / measured
-- recall quality (0-5 SM-2 scale; we derive q from attempt score fraction).
-- ---------------------------------------------------------------------------

create table if not exists srs_cards (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references profiles(id) on delete cascade,
  item_id        uuid not null references practice_items(id) on delete cascade,
  ease           real not null default 2.5,           -- SM-2 EF, starts 2.5, floor 1.3
  interval_days  int  not null default 0,             -- current interval
  reps           int  not null default 0,             -- successful reviews in a row
  lapses         int  not null default 0,             -- # times recall quality < 3
  last_reviewed_at timestamptz,
  due_at         timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (student_id, item_id)
);

create index if not exists srs_cards_due_idx
  on srs_cards(student_id, due_at);

create index if not exists srs_cards_item_idx
  on srs_cards(item_id);

-- RLS: a student sees only their own cards.
alter table srs_cards enable row level security;

drop policy if exists srs_cards_self_select on srs_cards;
create policy srs_cards_self_select on srs_cards
  for select using (student_id = auth.uid());

drop policy if exists srs_cards_self_insert on srs_cards;
create policy srs_cards_self_insert on srs_cards
  for insert with check (student_id = auth.uid());

drop policy if exists srs_cards_self_update on srs_cards;
create policy srs_cards_self_update on srs_cards
  for update using (student_id = auth.uid())
               with check (student_id = auth.uid());

drop policy if exists srs_cards_self_delete on srs_cards;
create policy srs_cards_self_delete on srs_cards
  for delete using (student_id = auth.uid());

comment on table srs_cards is
  'Spaced-repetition state per (student, practice_item). Updated by /api/practice/submit.';
