import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { GUEST_COOKIE } from "@/lib/auth/user";

/**
 * POST /api/auth/sign-out — server-side sign-out.
 *
 * Calls supabase.auth.signOut() (which clears the auth cookies via the
 * SSR client's setAll hook) and also wipes the guest cookie so the user
 * starts fresh next visit. Idempotent: returns 200 even when there's no
 * session.
 */
export async function POST() {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {
      /* non-fatal — proceed to clear cookies */
    }
  }
  const res = NextResponse.json({ ok: true });
  // Best-effort: clear the guest cookie too so a fresh anonymous session
  // is minted on the next request.
  res.cookies.set({
    name: GUEST_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });
  return res;
}
