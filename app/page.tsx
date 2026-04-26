import Link from "next/link";
import { getTranslations } from "next-intl/server";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

export default async function HomePage() {
  const t = await getTranslations("app");
  // Phase 15 — JSON-LD for rich results. EducationalOrganization keeps the
  // knowledge-graph panel accurate; WebSite exposes the site-search hint.
  const orgLd = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: "Sikhya Sathi",
    url: BASE_URL,
    logo: `${BASE_URL}/icon-512.png`,
    description:
      "AI home-tutor for BSE Odisha Class 9 students, grounded in the official textbooks.",
    areaServed: { "@type": "AdministrativeArea", name: "Odisha, India" },
    knowsLanguage: ["or", "hi", "en"],
  };
  const siteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Sikhya Sathi",
    url: BASE_URL,
    inLanguage: ["or", "hi", "en"],
  };
  return (
    <main className="container mx-auto max-w-5xl px-6 py-16">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteLd) }}
      />

      {/* Hero */}
      <section className="mx-auto max-w-3xl text-center">
        <p className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-900">
          BSE Odisha · Class 9 · 2025–26 syllabus
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-brand-900 sm:text-5xl">
          {t("name")}
        </h1>
        <p className="mt-4 text-lg text-slate-600">{t("tagline")}</p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/today"
            className="rounded-lg bg-brand px-6 py-3 font-medium text-white shadow hover:bg-brand-700"
          >
            Start learning
          </Link>
          <Link
            href="/auth/sign-in"
            className="rounded-lg border border-brand px-6 py-3 font-medium text-brand hover:bg-brand-50"
          >
            Sign in to save progress
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          Aligned with Board of Secondary Education, Odisha (BSE) Class IX
          syllabus. Answers cite your official textbooks.
        </p>
      </section>

      {/* What you get */}
      <section className="mt-20 grid gap-6 md:grid-cols-3">
        {[
          {
            title: "ଦୈନିକ ପାଠ · Daily lesson",
            body: "An AI-generated explanation in Odia, Hindi, or English, picked to match the next gap in your progress.",
          },
          {
            title: "ଅଭ୍ୟାସ · Practice",
            body: "MCQs, short-answer, and long-answer questions with weighted rubrics and misconception tags.",
          },
          {
            title: "ପୁନଃଦର୍ଶନ · Smart review",
            body: "Spaced-repetition cards surface the concepts you're about to forget — right before your exam.",
          },
          {
            title: "ପାଠ୍ୟପୁସ୍ତକ ସୂତ୍ର · Textbook citations",
            body: "Every explanation references the BSE textbook page you can verify — no hallucinated facts.",
          },
          {
            title: "ବାପାମାଆଙ୍କ ଦୃଶ୍ୟ · Parent view",
            body: "Toggle to a calmer tone with conversation prompts a parent can use to coach at home.",
          },
          {
            title: "ପରୀକ୍ଷା କେନ୍ଦ୍ରିତ · Exam focus",
            body: "A dedicated variant covering likely patterns, common mistakes, and scoring hints for the annual exam.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-base font-semibold text-brand-900">
              {f.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {f.body}
            </p>
          </div>
        ))}
      </section>

      {/* Subjects */}
      <section className="mt-20">
        <h2 className="text-center text-xl font-semibold text-slate-900">
          Six subjects covered
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          Mathematics, Science, English, Odia (FLO), General Science Workbook
          (GSC), Social Science (SSC), Second-Language (SLE), Third-Language
          (TLH) — all aligned to the official BSE Class 9 textbooks.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs">
          {[
            "MTH · ଗଣିତ",
            "SSC · ସାମାଜିକ ବିଜ୍ଞାନ",
            "SCI · ବିଜ୍ଞାନ",
            "FLO · ଓଡ଼ିଆ",
            "SLE · ଇଂରାଜୀ",
            "TLH · ହିନ୍ଦୀ",
          ].map((s) => (
            <span
              key={s}
              className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700"
            >
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="mt-20 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-8 text-center">
        <h2 className="text-xl font-semibold text-brand-900">
          Free to try. Affordable to keep.
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Browse lessons and sample practice questions for free. Unlock daily
          unlimited practice and spaced-review with any paid plan.
        </p>
        <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/pricing"
            className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            See pricing
          </Link>
          <Link
            href="/today"
            className="text-sm font-medium text-brand hover:underline"
          >
            Or jump into today&rsquo;s lesson →
          </Link>
        </div>
      </section>
    </main>
  );
}
