import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/family/join — parent/guardian-only.
 *
 * Body: { inviteCode: string }
 *
 * Looks up the family for the given code and adds the current user as a
 * 'parent' relation. Idempotent: re-joining the same family is a no-op.
 */
export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: { inviteCode?: string };
  try {
    body = (await req.json()) as { inviteCode?: string };
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const code = (body.inviteCode ?? "").trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "missing_code" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "parent" && profile?.role !== "teacher") {
    return NextResponse.json(
      { error: "only_parents_can_join" },
      { status: 403 },
    );
  }

  const { data: family } = await admin
    .from("families")
    .select("id, invite_code")
    .eq("invite_code", code)
    .maybeSingle();
  if (!family) {
    return NextResponse.json({ error: "code_not_found" }, { status: 404 });
  }

  // Already linked? No-op.
  const { data: existing } = await admin
    .from("family_members")
    .select("family_id")
    .eq("family_id", family.id)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, familyId: family.id, alreadyLinked: true });
  }

  const { error } = await admin.from("family_members").insert({
    family_id: family.id,
    profile_id: user.id,
    relation: profile.role === "teacher" ? "guardian" : "parent",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, familyId: family.id });
}
