import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/user";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Phase 15 — DPDP Act 2023 §11 right-to-access.
 *
 * GET /api/profile/export
 *
 * Returns a single JSON document containing all user-scoped rows the
 * signed-in user can ask us to forget. Served as an attachment so the
 * browser downloads it directly. Guests (cookie-only) get 204 — nothing
 * persisted server-side.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "supabase_not_configured" },
      { status: 503 },
    );
  }
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return new NextResponse(null, { status: 204 });
  }
  const admin = createAdminClient();
  const uid = user.id;

  async function fetchAll(table: string, keyCol = "user_id") {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .eq(keyCol, uid);
    if (error && !/does not exist/i.test(error.message)) {
      return { error: error.message };
    }
    return { rows: data ?? [] };
  }

  const [profile, attempts, srs, progress, quizzes, payments, feedback] =
    await Promise.all([
      fetchAll("profiles", "id"),
      fetchAll("attempts"),
      fetchAll("srs_cards"),
      fetchAll("topic_progress"),
      fetchAll("quiz_attempts"),
      fetchAll("payment_orders"),
      fetchAll("content_feedback"),
    ]);

  const payload = {
    generatedAt: new Date().toISOString(),
    user: {
      id: uid,
      email: user.email ?? null,
      fullName: user.fullName ?? null,
    },
    data: {
      profile,
      attempts,
      srs_cards: srs,
      topic_progress: progress,
      quiz_attempts: quizzes,
      payment_orders: payments,
      content_feedback: feedback,
    },
    note: "This export contains all personal data Sikhya Sathi stores for your account. Keep this file safe.",
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="sikhya-sathi-export-${uid.slice(0, 8)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
