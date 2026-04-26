import Link from "next/link";

export default function SignUpPage() {
  return (
    <main className="container mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-4 text-2xl font-bold text-brand-900">Create account</h1>
      <p className="mb-6 text-sm text-slate-600">
        We use the same phone sign-in for new and returning users. Head to sign-in and
        enter your phone number; we&apos;ll create an account if one doesn&apos;t exist.
      </p>
      <Link
        href="/auth/sign-in"
        className="inline-block rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-700"
      >
        Continue to sign in
      </Link>
    </main>
  );
}
