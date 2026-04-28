import Link from "next/link";

/**
 * Phase 15 — site footer with legal links. Mounted in app/layout.tsx.
 * Kept compact and server-side so it doesn't bloat the initial JS bundle.
 */
export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white/60 py-6 text-xs text-slate-500">
      <div className="container mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 sm:flex-row">
        <p>© {year} Sikhya Sathi. Aligned to the BSE Odisha Class 6–9 syllabus.</p>
        <nav aria-label="Legal" className="flex flex-wrap items-center gap-4">
          <Link href="/legal/privacy" className="hover:text-brand">
            Privacy
          </Link>
          <Link href="/legal/terms" className="hover:text-brand">
            Terms
          </Link>
          <Link href="/legal/refund" className="hover:text-brand">
            Refunds
          </Link>
          <Link href="/pricing" className="hover:text-brand">
            Pricing
          </Link>
        </nav>
      </div>
    </footer>
  );
}
