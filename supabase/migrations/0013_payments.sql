-- 0013_payments.sql
-- Phase 13: UPI QR-code billing (manual verification initial release).
--
-- Sikhya Sathi accepts UPI payments via a generated QR code. Students/parents
-- scan the QR from any UPI app (GPay, PhonePe, Paytm, BHIM), pay into the
-- merchant VPA, and paste the UPI reference/UTR back into the app. An admin
-- reviewer confirms the UTR matches the bank statement and marks the order
-- paid — which promotes the student's profiles.subscription_tier.
--
-- We stay off Razorpay/Stripe so there's no payment-gateway onboarding,
-- zero MDR fees, and no KYC friction during launch. A webhook-based
-- reconciliation can land in a subsequent migration.
--
-- Idempotent.

-- Plan catalogue. Kept as a table (not enum) so pricing can evolve.
create table if not exists billing_plans (
  code          text primary key,
  title_en      text not null,
  title_or      text not null,
  tier          subscription_tier not null,
  amount_inr    integer not null,               -- whole rupees, no paise
  duration_days integer not null,               -- 30, 90, 365, …
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

insert into billing_plans (code, title_en, title_or, tier, amount_inr, duration_days)
values
  ('student_monthly',  'Student — Monthly',  'ଛାତ୍ର — ମାସିକ',      'student', 199, 30),
  ('student_yearly',   'Student — Yearly',   'ଛାତ୍ର — ବାର୍ଷିକ',    'student', 1799, 365),
  ('family_monthly',   'Family — Monthly',   'ପରିବାର — ମାସିକ',     'family',  349, 30),
  ('family_yearly',    'Family — Yearly',    'ପରିବାର — ବାର୍ଷିକ',   'family',  3299, 365)
on conflict (code) do nothing;

-- Order lifecycle.
do $$ begin
  create type payment_status as enum (
    'pending',    -- QR shown, waiting for user to pay + submit UTR
    'submitted',  -- user posted UTR, awaiting admin verification
    'paid',       -- admin confirmed, tier granted
    'failed',     -- admin rejected (wrong UTR / amount mismatch)
    'expired'     -- QR deadline passed without payment
  );
exception when duplicate_object then null; end $$;

create table if not exists payment_orders (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references profiles(id) on delete cascade,
  plan_code       text not null references billing_plans(code),
  amount_inr      integer not null,
  upi_vpa         text not null,                -- snapshot at order time
  upi_payee_name  text not null,
  reference_id    text unique not null,         -- short code we embed in UPI note
  utr             text,                         -- user-supplied after paying
  status          payment_status not null default 'pending',
  verified_by     uuid references profiles(id),
  verified_at     timestamptz,
  rejection_reason text,
  granted_until   timestamptz,                  -- set when status=paid
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '30 minutes'
);

create index if not exists payment_orders_student_idx on payment_orders(student_id, created_at desc);
create index if not exists payment_orders_status_idx  on payment_orders(status, created_at desc);
create index if not exists payment_orders_reference_idx on payment_orders(reference_id);

alter table payment_orders enable row level security;

-- Student reads own orders.
drop policy if exists payment_orders_self_select on payment_orders;
create policy payment_orders_self_select on payment_orders
  for select using (auth.uid() = student_id);

-- Student creates own pending order.
drop policy if exists payment_orders_self_insert on payment_orders;
create policy payment_orders_self_insert on payment_orders
  for insert with check (auth.uid() = student_id);

-- Student updates own order UTR while still pending/submitted.
drop policy if exists payment_orders_self_update on payment_orders;
create policy payment_orders_self_update on payment_orders
  for update using (auth.uid() = student_id and status in ('pending', 'submitted'))
  with check (auth.uid() = student_id);

-- Admin mutations flow through service-role client in API routes.

-- Billing plans readable to everyone.
alter table billing_plans enable row level security;
drop policy if exists billing_plans_public_read on billing_plans;
create policy billing_plans_public_read on billing_plans
  for select using (true);

-- Keep updated_at fresh.
create or replace function touch_payment_orders() returns trigger as $$
begin new.updated_at = now(); return new; end $$ language plpgsql;

drop trigger if exists payment_orders_touch on payment_orders;
create trigger payment_orders_touch
  before update on payment_orders
  for each row execute procedure touch_payment_orders();
