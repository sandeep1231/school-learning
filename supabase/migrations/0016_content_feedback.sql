-- Phase 15 — content feedback table.
-- Lets learners flag lessons or practice items for review (e.g. "answer
-- looks wrong", "Odia translation confusing"). RLS: users insert their
-- own rows + read them; admins can read all via service-role client.

create table if not exists content_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  topic_id text,
  surface text not null check (surface in ('lesson','practice','other')),
  ref_id text,
  rating smallint check (rating between 1 and 5),
  category text check (category in ('wrong_answer','confusing','translation','typo','other')),
  comment text check (char_length(coalesce(comment,'')) <= 2000),
  url text,
  created_at timestamptz not null default now()
);

create index if not exists content_feedback_topic_idx
  on content_feedback (topic_id, created_at desc);
create index if not exists content_feedback_user_idx
  on content_feedback (user_id, created_at desc);

alter table content_feedback enable row level security;

drop policy if exists content_feedback_insert_own on content_feedback;
create policy content_feedback_insert_own on content_feedback
  for insert to authenticated
  with check (auth.uid() = user_id or user_id is null);

drop policy if exists content_feedback_select_own on content_feedback;
create policy content_feedback_select_own on content_feedback
  for select to authenticated
  using (auth.uid() = user_id);
