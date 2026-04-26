/**
 * Phase 13 — billing plan helpers (server-only DB reads).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type SubscriptionTier = "free" | "student" | "family" | "school";

export interface BillingPlan {
  code: string;
  titleEn: string;
  titleOr: string;
  tier: SubscriptionTier;
  amountInr: number;
  durationDays: number;
  active: boolean;
}

export async function listActivePlans(
  admin: SupabaseClient,
): Promise<BillingPlan[]> {
  const { data, error } = await admin
    .from("billing_plans")
    .select("code, title_en, title_or, tier, amount_inr, duration_days, active")
    .eq("active", true)
    .order("amount_inr", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    code: r.code,
    titleEn: r.title_en,
    titleOr: r.title_or,
    tier: r.tier,
    amountInr: r.amount_inr,
    durationDays: r.duration_days,
    active: r.active,
  }));
}

export async function getPlan(
  admin: SupabaseClient,
  code: string,
): Promise<BillingPlan | null> {
  const { data } = await admin
    .from("billing_plans")
    .select("code, title_en, title_or, tier, amount_inr, duration_days, active")
    .eq("code", code)
    .maybeSingle();
  if (!data) return null;
  return {
    code: data.code,
    titleEn: data.title_en,
    titleOr: data.title_or,
    tier: data.tier,
    amountInr: data.amount_inr,
    durationDays: data.duration_days,
    active: data.active,
  };
}
