/**
 * Pure helpers around a {@link CurrentUser}'s subscription snapshot.
 * No DB access — operate on the value already attached by getCurrentUser.
 *
 * Per product decision (Phase 16): subscription state is always *informational*.
 * These helpers expose status; UI components decide whether to nudge,
 * gate softly, or ignore. Nothing in here should ever throw or redirect.
 */
import type { CurrentUser, SubscriptionInfo } from "@/lib/auth/user";
import type { SubscriptionTier } from "@/lib/billing/plans";

/** True if the plan has not yet expired (free counts as inactive paid). */
export function isActive(user: CurrentUser): boolean {
  const s = user.subscription;
  return s.status === "active" || s.status === "expiring";
}

/** Days until expiry; null for free / never paid. Negative when expired. */
export function daysUntilExpiry(user: CurrentUser): number | null {
  return user.subscription.daysRemaining;
}

/** Within `withinDays` of expiry (default 7). False when free or already expired. */
export function isExpiring(user: CurrentUser, withinDays = 7): boolean {
  const s = user.subscription;
  if (s.status === "free" || s.status === "expired") return false;
  return s.daysRemaining !== null && s.daysRemaining <= withinDays;
}

/** True once the granted_until timestamp has passed. */
export function isExpired(user: CurrentUser): boolean {
  return user.subscription.status === "expired";
}

/**
 * Map of feature → tiers that include it. Soft gate uses this to prompt
 * upgrade copy; the gate itself never blocks rendering.
 */
const FEATURE_TIERS: Record<string, SubscriptionTier[]> = {
  // Core learn / practice / ask remain free forever.
  "practice.unlimited": ["student", "family", "school"],
  "tutor.subjects": ["student", "family", "school"],
  "parent.mode": ["student", "family", "school"],
  "family.linked": ["family", "school"],
  "school.admin": ["school"],
};

/** True if the feature is gated above the user's tier OR plan expired. */
export function requiresUpgrade(
  feature: string,
  user: CurrentUser,
): boolean {
  const allowedTiers = FEATURE_TIERS[feature];
  if (!allowedTiers) return false; // unknown features are always free.
  if (!isActive(user)) return true;
  return !allowedTiers.includes(user.subscription.tier);
}

/** Convenience for UIs that want to label the snapshot. */
export function tierLabel(s: SubscriptionInfo): string {
  switch (s.tier) {
    case "student":
      return "Student";
    case "family":
      return "Family";
    case "school":
      return "School";
    default:
      return "Free";
  }
}
