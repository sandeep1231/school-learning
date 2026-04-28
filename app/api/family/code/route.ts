import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/family/code — student-only.
 *
 * Returns the invite code for the family this student belongs to. If the
 * student isn't yet in any family, creates one (with a fresh random
 * invite code) and links them as the founding member.
 *
 * Parents and teachers don't generate codes — they consume them via
 * /api/family/join.
 */

function newCode(): string {
  // 8-char base32 (no l/o/0/1 to reduce confusion). Roughly 26^8 ≈ 2e11
  // values — collisions vanishingly rare for our scale.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

export async function GET() {
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

  // Use admin client so we can read/insert into families regardless of
  // RLS. We still scope all writes to the current user's id.
  const admin = createAdminClient();

  // Verify the user is a student.
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "student") {
    return NextResponse.json(
      { error: "only students have invite codes" },
      { status: 403 },
    );
  }

  // Existing membership?
  const { data: membership } = await admin
    .from("family_members")
    .select("family_id, families:family_id ( invite_code )")
    .eq("profile_id", user.id)
    .eq("relation", "student")
    .maybeSingle();

  if (membership) {
    // @ts-expect-error nested select shape
    const code = membership.families?.invite_code as string | undefined;
    if (code) {
      return NextResponse.json({ inviteCode: code });
    }
  }

  // Create a new family + membership.
  let code = newCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: dup } = await admin
      .from("families")
      .select("id")
      .eq("invite_code", code)
      .maybeSingle();
    if (!dup) break;
    code = newCode();
  }

  const { data: fam, error: famErr } = await admin
    .from("families")
    .insert({ invite_code: code, created_by: user.id })
    .select("id, invite_code")
    .single();
  if (famErr || !fam) {
    return NextResponse.json(
      { error: famErr?.message ?? "family_create_failed" },
      { status: 500 },
    );
  }

  const { error: memErr } = await admin.from("family_members").insert({
    family_id: fam.id,
    profile_id: user.id,
    relation: "student",
  });
  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  }

  return NextResponse.json({ inviteCode: fam.invite_code });
}
