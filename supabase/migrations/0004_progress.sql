-- 0004_progress.sql
-- Per-student progress through the 4-stage learning flow:
-- (1) Learn → (2) Ask → (3) Practice → (4) Master
-- A topic is "mastered" once the student scores >= 70% in Master stage.

create type stage_kind as enum ('learn','ask','practice','master');
create type stage_status as enum ('locked','available','in_progress','completed','mastered');

create table if not exists topic_progress (
  student_id    uuid not null references profiles(id) on delete cascade,
  topic_id      uuid not null references topics(id)   on delete cascade,
  stage         stage_kind not null,
  status        stage_status not null default 'locked',
  score         numeric,
  attempts      int not null default 0,
  completed_at  timestamptz,
  updated_at    timestamptz not null default now(),
  primary key (student_id, topic_id, stage)
);
create index if not exists idx_topic_progress_student on topic_progress(student_id, updated_at desc);

create table if not exists mastery_events (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references profiles(id) on delete cascade,
  topic_id    uuid not null references topics(id)   on delete cascade,
  score       numeric not null,
  happened_at timestamptz not null default now()
);
create index if not exists idx_mastery_events_student on mastery_events(student_id, happened_at desc);

-- RLS
alter table topic_progress enable row level security;
alter table mastery_events enable row level security;

create policy "student reads own progress" on topic_progress
  for select using (auth.uid() = student_id);
create policy "student writes own progress" on topic_progress
  for insert with check (auth.uid() = student_id);
create policy "student updates own progress" on topic_progress
  for update using (auth.uid() = student_id);

create policy "parent reads linked child progress" on topic_progress
  for select using (student_id = any (linked_student_ids(auth.uid())));

create policy "student reads own mastery" on mastery_events
  for select using (auth.uid() = student_id);
create policy "student writes own mastery" on mastery_events
  for insert with check (auth.uid() = student_id);
create policy "parent reads linked child mastery" on mastery_events
  for select using (student_id = any (linked_student_ids(auth.uid())));

-- Helper view: student's "next unlocked stage" per topic.
-- Used by the Today page to route the student into the right screen.
create or replace function next_stage(p_student uuid, p_topic uuid)
returns stage_kind
language sql stable as $$
  with s as (
    select stage, status from topic_progress
    where student_id = p_student and topic_id = p_topic
  )
  select case
    when not exists (select 1 from s where stage='learn' and status in ('completed','mastered'))
      then 'learn'::stage_kind
    when not exists (select 1 from s where stage='practice' and status in ('completed','mastered'))
      then 'practice'::stage_kind
    when not exists (select 1 from s where stage='master' and status='mastered')
      then 'master'::stage_kind
    else 'master'::stage_kind
  end
$$;
