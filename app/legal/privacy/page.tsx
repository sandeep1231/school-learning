import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Sikhya Sathi collects, uses, and protects personal information of students, parents, and teachers.",
};

/**
 * Phase 15 — /legal/privacy
 *
 * Launch-gating for UPI payment partners + India DPDP Act 2023 compliance.
 * Plain-English; the authoritative version lives in docs/legal/privacy.md
 * once the company formalises terms with counsel.
 */
export default function PrivacyPage() {
  const updated = "24 April 2026";
  return (
    <main className="container mx-auto max-w-3xl px-6 py-12 text-slate-700">
      <h1 className="text-3xl font-bold tracking-tight text-brand-900">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: {updated}</p>

      <section className="prose prose-slate mt-8 max-w-none">
        <h2>1. What we collect</h2>
        <ul>
          <li>
            <strong>Account data</strong>: email address, display name, board
            &amp; class selection.
          </li>
          <li>
            <strong>Learning activity</strong>: lessons viewed, practice
            attempts, scores, spaced-repetition card state.
          </li>
          <li>
            <strong>Payment data</strong>: UPI transaction reference (UTR) and
            plan purchased. We do <em>not</em> store your UPI PIN, bank account
            number, or card details — those are handled by your UPI app.
          </li>
          <li>
            <strong>Device &amp; usage</strong>: anonymous analytics (page
            views, errors) via PostHog and Sentry.
          </li>
        </ul>

        <h2>2. How we use it</h2>
        <ul>
          <li>To deliver lessons, practice, and personalised review schedules.</li>
          <li>To verify UPI payments against your account.</li>
          <li>To diagnose bugs and improve the product.</li>
          <li>
            To communicate service notices (exam reminders, payment receipts).
          </li>
        </ul>
        <p>
          We do <strong>not</strong> sell your data, show third-party ads, or
          share personal information with advertisers.
        </p>

        <h2>3. Children&rsquo;s data</h2>
        <p>
          Sikhya Sathi is built for Class 9 students. If the student is under
          18, a parent or guardian should create the account and oversee its
          use. We collect only data necessary for learning and never profile
          children for advertising.
        </p>

        <h2>4. Where data is stored</h2>
        <p>
          Account and learning data are stored on Supabase (Postgres) with
          row-level security. Analytics are stored with PostHog and Sentry.
          Servers are region-pinned wherever supported by our providers.
        </p>

        <h2>5. Your rights under the DPDP Act 2023</h2>
        <ul>
          <li>Right to access a copy of your data.</li>
          <li>Right to correct or update your data.</li>
          <li>Right to erase your account and associated data.</li>
          <li>Right to withdraw consent at any time.</li>
          <li>Right to nominate someone to act on your behalf.</li>
        </ul>
        <p>
          To exercise any of these rights, email{" "}
          <a href="mailto:support@sikhyasathi.app">support@sikhyasathi.app</a>.
          We aim to respond within 30 days.
        </p>

        <h2>6. Cookies &amp; local storage</h2>
        <p>
          We use a small number of first-party cookies to keep you signed in,
          remember your audience preference (textbook / simpler / parent /
          exam), and cache offline content in your browser. You can clear
          these at any time from your browser settings.
        </p>

        <h2>7. Changes</h2>
        <p>
          When this policy changes we update the &ldquo;Last updated&rdquo;
          date above. Material changes will be flagged in-app before they take
          effect.
        </p>

        <h2>8. Contact</h2>
        <p>
          Data Protection queries:{" "}
          <a href="mailto:privacy@sikhyasathi.app">privacy@sikhyasathi.app</a>
        </p>
      </section>
    </main>
  );
}
