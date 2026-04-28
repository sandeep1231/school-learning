-- ============================================================================
-- 0018: Multi-class subjects support
-- ============================================================================
-- v1 schema had `subjects.code` as a globally-unique column, which prevented
-- one row per (subject, class). This migration relaxes that constraint to
-- a composite unique on (code, class_level, board) so we can have a Class 6
-- MTH row alongside Class 9 MTH, both with their own chapters/topics.
-- ============================================================================

alter table subjects drop constraint if exists subjects_code_key;

-- Composite uniqueness scopes "code is unique" to within (board, class_level).
alter table subjects
  add constraint subjects_code_class_board_key
  unique (code, class_level, board);

-- Index for the lookup pattern used by the ingester:
--   .eq("board", 'BSE_ODISHA').eq("class_level", N)
create index if not exists subjects_board_class_idx
  on subjects (board, class_level);
