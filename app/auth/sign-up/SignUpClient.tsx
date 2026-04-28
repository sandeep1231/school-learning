"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

/**
 * Sign-up flow.
 *
 * 1) Collect email, full name, class, preferred language.
 * 2) Call supabase.auth.signInWithOtp({ shouldCreateUser: true,
 *    options.data = profileFields, emailRedirectTo: /auth/callback }).
 *    Supabase stamps the metadata on the new auth.users row.
 * 3) Show OTP input. On verify, POST /api/profile/ensure with the
 *    profile fields so the row is created with the right class/language
 *    even before the user opens the magic link in another tab.
 *
 * If Supabase template sends a magic link instead of a code, the click
 * goes to /auth/callback which exchanges the code for a session and
 * upserts the profile row via user_metadata.
 */
export default function SignUpClient() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/welcome";

  const configured = isSupabaseConfigured();
  const supabase = useMemo(
    () => (configured ? createClient() : null),
    [configured],
  );

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"student" | "parent">("student");
  const [classLevel, setClassLevel] = useState<number>(9);
  const [language, setLanguage] = useState<"or" | "hi" | "en">("or");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"form" | "otp">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") ?? null,
  );
  const [info, setInfo] = useState<string | null>(null);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: redirectTo,
        data: {
          full_name: fullName,
          role,
          class_level: classLevel,
          preferred_language: language,
        },
      },
    });
    setLoading(false);
    if (error) return setError(error.message);
    setStage("otp");
    setInfo(`Check ${email} for a verification code or click the magic link.`);
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });
    if (error) {
      setLoading(false);
      return setError(error.message);
    }
    // Persist profile fields server-side. Failure here is non-fatal —
    // /auth/callback or first /today render will retry the upsert.
    try {
      await fetch("/api/profile/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          role,
          classLevel,
          preferredLanguage: language,
        }),
      });
    } catch {
      /* non-fatal */
    }
    router.replace(role === "parent" ? "/parent" : next);
  }

  if (!configured) {
    return (
      <p className="text-sm text-slate-600">
        Sign-up is unavailable in this environment.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {info && (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {info}
        </p>
      )}
      {stage === "form" ? (
        <form onSubmit={sendOtp} className="space-y-4">
          <fieldset>
            <legend className="mb-1 block text-sm font-medium">
              I am a&hellip;
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { v: "student" as const, label: "Student" },
                  { v: "parent" as const, label: "Parent" },
                ]
              ).map((opt) => (
                <label
                  key={opt.v}
                  className={`cursor-pointer rounded-md border px-3 py-2 text-sm font-medium ${
                    role === opt.v
                      ? "border-brand bg-brand-50 text-brand-900"
                      : "border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={opt.v}
                    checked={role === opt.v}
                    onChange={() => setRole(opt.v)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Full name</span>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            {role === "student" ? (
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Class</span>
                <select
                  value={classLevel}
                  onChange={(e) => setClassLevel(Number(e.target.value))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                >
                  {[6, 7, 8, 9, 10, 11, 12].map((c) => (
                    <option key={c} value={c}>
                      Class {c}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div />
            )}
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Language</span>
              <select
                value={language}
                onChange={(e) =>
                  setLanguage(e.target.value as "or" | "hi" | "en")
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="or">Odia</option>
                <option value="hi">Hindi</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send verification code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Verification code</span>
            <input
              required
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 tracking-widest"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Verify and continue"}
          </button>
          <button
            type="button"
            onClick={() => setStage("form")}
            className="w-full text-xs text-slate-500 hover:underline"
          >
            Use a different email
          </button>
        </form>
      )}
      <p className="text-xs text-slate-500">
        Already have an account?{" "}
        <Link href="/auth/sign-in" className="text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
