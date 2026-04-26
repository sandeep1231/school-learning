-- 0011_subscription_tier.sql
-- Phase 6: Monetisation schema (design-only — no enforcement yet).
--
-- Adds a `subscription_tier` enum + column on `profiles` so we can collect
-- data, build UX around tier, and ship gating in a later release without
-- another schema change. Default is 'free'; existing rows inherit it.
--
-- Tiers (see plan.md §6):
--   free     — core learn + ask, capped practice.
--   student  — unlimited practice + parent mode.
--   family   — up to 4 linked students.
--   school   — bulk licensing, admin dashboards.
--
-- Idempotent.

do $$ begin
  create type subscription_tier as enum ('free', 'student', 'family', 'school');
exception when duplicate_object then null; end $$;

alter table profiles
  add column if not exists subscription_tier subscription_tier not null default 'free';

create index if not exists profiles_subscription_tier_idx
  on profiles(subscription_tier);

-- No RLS changes: subscription_tier is readable via the existing profile
-- owner policy. Gating lives in app code (see lib/billing/tiers.ts when
-- enforcement begins).
