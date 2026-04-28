"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Parent-side invite-code entry. POSTs to /api/family/join then refreshes
 * the dashboard so RLS-scoped child queries pick up the new linkage.
 */
export default function FamilyJoinForm() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/family/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code.trim().toUpperCase() }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        alreadyLinked?: boolean;
      };
      if (!res.ok || !data.ok) {
        setErr(data.error ?? "Could not link student.");
        return;
      }
      setMsg(
        data.alreadyLinked
          ? "Already linked to that family."
          : "Linked! Refreshing…",
      );
      setCode("");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Student invite code</span>
        <input
          required
          value={code}
          onChange={(e) =>
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
          }
          maxLength={12}
          placeholder="ABCD2345"
          className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono tracking-widest"
        />
      </label>
      <button
        type="submit"
        disabled={busy || code.length < 6}
        className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? "Linking…" : "Link student"}
      </button>
      {msg && (
        <p className="text-sm text-emerald-700" role="status">
          {msg}
        </p>
      )}
      {err && (
        <p className="text-sm text-red-700" role="alert">
          {err}
        </p>
      )}
    </form>
  );
}
