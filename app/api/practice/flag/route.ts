import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

const BodySchema = z.object({
  itemId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

/**
 * POST /api/practice/flag { itemId, reason }
 * Auth-only. RLS enforces student_id = auth.uid() on insert.
 * Unique(item_id, student_id) means re-flagging updates the existing row via
 * onConflict ignore — a user can flag each item once.
 */
export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  const { itemId, reason } = parsed.data;
  const { error } = await supabase.from("item_flags").insert({
    item_id: itemId,
    student_id: user.id,
    reason,
  });
  if (error && !error.message.includes("duplicate")) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
