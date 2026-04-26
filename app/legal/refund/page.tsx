import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "Refund terms for Sikhya Sathi subscriptions.",
};

/**
 * Phase 15 — /legal/refund
 *
 * Required by most UPI PSPs before a live merchant VPA is approved.
 */
export default function RefundPage() {
  const updated = "24 April 2026";
  return (
    <main className="container mx-auto max-w-3xl px-6 py-12 text-slate-700">
      <h1 className="text-3xl font-bold tracking-tight text-brand-900">
        Refund Policy
      </h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: {updated}</p>

      <section className="prose prose-slate mt-8 max-w-none">
        <h2>Summary</h2>
        <p>
          We want Sikhya Sathi to be worth your money. If it isn&rsquo;t, you
          can request a refund within <strong>7 days</strong> of your first
          payment on a plan, no questions asked.
        </p>

        <h2>Eligibility</h2>
        <ul>
          <li>
            Full refund within 7 days of the first payment for a given plan.
          </li>
          <li>
            After 7 days, refunds are not available, but you can cancel to
            stop future renewals. (Today we do not auto-renew — plans simply
            expire.)
          </li>
          <li>
            Annual plans that are terminated by us without fault of the user
            are refunded pro-rata for the unused months.
          </li>
        </ul>

        <h2>How to request</h2>
        <ol>
          <li>
            Email{" "}
            <a href="mailto:support@sikhyasathi.app">
              support@sikhyasathi.app
            </a>{" "}
            from the email on your account.
          </li>
          <li>Include your UPI transaction reference (UTR) and plan name.</li>
          <li>
            We respond within 2 business days and, when approved, transfer
            back to the same UPI account within 5–7 business days.
          </li>
        </ol>

        <h2>Non-refundable</h2>
        <ul>
          <li>
            Accounts suspended for violating the{" "}
            <a href="/legal/terms">Terms of Service</a>.
          </li>
          <li>Requests made more than 7 days after first payment.</li>
        </ul>

        <h2>Contact</h2>
        <p>
          Billing queries:{" "}
          <a href="mailto:billing@sikhyasathi.app">billing@sikhyasathi.app</a>
        </p>
      </section>
    </main>
  );
}
