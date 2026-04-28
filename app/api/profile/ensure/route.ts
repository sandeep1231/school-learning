import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

type EnsureBody = {
  fullName?: string;
  classLevel?: number;
  preferredLanguage?: "or" | "hi" | "en";
};

/**
 * Idempotent: ensures a `profiles` row exists for the current user.
 * Called right after OTP verification / anonymous sign-in.
 *
 * Optional JSON body lets the sign-up flow seed full_name, class_level,
 * and preferred_language up front. Missing fields fall back to safe
 * defaults; existing rows are NOT overwritten (insert-only semantics).
 */
export async function POST(req: Request) {
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

  let body: EnsureBody = {};
  try {
    if (req.headers.get("content-length") !== "0") {
      body = (await req.json()) as EnsureBody;
    }
  } catch {
    /* empty / non-JSON body is fine */
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName =
    body.fullName ??
    (meta.full_name as string | undefined) ??
    (user.email ? user.email.split("@")[0] : null);
  const preferredLanguage =
    body.preferredLanguage ??
    (meta.preferred_language as "or" | "hi" | "en" | undefined) ??
    "or";
  const classLevel =
    body.classLevel ?? (meta.class_level as number | undefined) ?? 9;

  // Insert-only on first-touch; subsequent calls only refresh updated_at
  // via onConflict update of the same values to keep this idempotent.
  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        role: "student",
        full_name: fullName,
        preferred_language: preferredLanguage,
        class_level: classLevel,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );

  if (error) {
    return NextResponse.json(
      { ok: false, reason: "db_error", message: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, userId: user.id });
}
