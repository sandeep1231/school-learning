-- 0009_progress_rollup.sql
-- Phase 4: Dashboard rollup — streaks table + subject/chapter views.
--
-- Streaks are append-only activity logs + a derived view that reports the
-- current streak length for a student.
-- v_topic_accuracy: per (student, topic) practice accuracy from `attempts`.
-- v_subject_progress: per (student, subject) topics_total / topics_done /
--   practice_accuracy_pct.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- streaks — one row per (student, UTC day) whenever the student was active.
-- ---------------------------------------------------------------------------
create table if not exists activity_days (
  student_id  uuid not null references profiles(id) on delete cascade,
  day         date not null,
  first_at    timestamptz not null default now(),
  last_at     timestamptz not null default now(),
  primary key (student_id, day)
);
create index if not exists activity_days_student_idx
  on activity_days(student_id, day desc);

alter table activity_days enable row level security;
drop policy if exists "activity_days owner read" on activity_days;
create policy "activity_days owner read"
  on activity_days for select using (auth.uid() = student_id);
drop policy if exists "activity_days owner write" on activity_days;
create policy "activity_days owner write"
  on activity_days for insert with check (auth.uid() = student_id);
drop policy if exists "activity_days owner update" on activity_days;
create policy "activity_days owner update"
  on activity_days for update using (auth.uid() = student_id);

-- Parents can see linked children's activity.
drop policy if exists "activity_days parent read" on activity_days;
create policy "activity_days parent read"
  on activity_days for select
  using (student_id = any (linked_student_ids(auth.uid())));

-- ---------------------------------------------------------------------------
-- v_topic_accuracy — practice accuracy per (student, topic).
-- Accuracy = avg(score) over all attempts (score is 0..1 written by
-- /api/practice/submit per item).
-- ---------------------------------------------------------------------------
create or replace view v_topic_accuracy as
  select
    a.student_id,
    a.topic_id,
    count(*)::int                              as attempts_count,
    round(avg(coalesce(a.score, 0))::numeric, 4) as accuracy
  from attempts a
  where a.topic_id is not null
  group by a.student_id, a.topic_id;

grant select on v_topic_accuracy to anon, authenticated;

-- ---------------------------------------------------------------------------
-- v_subject_progress — per subject: topics_total (student-agnostic).
-- Per-student progress is computed in the app layer by joining subjects,
-- topics, chapters, topic_progress and v_topic_accuracy.
-- ---------------------------------------------------------------------------
create or replace view v_subject_progress as
  select
    s.id          as subject_id,
    s.code        as subject_code,
    count(t.id)::int as topics_total
  from subjects s
  left join chapters c on c.subject_id = s.id
  left join topics   t on t.chapter_id = c.id
  group by s.id, s.code;

grant select on v_subject_progress to anon, authenticated;
