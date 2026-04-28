/**
 * GET /auth/callback — handles email magic-link redirects.
 *
 * Supabase email templates that use {{ .ConfirmationURL }} send the user
 * back to this route with a `?code=...` (PKCE) or a `?token_hash=...`
 * (legacy email link) query param. We exchange that for a session here
 * server-side so the auth cookie is set before any RSC reads it.
 *
 * If the user used the 6-digit OTP form on the sign-in page instead, they
 * never hit this route — that path verifies on the client and is handled
 * separately. Both paths converge at /api/profile/ensure to seed the
 * profiles row.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type"); // "magiclink" | "signup" | "recovery" | "email"
  const next = url.searchParams.get("next") || "/today";
  const errorParam = url.searchParams.get("error_description");

  // Redirect helper that preserves the current host.
  const redirect = (path: string) =>
    NextResponse.redirect(new URL(path, url.origin));

  if (errorParam) {
    return redirect(
      `/auth/sign-in?error=${encodeURIComponent(errorParam)}`,
    );
  }
  if (!isSupabaseConfigured()) {
    return redirect("/auth/sign-in?error=not_configured");
  }
  if (!code && !tokenHash) {
    return redirect("/auth/sign-in?error=missing_code");
  }

  const supabase = await createClient();

  // PKCE flow: ?code=…
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return redirect(
        `/auth/sign-in?error=${encodeURIComponent(error.message)}`,
      );
    }
  }
  // Legacy email-link flow: ?token_hash=…&type=…
  else if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      type: (type as "magiclink" | "signup" | "recovery" | "email") ?? "email",
      token_hash: tokenHash,
    });
    if (error) {
      return redirect(
        `/auth/sign-in?error=${encodeURIComponent(error.message)}`,
      );
    }
  }

  // Best-effort: ensure a profiles row exists so subsequent server reads
  // (subscription tier, etc.) don't 404 on first sign-in. The /api/profile
  // /ensure endpoint already handles this idempotently; we inline it here
  // to avoid an extra round trip.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const fullName =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.email ? user.email.split("@")[0] : null);
    await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          role: "student",
          full_name: fullName,
          preferred_language: "or",
        },
        { onConflict: "id", ignoreDuplicates: true },
      );
  }

  return redirect(next);
}
