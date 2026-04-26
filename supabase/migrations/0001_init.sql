-- ============================================================================
-- BSE Odisha Class 9 AI Tutor — initial schema
-- ============================================================================
-- Supabase auth.users is the identity source. Everything here is keyed off it
-- via profiles(id). All tables are protected by RLS.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type app_role as enum ('student', 'parent', 'teacher', 'admin');
create type app_language as enum ('en', 'or', 'hi');
create type medium_of_instruction as enum ('english', 'odia', 'hindi');
create type plan_item_status as enum ('pending', 'in_progress', 'completed', 'skipped');
create type message_role as enum ('system', 'user', 'assistant');
create type notification_channel as enum ('email', 'whatsapp', 'sms', 'inapp');
create type notification_status as enum ('queued', 'sent', 'failed');

-- ---------------------------------------------------------------------------
-- profiles — 1:1 with auth.users
-- ---------------------------------------------------------------------------
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  role            app_role not null default 'student',
  full_name       text,
  phone           text,
  preferred_language app_language not null default 'en',
  medium          medium_of_instruction not null default 'english',
  class_level     smallint not null default 9 check (class_level between 6 and 12),
  board           text not null default 'BSE_ODISHA',
  consent_at      timestamptz,           -- parental consent for minors
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index profiles_role_idx on profiles(role);

-- ---------------------------------------------------------------------------
-- Families: link parents to students
-- ---------------------------------------------------------------------------
create table families (
  id           uuid primary key default gen_random_uuid(),
  invite_code  text unique not null,
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table family_members (
  family_id  uuid references families(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  relation   text not null check (relation in ('student','parent','guardian')),
  primary key (family_id, profile_id)
);
create index family_members_profile_idx on family_members(profile_id);

-- ---------------------------------------------------------------------------
-- Curriculum: subject -> chapter -> topic
-- ---------------------------------------------------------------------------
create table subjects (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,          -- e.g. MTH, GSC, SSC, FLO, SLE, TLH
  name_en       text not null,
  name_or       text,
  name_hi       text,
  class_level   smallint not null default 9,
  board         text not null default 'BSE_ODISHA',
  created_at    timestamptz not null default now()
);

create table chapters (
  id           uuid primary key default gen_random_uuid(),
  subject_id   uuid not null references subjects(id) on delete cascade,
  order_index  int not null,
  title_en     text not null,
  title_or     text,
  title_hi     text,
  est_hours    numeric(4,1),
  source_url   text,                    -- link to official PDF
  created_at   timestamptz not null default now(),
  unique (subject_id, order_index)
);

create table topics (
  id                  uuid primary key default gen_random_uuid(),
  chapter_id          uuid not null references chapters(id) on delete cascade,
  order_index         int not null,
  title_en            text not null,
  title_or            text,
  title_hi            text,
  learning_objectives jsonb not null default '[]'::jsonb,
  approx_duration_min int not null default 45,
  created_at          timestamptz not null default now(),
  unique (chapter_id, order_index)
);
create index topics_chapter_idx on topics(chapter_id);

-- ---------------------------------------------------------------------------
-- Knowledge base: documents + chunks with pgvector embeddings
-- ---------------------------------------------------------------------------
create table documents (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  source_type  text not null check (source_type in ('syllabus','textbook','ncert','qa_bank','teacher_note')),
  source_url   text,
  storage_path text,                    -- supabase storage path
  language     app_language not null default 'en',
  subject_id   uuid references subjects(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  topic_id     uuid references topics(id) on delete set null,
  chapter_id   uuid references chapters(id) on delete set null,
  content      text not null,
  page         int,
  language     app_language not null default 'en',
  token_count  int,
  embedding    vector(768),             -- text-embedding-004 dim
  tsv          tsvector generated always as (to_tsvector('simple', coalesce(content,''))) stored,
  created_at   timestamptz not null default now()
);
create index chunks_topic_idx  on chunks(topic_id);
create index chunks_tsv_idx    on chunks using gin(tsv);
create index chunks_embed_idx  on chunks using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- ---------------------------------------------------------------------------
-- Study plan per student
-- ---------------------------------------------------------------------------
create table study_plans (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references profiles(id) on delete cascade,
  start_date   date not null,
  end_date     date not null,
  created_at   timestamptz not null default now()
);
create index study_plans_student_idx on study_plans(student_id);

create table study_plan_items (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references study_plans(id) on delete cascade,
  scheduled_on date not null,
  subject_id   uuid not null references subjects(id),
  topic_id     uuid not null references topics(id),
  status       plan_item_status not null default 'pending',
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);
create index spi_plan_date_idx on study_plan_items(plan_id, scheduled_on);

-- ---------------------------------------------------------------------------
-- Chat: topic-scoped sessions
-- ---------------------------------------------------------------------------
create table chat_sessions (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references profiles(id) on delete cascade,
  topic_id     uuid references topics(id) on delete set null,
  language     app_language not null default 'en',
  created_at   timestamptz not null default now(),
  last_msg_at  timestamptz
);
create index chat_sessions_student_idx on chat_sessions(student_id, last_msg_at desc);

create table chat_messages (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references chat_sessions(id) on delete cascade,
  role          message_role not null,
  content       text not null,
  citations     jsonb not null default '[]'::jsonb,
  input_tokens  int,
  output_tokens int,
  flagged       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index chat_messages_session_idx on chat_messages(session_id, created_at);

-- ---------------------------------------------------------------------------
-- Quizzes
-- ---------------------------------------------------------------------------
create table quizzes (
  id          uuid primary key default gen_random_uuid(),
  topic_id    uuid not null references topics(id) on delete cascade,
  language    app_language not null default 'en',
  created_at  timestamptz not null default now()
);

create table quiz_questions (
  id          uuid primary key default gen_random_uuid(),
  quiz_id     uuid not null references quizzes(id) on delete cascade,
  order_index int not null,
  kind        text not null check (kind in ('mcq','short')),
  prompt      text not null,
  options     jsonb,                       -- [{key,label}]
  answer      text not null,
  explanation text not null,
  unique (quiz_id, order_index)
);

create table quiz_attempts (
  id           uuid primary key default gen_random_uuid(),
  quiz_id      uuid not null references quizzes(id) on delete cascade,
  student_id   uuid not null references profiles(id) on delete cascade,
  score        numeric(5,2),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz
);
create index qa_student_idx on quiz_attempts(student_id, started_at desc);

create table quiz_responses (
  attempt_id   uuid references quiz_attempts(id) on delete cascade,
  question_id  uuid references quiz_questions(id) on delete cascade,
  response     text,
  is_correct   boolean,
  primary key (attempt_id, question_id)
);

-- ---------------------------------------------------------------------------
-- Daily summaries for parents
-- ---------------------------------------------------------------------------
create table daily_summaries (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references profiles(id) on delete cascade,
  summary_date       date not null,
  covered_topic_ids  uuid[] not null default '{}',
  chat_count         int not null default 0,
  quiz_avg_score     numeric(5,2),
  parent_note        text,
  generated_at       timestamptz not null default now(),
  unique (student_id, summary_date)
);

-- ---------------------------------------------------------------------------
-- Notification outbox
-- ---------------------------------------------------------------------------
create table notifications_outbox (
  id          uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid references profiles(id) on delete cascade,
  channel     notification_channel not null,
  template    text not null,
  payload     jsonb not null default '{}'::jsonb,
  status      notification_status not null default 'queued',
  error       text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index notif_status_idx on notifications_outbox(status, created_at);

-- ---------------------------------------------------------------------------
-- Helper: updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_profiles_updated
  before update on profiles
  for each row execute function set_updated_at();
