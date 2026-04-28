import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/user";

export const metadata: Metadata = {
  title: "Welcome",
  description: "Get started with Sikhya Sathi.",
};

export default async function WelcomePage() {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    redirect("/auth/sign-in?next=/welcome");
  }
  return (
    <main className="container mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold text-brand-900">
        Welcome{user.fullName ? `, ${user.fullName}` : ""}!
      </h1>
      <p className="mt-3 text-slate-700 dark:text-slate-300">
        Your account is ready. Here&rsquo;s how Sikhya Sathi works:
      </p>
      <ul className="mt-6 space-y-3 text-slate-700 dark:text-slate-300">
        <li>
          <strong>Today</strong> — your daily plan with one short lesson and a
          practice set.
        </li>
        <li>
          <strong>Review</strong> — quick spaced-repetition recap of recent
          topics.
        </li>
        <li>
          <strong>Ask</strong> — chat with the tutor on any topic from your
          syllabus.
        </li>
      </ul>
      <div className="mt-8 flex gap-3">
        <Link
          href="/today"
          className="rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-700"
        >
          Start today&rsquo;s plan
        </Link>
        <Link
          href="/profile"
          className="rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          View profile
        </Link>
      </div>
    </main>
  );
}
