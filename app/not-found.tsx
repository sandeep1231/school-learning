import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="container mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 py-12 text-center"
      role="alert"
      aria-live="polite"
    >
      <p className="text-5xl" aria-hidden="true">
        🔎
      </p>
      <h1 className="text-2xl font-bold text-slate-900">
        ପୃଷ୍ଠା ମିଳିଲା ନାହିଁ
      </h1>
      <p className="text-sm text-slate-600">
        Page not found — the link may be broken or the topic not published yet.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/today"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Go to Today
        </Link>
        <Link
          href="/"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
