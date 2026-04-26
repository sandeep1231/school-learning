"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";

export default function SignInPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/today";

  const configured = isSupabaseConfigured();
  const supabase = useMemo(
    () => (configured ? createClient() : null),
    [configured],
  );

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) return setError(error.message);
    setStage("otp");
    setInfo(`Check ${email} for a 6-digit code. It expires in a few minutes.`);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });
    setLoading(false);
    if (error) return setError(error.message);
    // Ensure profile row exists (server-side, RLS-safe via upsert helper).
    try {
      await fetch("/api/profile/ensure", { method: "POST" });
    } catch {
      /* non-fatal */
    }
    router.push(next);
    router.refresh();
  }

  async function continueAsGuest() {
    // Guest cookie is already planted by middleware; nothing to do beyond
    // navigation. Progress is stored in-memory keyed to this browser.
    router.push(next);
  }

  async function signInAnon() {
    if (!supabase) return continueAsGuest();
    setLoading(true);
    setError(null);
    // Works only if "Anonymous sign-ins" is enabled in Supabase dashboard.
    // If disabled, we just fall back to the guest-cookie path.
    const { error } = await (supabase.auth as any).signInAnonymously?.() ?? {
      error: { message: "anonymous_unsupported" },
    };
    setLoading(false);
    if (error) return continueAsGuest();
    try {
      await fetch("/api/profile/ensure", { method: "POST" });
    } catch {
      /* non-fatal */
    }
    router.push(next);
    router.refresh();
  }

  return (
    <main className="container mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-2 text-2xl font-bold text-brand-900">
        ସାଇନ୍ ଇନ୍ · Sign in
      </h1>
      <p className="mb-6 text-sm text-slate-600">
        Sign in with email to save progress across devices, or continue as a
        guest — your progress stays on this browser.
      </p>

      {!configured && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Supabase not configured</p>
          <p className="mt-1">
            Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
            <code>.env.local</code> and restart. You can still browse:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/today" className="rounded bg-brand px-3 py-1 text-white">
              Demo: Today
            </Link>
          </div>
        </div>
      )}

      {configured && (
        <>
          <button
            onClick={signInAnon}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-base font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {loading && <Spinner size="sm" className="[&>span:first-child]:border-white/30 [&>span:first-child]:border-t-white" />}
            Continue as guest →
          </button>
          <p className="mt-2 text-center text-xs text-slate-500">
            Free · no email needed · progress saved on this browser
          </p>

          <div className="my-6 flex items-center gap-2 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            <span>or sign in with email (optional)</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
        </>
      )}

      {configured &&
        (stage === "email" ? (
          <form onSubmit={sendOtp} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Email</span>
              <input
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                required
              />
            </label>
            <button
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand-50 disabled:opacity-50"
            >
              {loading && <Spinner size="sm" />}
              {loading ? "Sending…" : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">6-digit code</span>
              <input
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 tracking-widest"
                required
              />
            </label>
            <button
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {loading && <Spinner size="sm" className="[&>span:first-child]:border-white/30 [&>span:first-child]:border-t-white" />}
              {loading ? "Verifying…" : "Verify & sign in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStage("email");
                setOtp("");
                setInfo(null);
              }}
              className="block w-full text-center text-xs text-slate-500 underline"
            >
              Use a different email
            </button>
          </form>
        ))}

      {info && <p className="mt-4 text-sm text-emerald-700">{info}</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </main>
  );
}
