-- 0014_misconception.sql
-- Phase 9.7 — Misconception tracking.
--
-- Each MCQ distractor can carry a tiny "misconception" tag (e.g. "off_by_one",
-- "sign_error", "subset_vs_proper_subset"). When a student picks a wrong
-- option we snapshot that tag on their attempt row so weak-spots can say
-- "You often confuse subset vs. proper subset" instead of just "you're
-- weak in Sets".
--
-- Schema:
--   attempts.misconception_tag — short slug, nullable.
--   practice_items.payload.misconceptions — jsonb array aligned with options[],
--     but stored inside payload so there's no new column needed.
--
-- Idempotent.

alter table attempts
  add column if not exists misconception_tag text;

create index if not exists attempts_misconception_idx
  on attempts(student_id, misconception_tag)
  where misconception_tag is not null;
