import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/user";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Phase 15 — DPDP Act 2023 §12 right-to-erasure endpoint.
 *
 * POST /api/profile/delete
 * Body: { confirm: "DELETE" }
 *
 * Deletes the signed-in user's attempts, SRS cards, progress rollups,
 * payment orders, profile row, then the auth.users row. Idempotent: any
 * table the user has no rows in is simply skipped. Guest (cookie-only)
 * sessions have nothing server-side to delete — 204.
 */
export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "supabase_not_configured" },
      { status: 503 },
    );
  }

  let body: { confirm?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (body.confirm !== "DELETE") {
    return NextResponse.json(
      { error: "confirm_required", hint: "body must include confirm:'DELETE'" },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return new NextResponse(null, { status: 204 });
  }

  const admin = createAdminClient();
  const uid = user.id;
  const errors: string[] = [];

  // Tables keyed by user_id. Order: leaf → root.
  const userScoped = [
    "attempts",
    "srs_cards",
    "topic_progress",
    "quiz_attempts",
    "payment_orders",
  ] as const;
  for (const table of userScoped) {
    const { error } = await admin.from(table).delete().eq("user_id", uid);
    if (error && !/column .* does not exist/i.test(error.message)) {
      errors.push(`${table}: ${error.message}`);
    }
  }

  // profiles is keyed by id=auth.users.id
  const { error: profileErr } = await admin
    .from("profiles")
    .delete()
    .eq("id", uid);
  if (profileErr) errors.push(`profiles: ${profileErr.message}`);

  // Finally the auth row itself (uses the service role).
  const { error: authErr } = await admin.auth.admin.deleteUser(uid);
  if (authErr) errors.push(`auth.users: ${authErr.message}`);

  if (errors.length > 0) {
    return NextResponse.json(
      { ok: false, errors },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
