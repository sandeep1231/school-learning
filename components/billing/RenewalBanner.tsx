import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/user";
import { tierLabel } from "@/lib/billing/tiers";

/**
 * Server-rendered banner shown across the app when a paid plan is about
 * to expire (≤7 days) or has already expired. Soft nudge only — never
 * blocks the page below it.
 *
 * Hidden for free users, guests, and active plans with >7 days remaining.
 */
export default async function RenewalBanner() {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) return null;
  const { status, daysRemaining, tier } = user.subscription;
  if (status !== "expiring" && status !== "expired") return null;

  const isExpired = status === "expired";
  const renewHref = `/pricing?renew=${tier}`;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full border-b text-sm ${
        isExpired
          ? "border-red-300 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
          : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
      }`}
    >
      <div className="container mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-2">
        <span>
          {isExpired
            ? `Your ${tierLabel(user.subscription)} plan has expired.`
            : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left on your ${tierLabel(user.subscription)} plan.`}
        </span>
        <Link
          href={renewHref}
          className="rounded-md bg-brand px-3 py-1 text-xs font-semibold text-white shadow hover:bg-brand-700"
        >
          {isExpired ? "Renew now" : "Extend plan"}
        </Link>
      </div>
    </div>
  );
}
