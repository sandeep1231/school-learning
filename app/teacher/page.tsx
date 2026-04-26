import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TeacherDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-3xl font-bold text-brand-900">Teacher dashboard</h1>
      <p className="text-slate-600">
        Cohort management, flagged-chat review, and custom practice sets will
        appear here in v1. (Stub)
      </p>
    </main>
  );
}
