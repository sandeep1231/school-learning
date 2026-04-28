import { cookies } from "next/headers";
import { cache } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { SubscriptionTier } from "@/lib/billing/plans";

export const GUEST_COOKIE = "sikhya_guest_id";

export type SubscriptionStatus = "free" | "active" | "expiring" | "expired";

export type SubscriptionInfo = {
  tier: SubscriptionTier;
  /** ISO timestamp of plan expiry, or null for free / never paid. */
  grantedUntil: string | null;
  /** Whole-day count until expiry; null on free, negative if expired. */
  daysRemaining: number | null;
  status: SubscriptionStatus;
};

export type CurrentUser = {
  /** Unique stable id (Supabase uuid or guest cookie value). */
  id: string;
  /** True if the id comes from a real Supabase auth.users row. */
  isAuthenticated: boolean;
  /** Profile metadata if logged in. */
  email?: string | null;
  fullName?: string | null;
  /** Subscription snapshot (always present). Free for guests / no plan. */
  subscription: SubscriptionInfo;
};

const FREE_SUBSCRIPTION: SubscriptionInfo = {
  tier: "free",
  grantedUntil: null,
  daysRemaining: null,
  status: "free",
};

function deriveStatus(
  tier: SubscriptionTier,
  grantedUntil: string | null,
): SubscriptionInfo {
  if (tier === "free" || !grantedUntil) return FREE_SUBSCRIPTION;
  const expiryMs = new Date(grantedUntil).getTime();
  const diffMs = expiryMs - Date.now();
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  let status: SubscriptionStatus;
  if (diffMs <= 0) status = "expired";
  else if (diffMs < 7 * 24 * 60 * 60 * 1000) status = "expiring";
  else status = "active";
  return { tier, grantedUntil, daysRemaining: days, status };
}

/**
 * Returns the current student identity, including their subscription
 * snapshot. Memoised per request via React `cache()` so multiple server
 * components in the same render don't issue duplicate Supabase reads.
 *
 * Order of preference:
 *   1. Supabase session (email OTP / magic link / anonymous).
 *   2. Guest cookie planted by middleware — used as in-memory progress key.
 *
 * Callers that need DB persistence should check `isAuthenticated`.
 */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, subscription_tier, granted_until")
          .eq("id", user.id)
          .maybeSingle();
        const tier = (profile?.subscription_tier as SubscriptionTier) ?? "free";
        const grantedUntil =
          (profile?.granted_until as string | null) ?? null;
        return {
          id: user.id,
          isAuthenticated: true,
          email: user.email ?? null,
          fullName:
            (profile?.full_name as string | null) ??
            (user.user_metadata?.full_name as string | undefined) ??
            null,
          subscription: deriveStatus(tier, grantedUntil),
        };
      }
    } catch {
      // fall through to guest
    }
  }
  const jar = await cookies();
  const guest = jar.get(GUEST_COOKIE)?.value;
  return {
    id: guest ?? "demo-student",
    isAuthenticated: false,
    subscription: FREE_SUBSCRIPTION,
  };
});
