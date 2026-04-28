import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { tierLabel } from "@/lib/billing/tiers";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import SubscriptionCard from "./SubscriptionCard";
import PaymentHistory from "./PaymentHistory";
import FamilyInviteCard from "./FamilyInviteCard";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your Sikhya Sathi profile, subscription, and payment history.",
};

type PaymentRow = {
  id: string;
  plan_code: string;
  amount_inr: number | null;
  status: string;
  utr: string | null;
  reference_id: string | null;
  granted_until: string | null;
  created_at: string;
};

async function loadPayments(userId: string): Promise<PaymentRow[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("payment_orders")
    .select(
      "id, plan_code, amount_inr, status, utr, reference_id, granted_until, created_at",
    )
    .eq("student_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return (data ?? []) as PaymentRow[];
}

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    redirect("/auth/sign-in?next=/profile");
  }
  const payments = await loadPayments(user.id);

  return (
    <main className="container mx-auto max-w-3xl space-y-8 px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-brand-900">
          Your Profile
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {user.fullName ?? "Student"} · {user.email ?? "no email on file"}
        </p>
        <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
          Role: {user.role}
        </p>
      </header>

      <SubscriptionCard subscription={user.subscription} />

      {user.role === "student" && <FamilyInviteCard />}

      <section
        aria-labelledby="payments-heading"
        className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between">
          <h2
            id="payments-heading"
            className="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            Payment history
          </h2>
          <Link
            href="/pricing"
            className="text-xs font-medium text-brand hover:underline"
          >
            View plans
          </Link>
        </div>
        <PaymentHistory payments={payments} />
      </section>

      <footer className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/settings"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Account settings
        </Link>
        <span
          aria-label={`Current tier ${tierLabel(user.subscription)}`}
          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          Tier: {tierLabel(user.subscription)}
        </span>
      </footer>
    </main>
  );
}
