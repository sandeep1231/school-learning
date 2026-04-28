import Link from "next/link";
import type { SubscriptionInfo } from "@/lib/auth/user";
import { tierLabel } from "@/lib/billing/tiers";

/**
 * Visual subscription summary on /profile. Pure presentation — all state
 * comes from getCurrentUser(). No interactivity beyond the renew CTA.
 */
export default function SubscriptionCard({
  subscription,
}: {
  subscription: SubscriptionInfo;
}) {
  const { tier, grantedUntil, daysRemaining, status } = subscription;
  const isPaid = tier !== "free";
  const expiryStr = grantedUntil
    ? new Date(grantedUntil).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  let body: React.ReactNode;
  if (status === "free") {
    body = (
      <p className="text-sm text-slate-600 dark:text-slate-300">
        You&rsquo;re on the free plan. Upgrade to unlock unlimited practice and
        subject tutors.
      </p>
    );
  } else if (status === "expired") {
    body = (
      <p className="text-sm text-red-700 dark:text-red-300">
        Your {tierLabel(subscription)} plan expired
        {expiryStr ? ` on ${expiryStr}` : ""}. Renew to keep access.
      </p>
    );
  } else if (status === "expiring") {
    body = (
      <p className="text-sm text-amber-800 dark:text-amber-200">
        {daysRemaining} day{daysRemaining === 1 ? "" : "s"} remaining — renews
        on {expiryStr}.
      </p>
    );
  } else {
    body = (
      <p className="text-sm text-emerald-800 dark:text-emerald-200">
        Active until {expiryStr}
        {daysRemaining !== null
          ? ` · ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`
          : ""}
        .
      </p>
    );
  }

  const ctaHref = isPaid ? `/pricing?renew=${tier}` : "/pricing";
  const ctaLabel = isPaid
    ? status === "expired"
      ? "Renew now"
      : "Extend plan"
    : "See plans";

  return (
    <section
      aria-labelledby="subscription-heading"
      className={`rounded-lg border p-5 ${
        status === "expired"
          ? "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
          : status === "expiring"
            ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30"
            : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="subscription-heading"
            className="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            Subscription
          </h2>
          <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-500">
            {tierLabel(subscription)} plan
          </p>
        </div>
        <Link
          href={ctaHref}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-brand-700"
        >
          {ctaLabel}
        </Link>
      </div>
      <div className="mt-3">{body}</div>
    </section>
  );
}
