import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Idempotent: ensures a `profiles` row exists for the current user.
 * Called right after OTP verification / anonymous sign-in.
 */
export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "not_configured" });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "no_session" }, { status: 401 });
  }

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.email ? user.email.split("@")[0] : null);

  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        role: "student",
        full_name: fullName,
        preferred_language: "or",
      },
      { onConflict: "id", ignoreDuplicates: false },
    );

  if (error) {
    return NextResponse.json(
      { ok: false, reason: "db_error", message: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, userId: user.id });
}
