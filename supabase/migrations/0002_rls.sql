-- ============================================================================
-- Row Level Security policies
-- ============================================================================
-- Model:
--   student  -> own rows only
--   parent   -> linked children via family_members
--   teacher  -> assigned cohorts (future: cohorts table); for MVP, read-only
--               access to linked students via family_members is NOT granted;
--               teachers use service-role admin surfaces for now.
--   admin    -> full access
-- ============================================================================

-- Enable RLS on all user-data tables
alter table profiles             enable row level security;
alter table families             enable row level security;
alter table family_members       enable row level security;
alter table study_plans          enable row level security;
alter table study_plan_items     enable row level security;
alter table chat_sessions        enable row level security;
alter table chat_messages        enable row level security;
alter table quiz_attempts        enable row level security;
alter table quiz_responses       enable row level security;
alter table daily_summaries      enable row level security;
alter table notifications_outbox enable row level security;

-- Curriculum + KB are world-readable to authenticated users
alter table subjects        enable row level security;
alter table chapters        enable row level security;
alter table topics          enable row level security;
alter table documents       enable row level security;
alter table chunks          enable row level security;
alter table quizzes         enable row level security;
alter table quiz_questions  enable row level security;

-- ---------------------------------------------------------------------------
-- Helper: is current user admin?
-- ---------------------------------------------------------------------------
create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Returns profile ids that the current user (parent) is linked to as child
create or replace function linked_student_ids(p_uid uuid default auth.uid()) returns uuid[]
  language sql stable security definer set search_path = public as $$
  select array(select fm_child.profile_id
  from family_members fm_me
  join family_members fm_child on fm_child.family_id = fm_me.family_id
  where fm_me.profile_id = p_uid
    and fm_me.relation in ('parent','guardian')
    and fm_child.relation = 'student');
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select_self on profiles for select
  using (id = auth.uid() or id = any (linked_student_ids()) or is_admin());
create policy profiles_update_self on profiles for update
  using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());
create policy profiles_insert_self on profiles for insert
  with check (id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- families / family_members
-- ---------------------------------------------------------------------------
create policy families_rw_member on families for all
  using (
    is_admin() or exists (
      select 1 from family_members fm
      where fm.family_id = families.id and fm.profile_id = auth.uid()
    )
  )
  with check (
    is_admin() or created_by = auth.uid()
  );

create policy family_members_rw_self on family_members for all
  using (
    is_admin()
    or profile_id = auth.uid()
    or family_id in (select family_id from family_members where profile_id = auth.uid())
  )
  with check (
    is_admin()
    or profile_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Curriculum + KB: read to any authenticated user
-- ---------------------------------------------------------------------------
create policy subjects_read      on subjects       for select using (auth.role() = 'authenticated');
create policy chapters_read      on chapters       for select using (auth.role() = 'authenticated');
create policy topics_read        on topics         for select using (auth.role() = 'authenticated');
create policy documents_read     on documents      for select using (auth.role() = 'authenticated');
create policy chunks_read        on chunks         for select using (auth.role() = 'authenticated');
create policy quizzes_read       on quizzes        for select using (auth.role() = 'authenticated');
create policy quiz_questions_read on quiz_questions for select using (auth.role() = 'authenticated');

-- Writes to curriculum/KB only via service role (admin scripts)
create policy subjects_admin_write on subjects for all using (is_admin()) with check (is_admin());
create policy chapters_admin_write on chapters for all using (is_admin()) with check (is_admin());
create policy topics_admin_write   on topics   for all using (is_admin()) with check (is_admin());
create policy documents_admin_write on documents for all using (is_admin()) with check (is_admin());
create policy chunks_admin_write   on chunks   for all using (is_admin()) with check (is_admin());
create policy quizzes_admin_write  on quizzes  for all using (is_admin()) with check (is_admin());
create policy quiz_questions_admin_write on quiz_questions for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- study_plans + items — student owns, parent reads
-- ---------------------------------------------------------------------------
create policy study_plans_rw on study_plans for all
  using (student_id = auth.uid() or student_id = any (linked_student_ids()) or is_admin())
  with check (student_id = auth.uid() or is_admin());

create policy study_plan_items_rw on study_plan_items for all
  using (
    plan_id in (select id from study_plans
                where student_id = auth.uid()
                   or student_id = any (linked_student_ids()))
    or is_admin()
  )
  with check (
    plan_id in (select id from study_plans where student_id = auth.uid())
    or is_admin()
  );

-- ---------------------------------------------------------------------------
-- chat_sessions + messages — student owns, parent reads
-- ---------------------------------------------------------------------------
create policy chat_sessions_rw on chat_sessions for all
  using (student_id = auth.uid() or student_id = any (linked_student_ids()) or is_admin())
  with check (student_id = auth.uid());

create policy chat_messages_rw on chat_messages for all
  using (
    session_id in (
      select id from chat_sessions
      where student_id = auth.uid() or student_id = any (linked_student_ids())
    )
    or is_admin()
  )
  with check (
    session_id in (select id from chat_sessions where student_id = auth.uid())
    or is_admin()
  );

-- ---------------------------------------------------------------------------
-- Quiz attempts/responses — student owns, parent reads
-- ---------------------------------------------------------------------------
create policy quiz_attempts_rw on quiz_attempts for all
  using (student_id = auth.uid() or student_id = any (linked_student_ids()) or is_admin())
  with check (student_id = auth.uid());

create policy quiz_responses_rw on quiz_responses for all
  using (
    attempt_id in (
      select id from quiz_attempts
      where student_id = auth.uid() or student_id = any (linked_student_ids())
    )
    or is_admin()
  )
  with check (
    attempt_id in (select id from quiz_attempts where student_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Daily summaries — student + linked parents read
-- ---------------------------------------------------------------------------
create policy daily_summaries_r on daily_summaries for select
  using (student_id = auth.uid() or student_id = any (linked_student_ids()) or is_admin());
create policy daily_summaries_w on daily_summaries for all
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Outbox — admin only
-- ---------------------------------------------------------------------------
create policy notif_admin on notifications_outbox for all
  using (recipient_profile_id = auth.uid() or is_admin())
  with check (is_admin());
