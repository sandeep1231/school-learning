-- 0015_lesson_variant_exam.sql
-- Phase 9.12 — add a 4th lesson audience variant: "exam".
--
-- Purpose: BSE Class 9 board-prep angle — expected question patterns,
-- common pitfalls, 3-mark vs 5-mark framing, and mark-scheme pointers.
-- Rendered via the same AudienceToggle + generator as other variants.
--
-- Idempotent.

do $$ begin
  alter type lesson_variant add value if not exists 'exam';
exception when duplicate_object then null; end $$;
