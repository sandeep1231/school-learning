import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types";

type EnsureBody = {
  fullName?: string;
  role?: AppRole;
  classLevel?: number;
  preferredLanguage?: "or" | "hi" | "en";
};

const VALID_ROLES: AppRole[] = ["student", "parent", "teacher"];

/**
 * Idempotent: ensures a `profiles` row exists for the current user.
 * Called right after OTP verification / anonymous sign-in.
 *
 * Optional JSON body lets the sign-up flow seed full_name, role,
 * class_level, and preferred_language up front. Missing fields fall back
 * to safe defaults; existing rows are NOT overwritten (insert-only
 * semantics) — except for full_name + role which we'll patch in if the
 * row pre-existed without them.
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
  const requestedRole = body.role ?? (meta.role as AppRole | undefined);
  const role: AppRole = VALID_ROLES.includes(requestedRole as AppRole)
    ? (requestedRole as AppRole)
    : "student";

  // Insert if absent. If a row already exists, refresh role / full_name
  // with the values the user just supplied (signup form is the source of
  // truth for these on first contact).
  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        role,
        full_name: fullName,
        preferred_language: preferredLanguage,
        class_level: classLevel,
      },
      { onConflict: "id", ignoreDuplicates: false },
    );

  if (error) {
    return NextResponse.json(
      { ok: false, reason: "db_error", message: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, userId: user.id, role });
}
