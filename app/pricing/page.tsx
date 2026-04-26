/**
 * Phase 13 — /pricing. Public plan catalogue with "Subscribe" CTA.
 *
 * Server component reads active billing plans, renders a grid of tiers.
 * Signed-in students get a direct "Subscribe" button; guests are routed
 * through sign-in first. Actual QR payment happens on /checkout/[orderId].
 */
import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { listActivePlans } from "@/lib/billing/plans";
import { getCurrentUser } from "@/lib/auth/user";
import { billingConfigured } from "@/lib/billing/config";
import { SubscribeButton } from "./SubscribeButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Affordable monthly and annual plans for Sikhya Sathi — the BSE Odisha Class 9 AI tutor. Pay with UPI in seconds.",
  openGraph: {
    title: "Sikhya Sathi · Pricing",
    description:
      "Plans for BSE Class 9 students. UPI payments. Cancel anytime.",
  },
};

export default async function PricingPage() {
  const admin = createAdminClient();
  const [plans, user] = await Promise.all([
    listActivePlans(admin),
    getCurrentUser(),
  ]);
  const configured = billingConfigured();

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold">Pricing</h1>
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
          Sikhya Sathi is free to try. Upgrade when you're ready for unlimited
          practice, parent mode, and priority tutor responses.
        </p>
        {!configured && (
          <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            Billing is not yet configured on this deployment. Set{" "}
            <code>UPI_VPA</code> and <code>UPI_PAYEE_NAME</code> to enable
            checkout.
          </p>
        )}
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        {/* Free tier, hard-coded. */}
        <div className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">Free</h2>
          <p className="mt-1 text-sm text-neutral-500">Everyone starts here</p>
          <div className="mt-4 text-3xl font-bold">₹0</div>
          <ul className="mt-6 space-y-2 text-sm">
            <li>✓ All lessons + Q&amp;A tutor</li>
            <li>✓ 5 practice questions/day</li>
            <li>✓ Offline-ready PWA</li>
          </ul>
          <button
            disabled
            className="mt-8 w-full rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-500"
          >
            Current plan
          </button>
        </div>

        {plans.map((plan) => (
          <div
            key={plan.code}
            className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-b from-indigo-50 to-white p-6 dark:border-indigo-900 dark:from-indigo-950/40 dark:to-transparent"
          >
            <h2 className="text-lg font-semibold">{plan.titleEn}</h2>
            <p className="mt-1 text-sm text-neutral-500">{plan.titleOr}</p>
            <div className="mt-4 text-3xl font-bold">
              ₹{plan.amountInr.toLocaleString("en-IN")}
              <span className="ml-1 text-sm font-normal text-neutral-500">
                / {plan.durationDays}d
              </span>
            </div>
            <ul className="mt-6 space-y-2 text-sm">
              {plan.tier === "student" ? (
                <>
                  <li>✓ Unlimited practice</li>
                  <li>✓ Parent mode + daily digest</li>
                  <li>✓ SRS review across all subjects</li>
                </>
              ) : (
                <>
                  <li>✓ Everything in Student</li>
                  <li>✓ Up to 4 student profiles</li>
                  <li>✓ Family dashboard</li>
                </>
              )}
            </ul>
            <div className="mt-8">
              {user.isAuthenticated ? (
                <SubscribeButton
                  planCode={plan.code}
                  disabled={!configured}
                />
              ) : (
                <Link
                  href={`/auth/sign-in?redirect=/pricing`}
                  className="block w-full rounded-md bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-indigo-500"
                >
                  Sign in to subscribe
                </Link>
              )}
            </div>
          </div>
        ))}
      </section>

      <p className="mt-10 text-center text-xs text-neutral-500">
        Payments via UPI — supported by GPay, PhonePe, Paytm, BHIM, and every
        Indian bank app. No card required.
      </p>
    </main>
  );
}
