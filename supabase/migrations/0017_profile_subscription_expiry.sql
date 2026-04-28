-- 0017_profile_subscription_expiry.sql
-- Phase 16 — profile-level subscription expiry.
--
-- Until now, a paid plan's expiry lived only on `payment_orders.granted_until`.
-- The app couldn't cheaply ask "is this user's plan still active?" without
-- joining payment_orders. We hoist the latest expiry onto profiles so every
-- request can read it as part of the normal profile fetch.
--
-- Idempotent.

alter table profiles
  add column if not exists granted_until timestamptz;

create index if not exists profiles_granted_until_idx
  on profiles(granted_until);

-- Helper: status string derived from tier + granted_until.
-- Returns one of: 'free' | 'active' | 'expiring' | 'expired'.
create or replace function subscription_status(
  p_tier subscription_tier,
  p_granted_until timestamptz
) returns text language sql stable as $$
  select case
    when p_tier = 'free' or p_granted_until is null then 'free'
    when p_granted_until < now() then 'expired'
    when p_granted_until < now() + interval '7 days' then 'expiring'
    else 'active'
  end;
$$;

-- Helper: integer days remaining (negative if expired).
create or replace function subscription_days_remaining(
  p_granted_until timestamptz
) returns integer language sql stable as $$
  select case
    when p_granted_until is null then null
    else extract(day from (p_granted_until - now()))::int
  end;
$$;
